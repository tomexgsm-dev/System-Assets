import { Router, type IRouter, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, generationsTable, usersTable } from "@workspace/db";
import { desc, eq, count, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import archiver from "archiver";
import {
  GenerateWebsiteBody,
  GenerateWebsiteResponse,
} from "@workspace/api-zod";
import type { ProjectFile } from "@workspace/db";

const router: IRouter = Router();

const FREE_PLAN_LIMIT = 3;

// ─── Rate limiting: 10 generations per minute per user ───────────────────────
const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  // Use session userId — route requires auth so this is always set for real requests
  keyGenerator: (req: any) => `user:${req.session?.userId ?? "anon"}`,
  validate: { xForwardedForHeader: false },
  message: { error: "rate_limit", message: "Too many requests — please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── In-memory task queue ─────────────────────────────────────────────────────
interface Task {
  status: "pending" | "planning" | "building" | "done" | "error";
  generationId?: number;
  html?: string;
  prompt?: string;
  files?: ProjectFile[];
  filesDone?: number;
  filesTotal?: number;
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

// ─── System prompts ───────────────────────────────────────────────────────────
const PLANNER_SYSTEM = `You are a senior software architect.
Given an app idea, break it into files for a modern web application.

Return ONLY valid JSON (no markdown, no explanation):
{
  "files": [
    {"name": "index.html", "description": "Main HTML entry point with navigation and layout"},
    {"name": "styles.css", "description": "All CSS styles, animations, and responsive design"},
    {"name": "app.js", "description": "Application logic, state management, and interactivity"}
  ]
}

Rules:
- Always include index.html as the first file
- Maximum 6 files
- Keep it simple: HTML, CSS, JS only (no build tools, no frameworks)
- Each file should have a clear, specific purpose`;

const FILE_SYSTEM = (fileName: string, description: string) =>
  `You are a senior web developer.
Generate complete, production-quality code for the file: ${fileName}

Purpose: ${description}

Rules:
- Return ONLY raw code (no markdown, no code fences, no explanation)
- Write complete, working code — no placeholders, no TODOs
- Make it beautiful and professional with modern UI
- For HTML files: include all necessary <script> and <link> tags to connect other files
- For CSS: include responsive design, animations, and modern styling
- For JS: include full interactivity, event handlers, and state management`;

// ─── AI helpers ───────────────────────────────────────────────────────────────
async function planWithOpenAI(prompt: string): Promise<Array<{name: string; description: string}>> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: `App idea: ${prompt}` },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
  return parsed.files ?? [];
}

async function planWithClaude(prompt: string): Promise<Array<{name: string; description: string}>> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: PLANNER_SYSTEM,
    messages: [{ role: "user", content: `App idea: ${prompt}` }],
  });
  const block = message.content[0];
  const raw = block.type === "text" ? block.text : "{}";
  const parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
  return parsed.files ?? [];
}

async function generateFileWithOpenAI(fileName: string, description: string, prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: FILE_SYSTEM(fileName, description) },
      { role: "user", content: `App idea: ${prompt}\nGenerate: ${fileName}` },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function generateFileWithClaude(fileName: string, description: string, prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: FILE_SYSTEM(fileName, description),
    messages: [{ role: "user", content: `App idea: ${prompt}\nGenerate: ${fileName}` }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

function stripCodeFences(code: string): string {
  return code
    .replace(/^```[\w]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function ensureFullHtml(html: string): string {
  let h = stripCodeFences(html);
  if (!h.toLowerCase().includes("<html")) {
    h = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>App</title></head><body>${h}</body></html>`;
  }
  return h;
}

// Inline local CSS/JS files referenced in HTML so srcDoc iframes work without
// a real web server.  External CDN URLs (http/https) are left untouched.
function inlineAssetsIntoHtml(html: string, files: ProjectFile[]): string {
  const byName = new Map(files.map((f) => [f.name, f.content]));

  // Replace <link rel="stylesheet" href="local.css"> with <style>...</style>
  let result = html.replace(
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href) => {
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
        return match;
      }
      const fileName = href.split("/").pop() ?? href;
      const css = byName.get(fileName) ?? byName.get(href);
      return css ? `<style>\n${css}\n</style>` : match;
    }
  );

  // Also handle the reversed-attribute form: href first, then rel
  result = result.replace(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*\/?>/gi,
    (match, href) => {
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
        return match;
      }
      const fileName = href.split("/").pop() ?? href;
      const css = byName.get(fileName) ?? byName.get(href);
      return css ? `<style>\n${css}\n</style>` : match;
    }
  );

  // Replace <script src="local.js"></script> with inline <script>...</script>
  result = result.replace(
    /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,
    (match, src) => {
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) {
        return match;
      }
      const fileName = src.split("/").pop() ?? src;
      const js = byName.get(fileName) ?? byName.get(src);
      return js ? `<script>\n${js}\n</script>` : match;
    }
  );

  return result;
}

// ─── Main generation pipeline ─────────────────────────────────────────────────
async function runGeneration(
  taskId: string,
  userId: number,
  prompt: string,
  model: "openai" | "claude"
) {
  try {
    // Step 1: Plan
    tasks.set(taskId, { ...tasks.get(taskId)!, status: "planning" });

    const plan = model === "claude"
      ? await planWithClaude(prompt)
      : await planWithOpenAI(prompt);

    if (!plan.length) throw new Error("Planner returned no files");

    // Step 2: Generate each file
    tasks.set(taskId, {
      ...tasks.get(taskId)!,
      status: "building",
      filesTotal: plan.length,
      filesDone: 0,
    });

    const generatedFiles: ProjectFile[] = [];

    for (const file of plan) {
      const content = model === "claude"
        ? await generateFileWithClaude(file.name, file.description, prompt)
        : await generateFileWithOpenAI(file.name, file.description, prompt);

      generatedFiles.push({
        name: file.name,
        description: file.description,
        content: stripCodeFences(content),
      });

      tasks.set(taskId, {
        ...tasks.get(taskId)!,
        filesDone: generatedFiles.length,
      });
    }

    // Step 3: Build self-contained preview HTML by inlining all project CSS/JS.
    // The preview uses srcDoc which has no base URL, so external file references
    // like <link href="styles.css"> would silently fail without this step.
    const htmlFile = generatedFiles.find((f) => f.name.endsWith(".html"));
    const rawHtml = ensureFullHtml(htmlFile?.content ?? "<html><body><p>No HTML file generated</p></body></html>");
    const previewHtml = inlineAssetsIntoHtml(rawHtml, generatedFiles);

    // Step 4: Save to DB
    const [generation] = await db
      .insert(generationsTable)
      .values({ prompt, html: previewHtml, userId, files: generatedFiles })
      .returning();

    tasks.set(taskId, {
      status: "done",
      generationId: generation.id,
      html: generation.html,
      prompt: generation.prompt,
      files: generatedFiles,
      filesTotal: plan.length,
      filesDone: plan.length,
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

  // ── Prompt cache: return existing generation for same prompt ────────────────
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
      const existingFiles = (existing.files as ProjectFile[]) ?? [];
      // Re-inline assets every time we serve from cache so older generations
      // (saved before inlining was added) also render correctly in the preview.
      const inlinedHtml = existingFiles.length
        ? inlineAssetsIntoHtml(existing.html, existingFiles)
        : existing.html;

      // Patch the DB row if the HTML changed (backfill for old generations).
      if (inlinedHtml !== existing.html) {
        db.update(generationsTable)
          .set({ html: inlinedHtml })
          .where(eq(generationsTable.id, existing.id))
          .catch((e: unknown) => console.error("Failed to backfill html:", e));
      }

      const taskId = randomUUID();
      tasks.set(taskId, {
        status: "done",
        generationId: existing.id,
        html: inlinedHtml,
        prompt: existing.prompt,
        files: existingFiles.length ? existingFiles : undefined,
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
      files: task.files ?? null,
    });
  } else if (task.status === "error") {
    res.json({ status: "error", error: task.error });
  } else {
    res.json({
      status: task.status,
      filesDone: task.filesDone ?? 0,
      filesTotal: task.filesTotal ?? 0,
    });
  }
});

// ─── GET /project/:id/zip — download project as ZIP ──────────────────────────
router.get("/project/:id/zip", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [generation] = await db
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.id, id));

  if (!generation) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const projectFiles: ProjectFile[] = (generation.files as ProjectFile[]) ?? [
    { name: "index.html", content: generation.html },
  ];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nexus-project-${id}.zip"`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to create ZIP" });
  });

  archive.pipe(res);

  for (const file of projectFiles) {
    archive.append(file.content, { name: file.name });
  }

  await archive.finalize();
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
        files: g.files ?? null,
        createdAt: g.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("List generations error:", String(err));
    res.status(500).json({ error: "Failed to list generations" });
  }
});

// ─── PATCH /project/:id — save edited file(s) ────────────────────────────────
router.patch("/project/:id", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const { fileName, content } = req.body as { fileName: string; content: string };
  if (!fileName || typeof content !== "string") {
    res.status(400).json({ error: "fileName and content are required" });
    return;
  }

  const [generation] = await db
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.id, id));

  if (!generation || generation.userId !== req.session.userId) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const currentFiles: ProjectFile[] = (generation.files as ProjectFile[]) ?? [
    { name: "index.html", content: generation.html },
  ];

  const updatedFiles = currentFiles.map((f) =>
    f.name === fileName ? { ...f, content } : f
  );

  // If fileName not found, add it as a new file
  if (!currentFiles.find((f) => f.name === fileName)) {
    updatedFiles.push({ name: fileName, content });
  }

  // Update preview HTML if index.html was changed
  const newHtml = fileName === "index.html" ? content : generation.html;

  await db
    .update(generationsTable)
    .set({ files: updatedFiles, html: newHtml })
    .where(eq(generationsTable.id, id));

  res.json({ ok: true, savedAt: new Date().toISOString() });
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
