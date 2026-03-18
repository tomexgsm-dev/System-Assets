import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, generationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  GenerateWebsiteBody,
  GenerateWebsiteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an expert web developer. Generate a complete, beautiful, modern HTML landing page based on the user's description.

Requirements:
- Return ONLY raw HTML (no markdown, no code fences, no explanation)
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Make it visually stunning with modern design: gradients, shadows, smooth animations
- Include sections: hero, features, pricing, and a CTA
- Use a professional dark theme by default unless specified otherwise
- Make it fully responsive and mobile-friendly
- Include realistic placeholder content that matches the description
- Add subtle CSS animations and hover effects
- The page should look like a real, polished startup landing page`;

async function generateWithOpenAI(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Create a beautiful landing page for: ${prompt}` },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function generateWithClaude(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Create a beautiful landing page for: ${prompt}` }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

function cleanHtml(raw: string): string {
  let html = raw
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!html.toLowerCase().includes("<html")) {
    html = `<!DOCTYPE html><html><body>${html}</body></html>`;
  }
  return html;
}

router.post("/generate", async (req, res) => {
  const parsed = GenerateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, model = "openai" } = parsed.data;

  try {
    const raw =
      model === "claude"
        ? await generateWithClaude(prompt)
        : await generateWithOpenAI(prompt);

    const html = cleanHtml(raw);

    const [generation] = await db
      .insert(generationsTable)
      .values({ prompt, html })
      .returning();

    const response = GenerateWebsiteResponse.parse({
      id: generation.id,
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

    res.json(
      generations.map((g) => ({
        id: g.id,
        prompt: g.prompt,
        html: g.html,
        createdAt: g.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("List generations error:", String(err));
    res.status(500).json({ error: "Failed to list generations" });
  }
});

router.get("/project/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).send("<html><body>Invalid project ID</body></html>");
    return;
  }

  try {
    const [generation] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, id));

    if (!generation) {
      res.status(404).send("<html><body><h1>Project not found</h1></body></html>");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generation.html);
  } catch (err) {
    console.error("View project error:", err);
    res.status(500).send("<html><body>Error loading project</body></html>");
  }
});

export default router;
