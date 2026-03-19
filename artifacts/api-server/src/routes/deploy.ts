import { Router, type IRouter, type Response } from "express";
import archiver from "archiver";
import { db, generationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { ProjectFile } from "@workspace/db";

const router: IRouter = Router();

const FREE_PUBLISH_LIMIT = 3;

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

  // ── Free plan publish limit ────────────────────────────────────────────────
  if (plan === "free") {
    const [user] = await db
      .select({ publishCount: usersTable.publishCount })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user && user.publishCount >= FREE_PUBLISH_LIMIT) {
      res.status(403).json({
        error: "publish_limit",
        message: `Free plan allows ${FREE_PUBLISH_LIMIT} published sites. Upgrade to PRO for unlimited publishing.`,
        publishCount: user.publishCount,
        limit: FREE_PUBLISH_LIMIT,
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

    // 4. Increment publish counter for free users
    if (plan === "free") {
      await db
        .update(usersTable)
        .set({ publishCount: sql`${usersTable.publishCount} + 1` })
        .where(eq(usersTable.id, userId));
    }

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

export default router;
