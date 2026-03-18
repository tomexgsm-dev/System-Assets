import { getStripeSync } from './stripeClient';
import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Let StripeSync verify signature and persist Stripe data
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Handle specific events to update application state
    try {
      const event = JSON.parse(payload.toString());

      if (event.type === 'checkout.session.completed') {
        const session = event.data?.object;
        const customerId = session?.customer as string | undefined;
        const subscriptionId = session?.subscription as string | undefined;
        const paymentStatus = session?.payment_status;

        if (customerId && paymentStatus === 'paid') {
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.stripeCustomerId, customerId))
            .limit(1);

          if (user) {
            await db
              .update(usersTable)
              .set({
                plan: 'pro',
                ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
              })
              .where(eq(usersTable.id, user.id));
            console.log(`[Stripe] Plan upgraded to PRO for user ${user.id} (${user.email})`);
          } else {
            console.warn(`[Stripe] checkout.session.completed: no user for customer ${customerId}`);
          }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data?.object;
        const customerId = subscription?.customer as string | undefined;
        if (customerId) {
          await db
            .update(usersTable)
            .set({ plan: 'free', stripeSubscriptionId: null })
            .where(eq(usersTable.stripeCustomerId, customerId));
          console.log(`[Stripe] Plan downgraded to FREE for customer ${customerId}`);
        }
      }
    } catch (parseErr) {
      console.error('[Stripe] Application-level webhook logic failed:', String(parseErr));
    }
  }
}
