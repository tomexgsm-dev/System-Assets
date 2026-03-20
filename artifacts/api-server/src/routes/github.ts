import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/github/push", async (req: any, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Login required" });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return res.status(503).json({
      error: "github_not_configured",
      message: "GITHUB_TOKEN or GITHUB_REPO env secrets are not set.",
    });
  }

  const { path: filePath, content, commitMessage } = req.body as {
    path?: string;
    content?: string;
    commitMessage?: string;
  };

  if (!filePath || !content) {
    return res.status(400).json({ error: "path and content are required" });
  }

  const apiBase = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // 1. Check if file already exists (needed for sha when updating)
    let sha: string | undefined;
    const getRes = await fetch(apiBase, { headers });
    if (getRes.status === 200) {
      const existing = (await getRes.json()) as any;
      sha = existing.sha;
    }

    // 2. Create or update the file
    const body: Record<string, any> = {
      message: commitMessage?.trim() || "Update from Nexus Builder",
      content: Buffer.from(content).toString("base64"),
    };
    if (sha) body.sha = sha;

    const pushRes = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const result = (await pushRes.json()) as any;

    if (!pushRes.ok) {
      return res.status(pushRes.status).json({
        error: "github_api_error",
        message: result.message ?? "GitHub API returned an error",
      });
    }

    return res.json({
      success: true,
      fileUrl: result.content?.html_url as string | undefined,
      commitUrl: result.commit?.html_url as string | undefined,
      sha: result.content?.sha as string | undefined,
    });
  } catch (err: any) {
    console.error("[github] push error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "GitHub push failed" });
  }
});

export default router;
