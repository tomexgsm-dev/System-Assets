import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, generationsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  GenerateWebsiteBody,
  GenerateWebsiteResponse,
  ListGenerationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/generate", async (req, res) => {
  const parsed = GenerateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt } = parsed.data;

  try {
    const systemPrompt = `You are an expert web developer. Generate a complete, beautiful, self-contained HTML page based on the user's description. 

Requirements:
- Return ONLY raw HTML (no markdown, no code fences, no explanation)
- Include all CSS inline in a <style> tag
- Include any JavaScript inline in a <script> tag
- Make it visually stunning with modern design: gradients, shadows, animations
- Use a dark theme by default
- Make it responsive and mobile-friendly
- Include placeholder content that matches the description
- The page should look like a real, polished website
- Do NOT include any external dependencies or CDN links — everything must be self-contained`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Create a beautiful website for: ${prompt}`,
        },
      ],
    });

    let html = completion.choices[0]?.message?.content ?? "";

    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (!html.toLowerCase().includes("<html")) {
      html = `<!DOCTYPE html><html><body>${html}</body></html>`;
    }

    const [generation] = await db
      .insert(generationsTable)
      .values({ prompt, html })
      .returning();

    const response = GenerateWebsiteResponse.parse({
      html: generation.html,
      prompt: generation.prompt,
    });

    res.json(response);
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ error: "Failed to generate website" });
  }
});

router.get("/generations", async (_req, res) => {
  try {
    const generations = await db
      .select()
      .from(generationsTable)
      .orderBy(desc(generationsTable.createdAt))
      .limit(20);

    const response = ListGenerationsResponse.parse(
      generations.map((g) => ({
        id: g.id,
        prompt: g.prompt,
        html: g.html,
        createdAt: g.createdAt.toISOString(),
      }))
    );

    res.json(response);
  } catch (err) {
    console.error("List generations error:", err);
    res.status(500).json({ error: "Failed to list generations" });
  }
});

export default router;
