import { Router, type IRouter } from "express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Get products with prices
router.get("/stripe/products", async (_req, res) => {
  try {
    const rows = await storage.listProductsWithPrices();

    const productsMap = new Map();
    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err) {
    console.error("List products error:", String(err));
    res.status(500).json({ error: "Failed to list products" });
  }
});

// Create checkout session
router.post("/stripe/checkout", requireAuth, async (req: any, res) => {
  const { priceId } = req.body;
  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? `https://${domain}` : `http://localhost:${process.env.PORT}`;

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${base}/dashboard?upgraded=1`,
      `${base}/dashboard?canceled=1`
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", String(err));
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Stripe webhook: update user plan on successful payment
router.post("/stripe/success-webhook", requireAuth, async (req: any, res) => {
  try {
    await storage.updateUserStripeInfo(req.session.userId, { plan: "pro" });
    req.session.plan = "pro";
    res.json({ ok: true });
  } catch (err) {
    console.error("Success webhook error:", String(err));
    res.status(500).json({ error: "Failed to update plan" });
  }
});

export default router;
