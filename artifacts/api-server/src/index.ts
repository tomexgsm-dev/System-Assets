import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import app from './app';

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const webhookBase = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBase}/api/stripe/webhook`
    );
    console.log('Webhook configured:', webhookResult?.webhook?.url ?? 'ok');

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Stripe sync error:', String(err)));
  } catch (err) {
    console.error('Stripe init error (non-fatal):', String(err));
  }
}

(async () => {
  const rawPort = process.env['PORT'];
  if (!rawPort) throw new Error('PORT environment variable is required');
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

  await initStripe();

  app.listen(port, () => console.log(`Server listening on port ${port}`));
})();
