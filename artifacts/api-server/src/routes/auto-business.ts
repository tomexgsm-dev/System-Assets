import { Router, type IRouter, type Response } from "express";
import OpenAI from "openai";
import { db, generationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkCredits, useCredit } from "../utils/limits";

const router: IRouter = Router();

const groqClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

const PLANNER_SYSTEM = `You are a professional business consultant and copywriter.
Given a business idea, create a complete business plan in JSON.

Return ONLY valid JSON in exactly this shape:
{
  "companyName": "string",
  "tagline": "string (short, punchy)",
  "description": "string (2-3 sentences about the business)",
  "targetAudience": "string",
  "colorPrimary": "string (hex, e.g. #7c3aed)",
  "colorAccent": "string (hex)",
  "packages": [
    { "name": "string", "price": "string", "features": ["string", "string", "string"] },
    { "name": "string", "price": "string", "features": ["string", "string", "string"] },
    { "name": "string", "price": "string", "features": ["string", "string", "string"] }
  ],
  "sections": ["hero", "about", "services", "pricing", "testimonials", "contact"],
  "ctaText": "string (call to action button text)",
  "heroHeadline": "string (large bold hero headline)",
  "heroSubtitle": "string (hero subtitle)",
  "testimonials": [
    { "name": "string", "text": "string", "rating": 5 },
    { "name": "string", "text": "string", "rating": 5 }
  ],
  "services": [
    { "icon": "string (emoji)", "name": "string", "description": "string" },
    { "icon": "string (emoji)", "name": "string", "description": "string" },
    { "icon": "string (emoji)", "name": "string", "description": "string" }
  ]
}

Be specific, professional and creative. Use industry-appropriate language.`;

const PAGE_SYSTEM = `You are an expert frontend developer specializing in modern, conversion-optimized landing pages.

Given a business plan JSON, generate a complete, beautiful, single-file HTML page.

Requirements:
- Complete single HTML file with embedded CSS and JS
- Modern design: gradients, smooth animations, glassmorphism or clean design
- Fully responsive (mobile-first)
- Sections: Hero, Services, Pricing (3 packages), Testimonials, Contact form, Footer
- Smooth scroll navigation
- CSS animations on scroll (using IntersectionObserver)
- Professional typography and spacing
- CTA buttons with hover effects
- Use the exact company name, tagline, colors from the business plan
- Contact form with basic validation
- SEO meta tags
- Return ONLY the HTML — no explanation, no markdown fences`;

function repairJSON(raw: string): any {
  let text = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) text = m[0];
  try { return JSON.parse(text); } catch {}
  const fixed = text
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([\]}])/g, "$1")
    .trim();
  return JSON.parse(fixed);
}

router.post("/auto-business", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { idea } = req.body as { idea: string };
  if (!idea || typeof idea !== "string" || !idea.trim()) {
    res.status(400).json({ error: "idea is required" });
    return;
  }

  // Check credits
  const creditCheck = await checkCredits(req.session.userId);
  if (!creditCheck.allowed) {
    res.status(403).json({ error: "no_credits" });
    return;
  }

  try {
    // ── Step 1: Plan the business ──────────────────────────────────────────────
    const planCompletion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 3000,
      messages: [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: `Business idea: ${idea.trim()}` },
      ],
    });

    const planRaw = planCompletion.choices[0]?.message?.content ?? "{}";
    let plan: any;
    try {
      plan = repairJSON(planRaw);
    } catch {
      plan = {
        companyName: idea,
        tagline: "Professional Services",
        description: idea,
        colorPrimary: "#7c3aed",
        colorAccent: "#06b6d4",
        packages: [
          { name: "Basic", price: "$29/mo", features: ["Feature 1", "Feature 2", "Feature 3"] },
          { name: "Pro", price: "$79/mo", features: ["All Basic", "Feature 4", "Feature 5"] },
          { name: "Enterprise", price: "$199/mo", features: ["All Pro", "Priority support", "Custom"] },
        ],
        ctaText: "Get Started",
        heroHeadline: idea,
        heroSubtitle: "Professional services tailored to your needs.",
        services: [
          { icon: "⚡", name: "Service 1", description: "Description of service 1" },
          { icon: "🎯", name: "Service 2", description: "Description of service 2" },
          { icon: "🚀", name: "Service 3", description: "Description of service 3" },
        ],
        testimonials: [
          { name: "Client A", text: "Excellent service!", rating: 5 },
          { name: "Client B", text: "Highly recommended.", rating: 5 },
        ],
      };
    }

    // ── Step 2: Generate the HTML page ────────────────────────────────────────
    const pageCompletion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 16000,
      messages: [
        { role: "system", content: PAGE_SYSTEM },
        {
          role: "user",
          content: `Create a complete landing page for this business:\n\n${JSON.stringify(plan, null, 2)}`,
        },
      ],
    });

    let html = pageCompletion.choices[0]?.message?.content ?? "";
    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${plan.companyName ?? idea}</title></head><body>${html}</body></html>`;
    }

    // ── Save to DB ─────────────────────────────────────────────────────────────
    const prompt = `[Auto Business] ${idea.trim()}`;
    const [gen] = await db
      .insert(generationsTable)
      .values({
        userId: req.session.userId,
        prompt,
        html,
        files: JSON.stringify([{ name: "index.html", content: html, description: "Generated landing page" }]),
      })
      .returning();

    // Deduct credit
    await useCredit(req.session.userId);

    res.json({ id: gen.id, html, plan, prompt });
  } catch (err: any) {
    console.error("Auto-business error:", String(err));
    res.status(500).json({ error: "Auto-business generation failed: " + (err?.message ?? String(err)) });
  }
});

export default router;
