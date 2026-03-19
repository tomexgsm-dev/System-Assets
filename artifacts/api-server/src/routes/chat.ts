import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const groqClient = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

const CHAT_SYSTEM = `You are an expert frontend developer and debugger.

Your tasks:
- Analyze HTML/CSS/JS code
- Detect bugs and problems
- Explain issues in simple language
- Give concrete, actionable solutions with code

Always reply in a structured way:
1. **Problem**: What is wrong
2. **Why**: Root cause explanation  
3. **Fix**: Exact code solution

Be concise and practical. Use markdown for code blocks.`;

const FIX_SYSTEM = `You are an expert frontend developer.

The user has a multi-file or single-file website with bugs or issues.
Your task: rewrite the ENTIRE provided HTML/CSS/JS code with ALL bugs fixed and improvements applied.

IMPORTANT RULES:
- Return ONLY the fixed, complete HTML code — nothing else
- Do NOT include any explanation, markdown, or commentary  
- Start directly with <!DOCTYPE html> or the first line of the file
- Make the code clean, functional and well-structured
- Keep all existing design and content — only fix bugs`;

router.post("/chat", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { message, html, mode = "chat" } = req.body as {
    message: string;
    html: string;
    mode?: "chat" | "fix";
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  if (!html || typeof html !== "string") {
    res.status(400).json({ error: "html is required" });
    return;
  }

  try {
    if (mode === "fix") {
      const completion = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 16000,
        messages: [
          { role: "system", content: FIX_SYSTEM },
          {
            role: "user",
            content: `Fix this code:\n\n${html}\n\n${message !== "auto" ? `Also apply this specific fix: ${message}` : "Fix all bugs and improve quality."}`,
          },
        ],
      });

      let fixedHtml = completion.choices[0]?.message?.content ?? html;

      // Strip markdown code fences if AI wrapped the response
      fixedHtml = fixedHtml
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      res.json({ reply: "✅ Code fixed and applied!", fixedHtml });
    } else {
      const completion = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [
          { role: "system", content: CHAT_SYSTEM },
          {
            role: "user",
            content: `Page code:\n\`\`\`html\n${html.slice(0, 12000)}\n\`\`\`\n\nQuestion: ${message}`,
          },
        ],
      });

      const reply = completion.choices[0]?.message?.content ?? "Sorry, no response.";
      res.json({ reply });
    }
  } catch (err: any) {
    console.error("Chat error:", String(err));
    res.status(500).json({ error: "AI chat failed: " + (err?.message ?? String(err)) });
  }
});

const ANALYZE_SYSTEM = `You are an expert frontend developer and code auditor.

Analyze the provided HTML/CSS/JS code and list ALL bugs, issues and improvement opportunities.
Be specific and concise. Use numbered list format.
Focus on: broken logic, missing event handlers, layout bugs, accessibility, performance, UX issues.
Do NOT suggest rewriting from scratch — only concrete, targeted issues.`;

const AGENT_FIX_SYSTEM = `You are an expert frontend developer.

You will receive HTML/CSS/JS code and a list of specific issues found by an auditor.
Your task: rewrite the ENTIRE code with ALL listed issues fixed.

CRITICAL RULES:
- Return ONLY the fixed, complete HTML code — nothing else
- No explanation, no markdown fences, no commentary
- Start directly with <!DOCTYPE html>
- Keep all existing design, branding and content intact
- Only fix the identified issues`;

router.post("/agent", async (req: any, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let { html, iterations = 2 } = req.body as { html: string; iterations?: number };

  if (!html || typeof html !== "string") {
    res.status(400).json({ error: "html is required" });
    return;
  }

  const maxIter = Math.min(Math.max(Number(iterations) || 2, 1), 3);
  const steps: { step: number; issues: string }[] = [];

  try {
    for (let i = 0; i < maxIter; i++) {
      // Step 1 — Analyze
      const analysisCompletion = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [
          { role: "system", content: ANALYZE_SYSTEM },
          { role: "user", content: `Analyze this code:\n\n${html.slice(0, 12000)}` },
        ],
      });

      const issues = analysisCompletion.choices[0]?.message?.content ?? "No issues found.";
      steps.push({ step: i + 1, issues });

      // Step 2 — Fix
      const fixCompletion = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 16000,
        messages: [
          { role: "system", content: AGENT_FIX_SYSTEM },
          {
            role: "user",
            content: `Code:\n${html}\n\nIssues found:\n${issues}\n\nFix all issues and return the complete fixed code.`,
          },
        ],
      });

      let fixedHtml = fixCompletion.choices[0]?.message?.content ?? html;

      // Strip markdown fences if present
      fixedHtml = fixedHtml
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      html = fixedHtml;
    }

    res.json({ finalHTML: html, steps });
  } catch (err: any) {
    console.error("Agent error:", String(err));
    res.status(500).json({ error: "Agent failed: " + (err?.message ?? String(err)) });
  }
});

export default router;
