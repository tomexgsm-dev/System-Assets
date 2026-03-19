import { Router } from "express";
import OpenAI from "openai";

function repairAndParseJSON(raw: string): any {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const arrMatch = s.match(/\[[\s\S]*\]/);
  if (arrMatch) try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  throw new SyntaxError("repairAndParseJSON: could not parse JSON");
}

const router = Router();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function stripFences(text: string): string {
  return text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
}

router.post("/api/seo", async (req, res) => {
  const { html, keyword } = req.body as { html?: string; keyword?: string };
  if (!html || !keyword) {
    return res.status(400).json({ error: "html and keyword are required" });
  }

  const prompt = `You are an SEO expert. Optimize the following HTML page for the keyword: "${keyword}"

Requirements:
- Add or update <title> tag to include the keyword
- Add or update <meta name="description"> (150-160 chars) with the keyword
- Improve H1-H3 headings to naturally include the keyword
- Add alt attributes to all images
- Add semantic HTML5 tags where appropriate (header, main, section, footer, article, nav)
- Keep the original design and all CSS completely unchanged
- Return ONLY the full optimized HTML, no markdown fences, no explanations

HTML TO OPTIMIZE:
${html}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 32000,
    });

    const result = stripFences(completion.choices[0].message.content ?? "");
    return res.json({ html: result });
  } catch (err: any) {
    console.error("[seo] optimize error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "SEO optimization failed" });
  }
});

router.post("/api/seo/keywords", async (req, res) => {
  const { html } = req.body as { html?: string };
  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  const excerpt = html.slice(0, 6000);

  const prompt = `Analyze this HTML page content and suggest the 8 best SEO keywords or short phrases (2-4 words each) that would drive targeted traffic to this page. Consider the page's topic, headings, and purpose.

Return ONLY a valid JSON array of 8 strings. Example: ["keyword one", "keyword two"]

HTML:
${excerpt}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
    });

    let raw = completion.choices[0].message.content ?? "[]";
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

    let keywords: string[] = [];
    try {
      keywords = repairAndParseJSON(raw);
      if (!Array.isArray(keywords)) keywords = [];
    } catch {
      keywords = [];
    }

    return res.json({ keywords });
  } catch (err: any) {
    console.error("[seo] keywords error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Keyword generation failed" });
  }
});

export default router;
