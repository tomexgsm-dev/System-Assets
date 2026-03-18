import { getUncachableStripeClient } from '../stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Creating products in Stripe...');

    const existing = await stripe.products.search({ query: "name:'Pro Plan' AND active:'true'" });
    if (existing.data.length > 0) {
      console.log('Pro Plan already exists:', existing.data[0].id);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      console.log('Existing prices:', prices.data.map(p => `${p.id} = $${(p.unit_amount ?? 0) / 100}`).join(', '));
      return;
    }

    const product = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Unlimited AI website generations. Build as many landing pages as you want.',
    });
    console.log('Created product:', product.id);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 999, // $9.99
      currency: 'usd',
    });
    console.log('Created price:', price.id, '= $9.99 one-time');

    console.log('Done! Run the app and click Upgrade to test checkout.');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createProducts();
