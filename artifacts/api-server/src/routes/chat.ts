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

export default router;
