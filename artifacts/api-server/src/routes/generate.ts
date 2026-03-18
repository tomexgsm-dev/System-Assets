import { Router, type IRouter, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, generationsTable, usersTable } from "@workspace/db";
import { desc, eq, count, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  GenerateWebsiteBody,
  GenerateWebsiteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FREE_PLAN_LIMIT = 3;

// ─── Rate limiting: 10 generations per minute per user ───────────────────────
const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req: any) => String(req.session?.userId ?? req.ip),
  message: { error: "rate_limit", message: "Too many requests — please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── In-memory task queue ─────────────────────────────────────────────────────
interface Task {
  status: "pending" | "done" | "error";
  generationId?: number;
  html?: string;
  prompt?: string;
  error?: string;
  createdAt: number;
}

const tasks = new Map<string, Task>();

// Clean up tasks older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, task] of tasks) {
    if (task.createdAt < cutoff) tasks.delete(id);
  }
}, 15 * 60 * 1000);

// ─── AI generation helpers ────────────────────────────────────────────────────
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

// ─── Background generation worker ────────────────────────────────────────────
async function runGeneration(
  taskId: string,
  userId: number,
  prompt: string,
  model: "openai" | "claude"
) {
  try {
    const raw = model === "claude"
      ? await generateWithClaude(prompt)
      : await generateWithOpenAI(prompt);

    const html = cleanHtml(raw);

    const [generation] = await db
      .insert(generationsTable)
      .values({ prompt, html, userId })
      .returning();

    tasks.set(taskId, {
      status: "done",
      generationId: generation.id,
      html: generation.html,
      prompt: generation.prompt,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("Generation task failed:", String(err));
    tasks.set(taskId, {
      status: "error",
      error: "Generation failed. Please try again.",
      createdAt: Date.now(),
    });
  }
}

// ─── POST /generate — starts async task ──────────────────────────────────────
router.post("/generate", generateRateLimit, async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Login required to generate websites" });
    return;
  }

  const parsed = GenerateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, model = "openai" } = parsed.data;
  const userId = req.session.userId;
  const plan = req.session.plan ?? "free";

  // ── Prompt cache: return existing generation for same prompt+model ──────────
  if (plan === "free") {
    const [existing] = await db
      .select()
      .from(generationsTable)
      .where(
        and(
          eq(generationsTable.userId, userId),
          eq(generationsTable.prompt, prompt)
        )
      )
      .limit(1);

    if (existing) {
      const taskId = randomUUID();
      tasks.set(taskId, {
        status: "done",
        generationId: existing.id,
        html: existing.html,
        prompt: existing.prompt,
        createdAt: Date.now(),
      });
      res.json({ taskId, cached: true });
      return;
    }
  }

  // ── Free plan limit check ──────────────────────────────────────────────────
  if (plan === "free") {
    const [{ value }] = await db
      .select({ value: count() })
      .from(generationsTable)
      .where(eq(generationsTable.userId, userId));

    if (value >= FREE_PLAN_LIMIT) {
      res.status(403).json({
        error: "limit_reached",
        message: `Free plan allows ${FREE_PLAN_LIMIT} generations. Upgrade to PRO for unlimited.`,
      });
      return;
    }
  }

  // ── Create task and start background generation ────────────────────────────
  const taskId = randomUUID();
  tasks.set(taskId, { status: "pending", createdAt: Date.now() });

  // Fire-and-forget background generation
  runGeneration(taskId, userId, prompt, model);

  res.json({ taskId, cached: false });
});

// ─── GET /status/:taskId — poll for task result ───────────────────────────────
router.get("/status/:taskId", (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (task.status === "done") {
    res.json({
      status: "done",
      id: task.generationId,
      html: task.html,
      prompt: task.prompt,
    });
  } else if (task.status === "error") {
    res.json({ status: "error", error: task.error });
  } else {
    res.json({ status: "pending" });
  }
});

// ─── GET /generations — list user's generations ───────────────────────────────
router.get("/generations", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const generations = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.userId, req.session.userId))
      .orderBy(desc(generationsTable.createdAt))
      .limit(50);

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

// ─── GET /project/:id — serve raw HTML ────────────────────────────────────────
router.get("/project/:id", async (req: Request, res: Response) => {
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
    console.error("View project error:", String(err));
    res.status(500).send("<html><body>Error loading project</body></html>");
  }
});

export default router;
