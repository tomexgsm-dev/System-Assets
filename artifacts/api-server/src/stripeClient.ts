import Stripe from "stripe";

// Stripe client using environment variables
// After connecting the Stripe integration, these are populated automatically
let stripeInstance: Stripe | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Please connect the Stripe integration.");
  }
  return new Stripe(key, { apiVersion: "2025-04-30.basil" });
}

// StripeSync integration — populated after Stripe is connected
export async function getStripeSync() {
  const { StripeSync } = await import("stripe-replit-sync");
  const key = process.env.STRIPE_SECRET_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!key || !dbUrl) {
    throw new Error("Stripe not configured. Please connect the Stripe integration.");
  }
  return await StripeSync.create({ stripeSecretKey: key, databaseUrl: dbUrl });
}
