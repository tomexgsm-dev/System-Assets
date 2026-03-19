import { Router, type IRouter, type Response } from "express";
import archiver from "archiver";
import { db, generationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { ProjectFile } from "@workspace/db";
import { checkPublishLimit, incrementPublishCount } from "../utils/limits";

const router: IRouter = Router();

// POST /api/deploy — publish a project to Netlify
router.post("/deploy", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  const token = process.env.NETLIFY_TOKEN;
  if (!token) {
    res.status(503).json({
      error: "netlify_not_configured",
      message: "NETLIFY_TOKEN is not set. Add your Netlify Personal Access Token in the Secrets settings.",
    });
    return;
  }

  const { generationId } = req.body;
  if (!generationId) {
    res.status(400).json({ error: "generationId is required" });
    return;
  }

  const userId = req.session.userId;
  const plan = req.session.plan ?? "free";

  // ── Free plan publish limit (daily + monthly with auto-reset) ──────────────
  if (plan === "free") {
    const limitResult = await checkPublishLimit(userId);
    if (!limitResult.allowed) {
      res.status(403).json({
        error: "publish_limit",
        message: limitResult.reason,
        daily: limitResult.daily,
        dailyLimit: limitResult.dailyLimit,
        monthly: limitResult.monthly,
        monthlyLimit: limitResult.monthlyLimit,
      });
      return;
    }
  }

  // ── Load project files ─────────────────────────────────────────────────────
  const [gen] = await db
    .select()
    .from(generationsTable)
    .where(and(eq(generationsTable.id, generationId), eq(generationsTable.userId, userId)))
    .limit(1);

  if (!gen) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  const files: ProjectFile[] =
    (gen.files as ProjectFile[]) ??
    [{ name: "index.html", content: gen.html, description: "Main page" }];

  try {
    // 1. Create a new Netlify site
    const siteRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: `nexus-site-${Date.now()}` }),
    });

    if (!siteRes.ok) {
      const text = await siteRes.text();
      console.error("[Netlify] create site failed:", siteRes.status, text);
      res.status(502).json({ error: "Failed to create Netlify site", detail: text });
      return;
    }

    const site = (await siteRes.json()) as { id: string; ssl_url: string; url: string };

    // 2. Build ZIP in memory
    const zipBuffer = await buildZip(files);

    // 3. Deploy the ZIP to the site
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/zip",
        },
        body: zipBuffer,
      }
    );

    if (!deployRes.ok) {
      const text = await deployRes.text();
      console.error("[Netlify] deploy failed:", deployRes.status, text);
      res.status(502).json({ error: "Failed to deploy to Netlify", detail: text });
      return;
    }

    const deploy = (await deployRes.json()) as { deploy_ssl_url?: string; ssl_url?: string };
    const liveUrl = deploy.deploy_ssl_url ?? deploy.ssl_url ?? site.ssl_url ?? site.url;

    // 4. Increment publish counters (all users — tracks total publishes)
    await incrementPublishCount(userId).catch((e: any) =>
      console.warn("[limits] Failed to increment publish count:", e?.message)
    );

    console.log(`[Netlify] deployed gen#${generationId} by user#${userId} → ${liveUrl}`);
    res.json({ url: liveUrl, siteId: site.id });
  } catch (err: any) {
    console.error("[Netlify] unexpected error:", err?.message ?? err);
    res.status(500).json({ error: "Deploy failed", message: err?.message ?? String(err) });
  }
});

function buildZip(files: ProjectFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }

    archive.finalize();
  });
}

// ─── POST /deploy-wp — publish a project to WordPress ────────────────────────
router.post("/deploy-wp", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  const { generationId, wpUrl, wpUser, wpAppPassword, title = "AI Page" } = req.body;

  if (!generationId || !wpUrl || !wpUser || !wpAppPassword) {
    res.status(400).json({ error: "generationId, wpUrl, wpUser and wpAppPassword are required" });
    return;
  }

  const userId = req.session.userId;

  // Refresh plan from DB
  const [userRow] = await db
    .select({ plan: usersTable.plan, publishCount: usersTable.publishCount })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const plan = userRow?.plan ?? "free";

  if (plan === "free") {
    const limitResult = await checkPublishLimit(userId);
    if (!limitResult.allowed) {
      res.status(403).json({
        error: "publish_limit",
        message: limitResult.reason,
        daily: limitResult.daily,
        dailyLimit: limitResult.dailyLimit,
        monthly: limitResult.monthly,
        monthlyLimit: limitResult.monthlyLimit,
      });
      return;
    }
  }

  // Load generation
  const [gen] = await db
    .select()
    .from(generationsTable)
    .where(and(eq(generationsTable.id, generationId), eq(generationsTable.userId, userId)))
    .limit(1);

  if (!gen) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  // Use the inlined HTML (self-contained) for WordPress
  const html = gen.html;

  try {
    const base = wpUrl.replace(/\/$/, "");
    const auth = Buffer.from(`${wpUser}:${wpAppPassword}`).toString("base64");

    const wpRes = await fetch(`${base}/wp-json/wp/v2/pages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, content: html, status: "publish" }),
    });

    if (!wpRes.ok) {
      const text = await wpRes.text();
      console.error("[WordPress] publish failed:", wpRes.status, text);
      let detail = `WordPress returned ${wpRes.status}`;
      try {
        const j = JSON.parse(text);
        detail = j.message ?? j.code ?? detail;
      } catch {}
      res.status(502).json({ error: "wp_publish_failed", message: detail });
      return;
    }

    const data = (await wpRes.json()) as { link?: string };
    const liveUrl = data.link ?? base;

    // Increment publish counters
    await incrementPublishCount(userId).catch((e: any) =>
      console.warn("[limits] Failed to increment WP publish count:", e?.message)
    );

    console.log(`[WordPress] deployed gen#${generationId} by user#${userId} → ${liveUrl}`);
    res.json({ url: liveUrl });
  } catch (err: any) {
    console.error("[WordPress] unexpected error:", err?.message ?? err);
    res.status(500).json({ error: "Deploy failed", message: err?.message ?? String(err) });
  }
});

export default router;
