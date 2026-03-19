import { Router, type IRouter, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import OpenAI from "openai";
import { db, generationsTable, usersTable } from "@workspace/db";
import { desc, eq, count, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { checkCredits, useCredit } from "../utils/limits";
import { minify as minifyHTML } from "html-minifier-terser";
import CleanCSS from "clean-css";
import { minify as minifyJS } from "terser";
import {
  GenerateWebsiteBody,
  GenerateWebsiteResponse,
} from "@workspace/api-zod";
import type { ProjectFile } from "@workspace/db";

const router: IRouter = Router();

// ─── Robust JSON parser for AI responses ──────────────────────────────────────
// LLMs frequently produce: trailing commas, comments, markdown fences, or text
// surrounding the JSON object. This function handles all common cases.
function repairAndParseJSON(raw: string): any {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let text = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // 2. Try to extract just the first top-level JSON object or array
  //    (strips any explanatory prose the model added before or after)
  const objMatch = text.match(/\{[\s\S]*\}/);
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (objMatch || arrMatch) {
    // Use whichever appears first in the string
    const objIdx = objMatch ? text.indexOf(objMatch[0]) : Infinity;
    const arrIdx = arrMatch ? text.indexOf(arrMatch[0]) : Infinity;
    text = objIdx <= arrIdx ? objMatch![0] : arrMatch![0];
  }

  // 3. Try straight parse first (fast path for valid JSON)
  try {
    return JSON.parse(text);
  } catch {}

  // 4. Repair common LLM JSON issues:
  const repaired = text
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, "")
    // Remove block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Remove trailing commas before } or ]
    .replace(/,\s*([\]}])/g, "$1")
    // Replace single-quoted strings with double-quoted (simple, non-nested cases)
    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => `"${inner}"`)
    .trim();

  // 5. Final parse — let the error propagate with context if still broken
  try {
    return JSON.parse(repaired);
  } catch (err: any) {
    throw new Error(`Failed to parse AI JSON response: ${err.message}\nRaw (first 300 chars): ${raw.slice(0, 300)}`);
  }
}

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
  filePlan?: Array<{ name: string; description: string }>;
  completedFiles?: string[];
  currentFile?: string;
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

// ─── Groq client (OpenAI-compatible) ─────────────────────────────────────────
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY ?? "",
  baseURL: "https://api.groq.com/openai/v1",
});
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ─── System prompts ───────────────────────────────────────────────────────────
const PLANNER_SYSTEM = `You are a senior software architect.
Given an app idea, plan a complete multi-page website with subpages and navigation.

Return ONLY valid JSON (no markdown, no explanation):
{
  "files": [
    {"name": "index.html", "description": "Homepage — hero section, overview, call-to-action"},
    {"name": "about.html", "description": "About page — story, team, values"},
    {"name": "services.html", "description": "Services/features page — detailed offerings"},
    {"name": "contact.html", "description": "Contact page — form, location, social links"},
    {"name": "styles.css", "description": "Shared CSS — variables, layout, typography, components, responsive"},
    {"name": "app.js", "description": "Shared JS — navigation, scroll effects, form handling, interactivity"}
  ]
}

Rules:
- Always include index.html as the main landing page
- Add 2-4 additional HTML subpages that make sense for the described app
- Include shared styles.css and app.js (used by ALL pages)
- Maximum 8 files total; HTML/CSS/JS only (no frameworks, no build tools)
- Choose subpage names that fit the app (e.g. menu.html for a restaurant, shop.html for a store)
- Each file must have a clear, specific, non-overlapping purpose`;

const FILE_SYSTEM = (fileName: string, description: string) =>
  `You are an expert frontend developer. Generate complete, production-quality, stunning code for: ${fileName}

Purpose: ${description}

MANDATORY REQUIREMENTS — every rule below is non-negotiable:
- Return ONLY raw code. No markdown, no code fences, no explanation whatsoever.
- Write 100% complete, working code — zero placeholders, zero TODOs, zero lorem ipsum.

CSS rules (styles.css):
- Mobile-first responsive design using CSS Grid + Flexbox
- CSS custom properties (--primary, --accent, --bg, --text, --radius, etc.)
- Smooth transitions and hover effects on every interactive element
- Scroll-based reveal animations using the .aos-animate pattern (compatible with AOS library)
- Glassmorphism cards: backdrop-filter: blur(12px); background: rgba(255,255,255,0.08)
- Gradient backgrounds, gradient text (background-clip: text)
- Custom scrollbar styling
- Sticky navigation with backdrop-filter blur on scroll
- Hamburger mobile menu animation (☰ → ✕)
- @media breakpoints: 480px, 768px, 1024px, 1280px

JS rules (app.js):
- html { scroll-behavior: smooth; } applied via JS if not in CSS
- Intersection Observer for scroll-reveal animations (add/remove "visible" class)
- Mobile hamburger menu toggle with body scroll lock
- Active nav link highlighting based on current page
- Smooth parallax effect on hero section
- Counter animation for stats (0 → target number on scroll)
- Form validation with real-time feedback
- Initialize AOS: AOS.init({ duration: 800, once: true }) if AOS is present`;

// ─── Refinement context builders ──────────────────────────────────────────────
interface PreviousGeneration {
  prompt: string;
  files: ProjectFile[];
}

const REFINE_PLANNER_SYSTEM = (prev: PreviousGeneration) =>
  `You are a senior software architect helping to REFINE and IMPROVE an existing website.

PREVIOUS WEBSITE:
- Original prompt: "${prev.prompt}"
- Existing files: ${prev.files.map((f) => `${f.name} (${f.description ?? "no description"})`).join(", ")}

TASK: Plan an UPDATED version of the same website based on the user's new instruction.
Keep the same file names and structure unless the update explicitly requires new pages.

Return ONLY valid JSON (no markdown, no explanation):
{
  "files": [
    {"name": "index.html", "description": "Updated homepage with changes applied"},
    ...
  ]
}

Rules:
- Keep the same HTML page names unless new pages are needed
- Always include shared styles.css and app.js
- Maximum 8 files total; HTML/CSS/JS only
- Each file must reflect what changed vs the original`;

const REFINE_FILE_SYSTEM = (
  fileName: string,
  description: string,
  prevPrompt: string
) =>
  `You are a senior web developer REFINING an existing website file.
File: ${fileName} | Purpose: ${description}
Original website: "${prevPrompt}"
Rules:
- Return ONLY the updated raw code (no markdown, no fences, no explanation)
- Apply ONLY the changes needed by the new instruction
- Keep ALL existing design: colors, fonts, layout, components, navigation
- Do NOT regress any feature that already works
- Make changes look natural and consistent with the existing design`;

const REFINE_HTML_SYSTEM = (
  fileName: string,
  description: string,
  prevPrompt: string,
  cssFiles: string[],
  jsFiles: string[],
  allHtmlPages: Array<{ name: string; description: string }>
) => {
  const navLinks = allHtmlPages
    .map((p) => {
      const label = p.name.replace(".html", "").replace(/[-_]/g, " ");
      const isHome = p.name === "index.html";
      return `${isHome ? "Home" : label.charAt(0).toUpperCase() + label.slice(1)} → ${p.name}`;
    })
    .join(", ");

  return `You are a senior web developer REFINING an existing HTML page.
File: ${fileName} | Purpose: ${description}
Original website: "${prevPrompt}"
CSS files (link ALL in <head>): ${cssFiles.join(", ")}
JS files (include ALL before </body>): ${jsFiles.join(", ")}
Navigation pages (ALL must appear in nav): ${navLinks}
Rules:
- Return ONLY the raw updated HTML (no markdown, no fences, no explanation)
- Keep the navigation bar with links to ALL pages above using relative hrefs
- Preserve the overall layout, color scheme, and visual design exactly
- Apply ONLY the changes described in the refinement instruction
- All CSS/JS references must use relative paths`;
};

// HTML page generator — knows about ALL other pages and CSS/JS files for navigation.
const HTML_SYSTEM = (
  fileName: string,
  description: string,
  cssFiles: string[],
  jsFiles: string[],
  allHtmlPages: Array<{ name: string; description: string }>
) => {
  const navLinks = allHtmlPages
    .map((p) => {
      const label = p.name.replace(".html", "").replace(/[-_]/g, " ");
      const isHome = p.name === "index.html";
      const displayLabel = isHome
        ? "Home"
        : label.charAt(0).toUpperCase() + label.slice(1);
      return `${displayLabel} → ${p.name}`;
    })
    .join(", ");

  return `You are an expert frontend developer creating a stunning, modern multi-page website.
Generate the COMPLETE HTML file: ${fileName}

Page purpose: ${description}

CSS files to link (ALL must be in <head>): ${cssFiles.join(", ")}
JS files to include (ALL must go before </body>): ${jsFiles.join(", ")}
Navigation pages (ALL must appear in the nav bar): ${navLinks}

MANDATORY REQUIREMENTS — every rule is non-negotiable:
- Return ONLY raw HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> with <html lang="en">, complete <head>, full <body>

<head> must contain:
  - charset UTF-8, viewport meta (width=device-width, initial-scale=1.0)
  - Descriptive <title>
  - Link to ALL CSS files listed above
  - AOS animation library CSS: <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
  - Google Fonts link for a modern font (e.g. Inter, Poppins, or Raleway)

Body content:
  - Professional STICKY nav bar with links to EVERY page listed above
    - href="index.html", href="about.html" etc. (relative hrefs, never absolute /)
    - Add class="active" to the current page's nav link
    - Include a hamburger button for mobile menu (works with app.js)
  - Rich, detailed, REAL content for this page — real text, real data, real copy
    - NO lorem ipsum, NO placeholder text, NO "coming soon"
  - Add data-aos="fade-up" (or fade-right, zoom-in, etc.) to sections/cards for scroll animations
  - Sections should include: hero, features/services, stats with real numbers, testimonials or team, CTA
  - Use semantic HTML5 tags: <header>, <nav>, <main>, <section>, <article>, <footer>
  - Each section should have an id for smooth-scroll anchor links

Before </body>:
  - Include ALL JS files listed above
  - AOS init script: <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    followed by: <script>AOS.init({ duration: 800, easing: 'ease-in-out', once: true });</script>

- Use ONLY relative paths — never absolute paths starting with /`;
};

// ─── Image data helper ────────────────────────────────────────────────────────
interface ImageData {
  base64: string;
  mimeType: string;
}

/** Build an OpenAI-compatible vision user message content array */
function openaiUserContent(text: string, img?: ImageData): any {
  if (!img) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" } },
  ];
}

/** Build a Claude vision user message content array */
function claudeUserContent(text: string, img?: ImageData): any {
  if (!img) return text;
  return [
    { type: "image", source: { type: "base64", media_type: img.mimeType as any, data: img.base64 } },
    { type: "text", text },
  ];
}

// ─── AI helpers ───────────────────────────────────────────────────────────────
async function planWithOpenAI(prompt: string, systemOverride?: string, img?: ImageData): Promise<Array<{name: string; description: string}>> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemOverride ?? PLANNER_SYSTEM },
      { role: "user", content: openaiUserContent(
          img ? `Instruction: ${prompt}\nIMPORTANT: The user has attached a reference image. Plan pages that match the style and content visible in the image.` : `Instruction: ${prompt}`,
          img
        ) },
    ],
  } as any);
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = repairAndParseJSON(raw);
  return parsed.files ?? [];
}

async function planWithClaude(prompt: string, systemOverride?: string, img?: ImageData): Promise<Array<{name: string; description: string}>> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemOverride ?? PLANNER_SYSTEM,
    messages: [{ role: "user", content: claudeUserContent(
      img ? `Instruction: ${prompt}\nIMPORTANT: The user has attached a reference image. Plan pages that match the style and content visible in the image.` : `Instruction: ${prompt}`,
      img
    ) }],
  });
  const block = message.content[0];
  const raw = block.type === "text" ? block.text : "{}";
  const parsed = repairAndParseJSON(raw);
  return parsed.files ?? [];
}

interface HtmlContext {
  cssFiles: string[];
  jsFiles: string[];
  allHtmlPages: Array<{ name: string; description: string }>;
}

async function generateFileWithOpenAI(
  fileName: string,
  description: string,
  prompt: string,
  htmlCtx?: HtmlContext,
  systemOverride?: string,
  img?: ImageData,
  prevContent?: string
): Promise<string> {
  const isHtml = fileName.endsWith(".html");
  const systemPrompt = systemOverride
    ?? (isHtml && htmlCtx
      ? HTML_SYSTEM(fileName, description, htmlCtx.cssFiles, htmlCtx.jsFiles, htmlCtx.allHtmlPages)
      : FILE_SYSTEM(fileName, description));

  // For reasoning models like gpt-5.2, put previous content in user message so it's always seen
  const prevBlock = prevContent
    ? `EXISTING CODE TO REFINE (preserve structure and design — apply only minimal requested changes):\n\`\`\`\n${prevContent.slice(0, 20000)}\n\`\`\`\n\n`
    : "";
  const imageNote = img ? "\nReference image attached — match its visual style, color palette, and layout." : "";
  const userText = `${prevBlock}Instruction: ${prompt}\nGenerate: ${fileName}${imageNote}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 32000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: openaiUserContent(userText, img) },
    ],
  } as any);
  const choice = completion.choices[0];
  const content = choice?.message?.content ?? "";
  console.log(`[OpenAI] ${fileName}: finish_reason=${choice?.finish_reason}, len=${content.length}`);
  if (!content) console.warn(`[OpenAI] WARNING: empty content for ${fileName}`, JSON.stringify(choice));
  return content;
}

async function generateFileWithClaude(
  fileName: string,
  description: string,
  prompt: string,
  htmlCtx?: HtmlContext,
  systemOverride?: string,
  img?: ImageData,
  prevContent?: string
): Promise<string> {
  const isHtml = fileName.endsWith(".html");
  const systemPrompt = systemOverride
    ?? (isHtml && htmlCtx
      ? HTML_SYSTEM(fileName, description, htmlCtx.cssFiles, htmlCtx.jsFiles, htmlCtx.allHtmlPages)
      : FILE_SYSTEM(fileName, description));

  const prevBlock = prevContent
    ? `EXISTING CODE TO REFINE (preserve structure and design — apply only minimal requested changes):\n\`\`\`\n${prevContent.slice(0, 20000)}\n\`\`\`\n\n`
    : "";
  const imageNote = img ? "\nReference image attached — match its visual style, color palette, and layout." : "";
  const userText = `${prevBlock}Instruction: ${prompt}\nGenerate: ${fileName}${imageNote}`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 32000,
        system: systemPrompt,
        messages: [{ role: "user", content: claudeUserContent(userText, img) }],
      });
      const block = message.content[0];
      const content = block.type === "text" ? block.text : "";
      console.log(`[Claude] ${fileName}: stop_reason=${message.stop_reason}, len=${content.length}, attempt=${attempt}`);
      if (!content) console.warn(`[Claude] WARNING: empty content for ${fileName}`);
      return content;
    } catch (err: any) {
      const isTransient = err?.status === 529 || err?.status === 503 || err?.status === 429 || err?.error?.type === "overloaded_error";
      console.warn(`[Claude] ${fileName} attempt ${attempt} failed: ${err?.message ?? err}`);
      if (attempt < MAX_RETRIES && isTransient) {
        const delay = attempt * 3000;
        console.log(`[Claude] Retrying ${fileName} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  return "";
}

async function planWithGroq(prompt: string, systemOverride?: string, img?: ImageData): Promise<Array<{name: string; description: string}>> {
  const completion = await groqClient.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemOverride ?? PLANNER_SYSTEM },
      { role: "user", content: openaiUserContent(
          img ? `Instruction: ${prompt}\nIMPORTANT: The user has attached a reference image. Plan pages that match the style and content visible in the image.` : `Instruction: ${prompt}`,
          img
        ) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = repairAndParseJSON(raw);
  return parsed.files ?? [];
}

async function generateFileWithGroq(
  fileName: string,
  description: string,
  prompt: string,
  htmlCtx?: HtmlContext,
  systemOverride?: string,
  img?: ImageData,
  prevContent?: string
): Promise<string> {
  const isHtml = fileName.endsWith(".html");
  const systemPrompt = systemOverride
    ?? (isHtml && htmlCtx
      ? HTML_SYSTEM(fileName, description, htmlCtx.cssFiles, htmlCtx.jsFiles, htmlCtx.allHtmlPages)
      : FILE_SYSTEM(fileName, description));

  const prevBlock = prevContent
    ? `EXISTING CODE TO REFINE (preserve structure and design — apply only minimal requested changes):\n\`\`\`\n${prevContent.slice(0, 20000)}\n\`\`\`\n\n`
    : "";
  const imageNote = img ? "\nReference image attached — match its visual style, color palette, and layout." : "";
  const userText = `${prevBlock}Instruction: ${prompt}\nGenerate: ${fileName}${imageNote}`;

  const completion = await groqClient.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 16000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: openaiUserContent(userText, img) },
    ],
  });
  const choice = completion.choices[0];
  const content = choice?.message?.content ?? "";
  console.log(`[Groq] ${fileName}: finish_reason=${choice?.finish_reason}, len=${content.length}`);
  if (!content) console.warn(`[Groq] WARNING: empty content for ${fileName}`, JSON.stringify(choice));
  return content;
}

// Fallback minimal HTML that links all project files — used if AI HTML generation fails.
function buildFallbackHtml(
  description: string,
  otherFiles: string[]
): string {
  const cssLinks = otherFiles
    .filter((f) => f.endsWith(".css"))
    .map((f) => `  <link rel="stylesheet" href="${f}">`)
    .join("\n");
  const jsScripts = otherFiles
    .filter((f) => f.endsWith(".js"))
    .map((f) => `  <script src="${f}"></script>`)
    .join("\n");
  const title = description.split(":")[0].trim().slice(0, 60) || "App";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${cssLinks}
</head>
<body>
${jsScripts}
</body>
</html>`;
}

function stripCodeFences(code: string): string {
  const trimmed = code.trim();
  // If the whole response is a fenced block, extract just the content
  const fenceMatch = trimmed.match(/^```[\w]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  // If there's a fence at start/end but not both (malformed), strip individually
  return trimmed
    .replace(/^```[\w]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ─── 1. Minify CSS + JS files ──────────────────────────────────────────────────
async function minifyProjectFiles(files: ProjectFile[]): Promise<ProjectFile[]> {
  return Promise.all(
    files.map(async (file) => {
      try {
        if (file.name.endsWith(".css")) {
          const out = new CleanCSS({ level: 2, returnPromise: false }).minify(file.content);
          if (out.styles && out.styles.length > 0) {
            console.log(`[minify] CSS ${file.name}: ${file.content.length} → ${out.styles.length} chars`);
            return { ...file, content: out.styles };
          }
        } else if (file.name.endsWith(".js")) {
          const result = await minifyJS(file.content, { compress: true, mangle: true });
          if (result.code && result.code.length > 0) {
            console.log(`[minify] JS ${file.name}: ${file.content.length} → ${result.code.length} chars`);
            return { ...file, content: result.code };
          }
        }
      } catch (e: any) {
        console.warn(`[minify] ${file.name} skipped: ${e?.message}`);
      }
      return file;
    })
  );
}

// ─── 2. WCAG contrast check ────────────────────────────────────────────────────
function checkWcagContrast(files: ProjectFile[]): void {
  const hexColorRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  const bgRe   = /background(?:-color)?\s*:\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi;
  const textRe = /(?<![a-z-])color\s*:\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi;

  function hexToRgb(h: string): [number, number, number] {
    const hex = h.replace("#", "");
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  function luminance([r, g, b]: [number, number, number]): number {
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(a: string, b: string): number {
    const la = luminance(hexToRgb(a)) + 0.05;
    const lb = luminance(hexToRgb(b)) + 0.05;
    return la > lb ? la / lb : lb / la;
  }

  for (const file of files) {
    if (!file.name.endsWith(".css")) continue;
    const bgs: string[] = [];
    const colors: string[] = [];
    let m: RegExpExecArray | null;
    bgRe.lastIndex = 0; textRe.lastIndex = 0;
    while ((m = bgRe.exec(file.content)) !== null)   bgs.push(m[1]);
    while ((m = textRe.exec(file.content)) !== null) colors.push(m[1]);

    for (const bg of bgs) {
      for (const fg of colors) {
        const ratio = contrastRatio(bg, fg);
        if (ratio < 4.5) {
          console.warn(`[wcag] ${file.name}: contrast ${fg} on ${bg} = ${ratio.toFixed(2)} (min 4.5)`);
        }
      }
    }
  }
}

// ─── 3. Groq AI auto-fix HTML ─────────────────────────────────────────────────
async function autoFixHtmlFiles(files: ProjectFile[]): Promise<ProjectFile[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.name.endsWith(".html")) return file;

      const MAX_CHARS = 12000;
      const snippet = file.content.slice(0, MAX_CHARS);
      const truncated = file.content.length > MAX_CHARS;

      try {
        const completion = await groqClient.chat.completions.create({
          model: GROQ_MODEL,
          max_tokens: 16000,
          messages: [
            {
              role: "system",
              content: [
                "You are an expert frontend developer and HTML/CSS/JS validator.",
                "Your task: carefully review the given HTML file and fix ONLY real errors:",
                "- Unclosed or mismatched HTML tags",
                "- Broken inline <script> or <style> blocks (syntax errors in JS/CSS)",
                "- Missing DOCTYPE, <html>, <head>, or <body> tags",
                "- Broken attribute values (quotes not closed, malformed URLs)",
                "Do NOT change working code, styles, or logic. Do NOT add new features.",
                "If the code has NO errors, return it UNCHANGED.",
                "Return ONLY the corrected HTML code — no explanations, no markdown fences.",
              ].join(" "),
            },
            {
              role: "user",
              content: truncated
                ? `[NOTE: File was truncated to ${MAX_CHARS} chars for review]\n\n${snippet}`
                : snippet,
            },
          ],
        });

        const fixed = completion.choices[0]?.message?.content?.trim() ?? "";
        const cleaned = stripCodeFences(fixed);

        if (!cleaned || cleaned.length < 100) {
          console.warn(`[autofix] ${file.name}: Groq returned empty/tiny response, keeping original`);
          return file;
        }

        if (truncated) {
          console.log(`[autofix] ${file.name}: file was truncated — keeping original to avoid partial overwrite`);
          return file;
        }

        const gain = file.content.length - cleaned.length;
        console.log(`[autofix] ${file.name}: fixed (${gain > 0 ? `-${gain}` : `+${-gain}`} chars)`);
        return { ...file, content: cleaned };
      } catch (e: any) {
        console.warn(`[autofix] ${file.name} skipped: ${e?.message}`);
        return file;
      }
    })
  );
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

// ─── Build style-personalised prompt suffix ───────────────────────────────────
function buildStyleSuffix(style: Record<string, any> | null | undefined): string {
  if (!style || Object.keys(style).length === 0) return "";
  const parts: string[] = [];
  if (Array.isArray(style.colors) && style.colors.length > 0) {
    parts.push(`Color palette: ${style.colors.join(", ")}`);
  }
  if (style.font) parts.push(`Typography: ${style.font}`);
  if (style.layout) parts.push(`Layout style: ${style.layout}`);
  if (style.mood) parts.push(`Mood/tone: ${style.mood}`);
  if (parts.length === 0) return "";
  return `\n\nUSER STYLE PREFERENCES (respect these when choosing colors, fonts, and layout):\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

// ─── Main generation pipeline ─────────────────────────────────────────────────
async function runGeneration(
  taskId: string,
  userId: number,
  prompt: string,
  model: "openai" | "claude" | "groq",
  prevGen?: PreviousGeneration,
  img?: ImageData,
  refineFromId?: number
) {
  try {
    // Step 0: Load user style preferences for personalization
    let stylePromptSuffix = "";
    try {
      const [userRow] = await db
        .select({ stylePreferences: usersTable.stylePreferences })
        .from(usersTable)
        .where(eq(usersTable.id, userId));
      stylePromptSuffix = buildStyleSuffix(userRow?.stylePreferences as any);
      if (stylePromptSuffix) {
        console.log(`[style] Personalizing generation for user ${userId}`);
      }
    } catch (e: any) {
      console.warn("[style] Could not load style preferences:", e?.message);
    }

    const personalizedPrompt = prompt + stylePromptSuffix;

    // Step 1: Plan — use refinement planner when previous context exists
    tasks.set(taskId, { ...tasks.get(taskId)!, status: "planning" });

    const plannerSystemOverride = prevGen ? REFINE_PLANNER_SYSTEM(prevGen) : undefined;

    // For reasoning models (GPT-5.2), system messages are deprioritised — embed
    // the previous-site context in the user message as well so it is always seen.
    const plannerPrompt = prevGen
      ? `EXISTING SITE TO REFINE:\n- Original description: "${prevGen.prompt}"\n- Existing files: ${prevGen.files.map((f) => `${f.name}${f.description ? ` (${f.description})` : ""}`).join(", ")}\n\nRefinement instruction: ${personalizedPrompt}`
      : personalizedPrompt;

    const plan = model === "claude"
      ? await planWithClaude(plannerPrompt, plannerSystemOverride, img)
      : model === "groq"
      ? await planWithGroq(plannerPrompt, plannerSystemOverride, img)
      : await planWithOpenAI(plannerPrompt, plannerSystemOverride, img);

    if (!plan.length) throw new Error("Planner returned no files");

    // Step 2: Generate each file
    // Generate non-HTML files first, then HTML last.
    const htmlFiles = plan.filter((f) => f.name.endsWith(".html"));
    const nonHtmlFiles = plan.filter((f) => !f.name.endsWith(".html"));
    const orderedPlan = [...nonHtmlFiles, ...htmlFiles];

    tasks.set(taskId, {
      ...tasks.get(taskId)!,
      status: "building",
      filesTotal: orderedPlan.length,
      filesDone: 0,
      filePlan: orderedPlan,
      completedFiles: [],
      currentFile: orderedPlan[0]?.name,
    });

    const generatedFiles: ProjectFile[] = [];

    // Pre-compute which files are CSS, JS, and HTML pages for each HTML generator
    const cssFiles = orderedPlan.filter((f) => f.name.endsWith(".css")).map((f) => f.name);
    const jsFiles = orderedPlan.filter((f) => f.name.endsWith(".js")).map((f) => f.name);
    const allHtmlPages = orderedPlan.filter((f) => f.name.endsWith(".html"));
    const htmlCtx: HtmlContext = { cssFiles, jsFiles, allHtmlPages };

    for (const file of orderedPlan) {
      // Mark this file as currently being generated
      tasks.set(taskId, {
        ...tasks.get(taskId)!,
        currentFile: file.name,
      });

      // When refining, build a custom system prompt + pass previous content to user message
      const isHtml = file.name.endsWith(".html");
      const prevFileContent = prevGen?.files.find((f) => f.name === file.name)?.content;

      let systemOverride: string | undefined;
      if (prevGen) {
        systemOverride = isHtml
          ? REFINE_HTML_SYSTEM(file.name, file.description, prevGen.prompt, cssFiles, jsFiles, allHtmlPages)
          : REFINE_FILE_SYSTEM(file.name, file.description, prevGen.prompt);
      }

      // Use the system override when available; pass prevFileContent into user message so
      // all models (including GPT-5.2 reasoning) always see the existing code to refine.
      const ctx = isHtml ? htmlCtx : undefined;
      let rawContent = "";
      try {
        rawContent = model === "claude"
          ? await generateFileWithClaude(file.name, file.description, personalizedPrompt, ctx, systemOverride, img, prevFileContent)
          : model === "groq"
          ? await generateFileWithGroq(file.name, file.description, personalizedPrompt, ctx, systemOverride, img, prevFileContent)
          : await generateFileWithOpenAI(file.name, file.description, personalizedPrompt, ctx, systemOverride, img, prevFileContent);
      } catch (fileErr: any) {
        console.error(`[generator] File ${file.name} generation failed (${fileErr?.message ?? fileErr}), using fallback`);
        rawContent = "";
      }

      let content = stripCodeFences(rawContent);

      // Fallback: if HTML generation still returns empty, build a minimal linking shell.
      if (!content && file.name.endsWith(".html")) {
        console.warn(`[generator] Using fallback HTML for ${file.name}`);
        const allOtherFileNames = orderedPlan.filter((f) => f.name !== file.name).map((f) => f.name);
        content = buildFallbackHtml(file.description, allOtherFileNames);
      }

      generatedFiles.push({
        name: file.name,
        description: file.description,
        content,
      });

      const prev = tasks.get(taskId)!;
      tasks.set(taskId, {
        ...prev,
        filesDone: generatedFiles.length,
        completedFiles: [...(prev.completedFiles ?? []), file.name],
        currentFile: orderedPlan[generatedFiles.length]?.name,
      });
    }

    // Step 3: Post-process generated files:
    //   3a. Minify CSS + JS (smaller output, faster load)
    //   3b. WCAG contrast check (log warnings for low-contrast colour pairs)
    //   3c. Groq AI auto-fix HTML (correct structural / syntax errors)
    tasks.set(taskId, { ...tasks.get(taskId)!, status: "postprocessing" as any });
    let processedFiles = await minifyProjectFiles(generatedFiles);
    checkWcagContrast(processedFiles);
    processedFiles = await autoFixHtmlFiles(processedFiles);

    // Step 4: Build self-contained preview HTML by inlining all project CSS/JS.
    // The preview uses srcDoc which has no base URL, so external file references
    // like <link href="styles.css"> would silently fail without this step.
    const htmlFile = processedFiles.find((f) => f.name.endsWith(".html"));
    const rawHtml = ensureFullHtml(htmlFile?.content ?? "<html><body><p>No HTML file generated</p></body></html>");
    const previewHtml = inlineAssetsIntoHtml(rawHtml, processedFiles);

    // Step 4: Save to DB — update existing row when refining, insert when new
    let generation: typeof generationsTable.$inferSelect;
    if (refineFromId) {
      const [updated] = await db
        .update(generationsTable)
        .set({ prompt, html: previewHtml, files: processedFiles })
        .where(and(eq(generationsTable.id, refineFromId), eq(generationsTable.userId, userId)))
        .returning();
      generation = updated;
    } else {
      const [inserted] = await db
        .insert(generationsTable)
        .values({ prompt, html: previewHtml, userId, files: processedFiles })
        .returning();
      generation = inserted;
    }

    tasks.set(taskId, {
      status: "done",
      generationId: generation.id,
      html: generation.html,
      prompt: generation.prompt,
      files: processedFiles,
      filesTotal: plan.length,
      filesDone: plan.length,
      createdAt: Date.now(),
    });

    // Deduct 1 credit (free users only, not on refinements)
    if (!refineFromId) {
      useCredit(userId).catch((e: any) =>
        console.warn("[credits] Failed to deduct credit:", e?.message)
      );
    }

    // Append prompt to user's history (fire-and-forget, don't block)
    db.select({ promptHistory: usersTable.promptHistory })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then(([row]) => {
        const history: Array<{ prompt: string; date: string }> = Array.isArray(row?.promptHistory) ? row.promptHistory : [];
        const updated = [{ prompt: prompt.slice(0, 300), date: new Date().toISOString() }, ...history].slice(0, 50);
        return db.update(usersTable).set({ promptHistory: updated } as any).where(eq(usersTable.id, userId));
      })
      .catch((e: any) => console.warn("[style] Failed to save prompt history:", e?.message));

  } catch (err: any) {
    const detail = err?.message ?? String(err);
    const stack = err?.stack ?? "";
    console.error("Generation task failed:", detail, stack);
    tasks.set(taskId, {
      status: "error",
      error: `Generation failed: ${detail}`,
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

  const { prompt, model = "openai", refineFromId, imageBase64, imageMimeType } = parsed.data;
  const img: ImageData | undefined = imageBase64 && imageMimeType ? { base64: imageBase64, mimeType: imageMimeType } : undefined;
  const userId = req.session.userId;

  // Always read plan fresh from DB so admin upgrades take effect without re-login
  const [userRow] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const plan = userRow?.plan ?? req.session.plan ?? "free";
  req.session.plan = plan; // keep session in sync

  // ── Prompt cache: return existing generation for same prompt ────────────────
  // Skip cache entirely when refining — we must generate fresh to apply changes.
  if (plan === "free" && !refineFromId) {
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

  // ── Credit check (skip for refinements — refinement doesn't cost a credit) ─
  if (!refineFromId) {
    const creditResult = await checkCredits(userId);
    if (!creditResult.allowed) {
      res.status(403).json({
        error: "no_credits",
        message: creditResult.reason,
        credits: creditResult.credits,
      });
      return;
    }
  }

  // ── Load previous generation for refinement mode ─────────────────────────
  let prevGen: PreviousGeneration | undefined;
  if (refineFromId) {
    const [prev] = await db
      .select()
      .from(generationsTable)
      .where(and(eq(generationsTable.id, refineFromId), eq(generationsTable.userId, userId)))
      .limit(1);

    if (prev) {
      const prevFiles = (prev.files as ProjectFile[]) ?? [{ name: "index.html", content: prev.html, description: "Main page" }];
      prevGen = { prompt: prev.prompt, files: prevFiles };
    }
  }

  // ── Create task and start background generation ────────────────────────────
  const taskId = randomUUID();
  tasks.set(taskId, { status: "pending", createdAt: Date.now() });

  runGeneration(taskId, userId, prompt, model, prevGen, img, refineFromId);

  res.json({ taskId, cached: false, isRefinement: !!prevGen });
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
      filePlan: task.filePlan ?? null,
      completedFiles: task.completedFiles ?? [],
      currentFile: task.currentFile ?? null,
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

// ─── GET /project/:id/:filename — serve individual project file ───────────────
router.get("/project/:id/:filename", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const filename = req.params.filename as string;

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

    const projectFiles: ProjectFile[] = (generation.files as ProjectFile[]) ?? [
      { name: "index.html", content: generation.html },
    ];

    const file = projectFiles.find((f) => f.name === filename);
    if (!file) {
      res.status(404).send(`<html><body><h1>File "${filename}" not found</h1></body></html>`);
      return;
    }

    if (filename.endsWith(".html")) {
      // Inject <base href> so relative links between pages resolve correctly
      const baseTag = `<base href="/api/project/${id}/">`;
      const content = file.content.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.send(content);
    } else if (filename.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.send(file.content);
    } else if (filename.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.send(file.content);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(file.content);
    }
  } catch (err) {
    console.error("Serve file error:", String(err));
    res.status(500).send("<html><body>Error loading file</body></html>");
  }
});

// ─── GET /project/:id — serve raw HTML ────────────────────────────────────────
router.get("/project/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
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
