import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, LayoutTemplate, Monitor, Sparkles,
  ExternalLink, Download, FileCode2, Layers, Code2, Eye, Globe,
  Rocket, X, Link, Crown, Blocks, MessageSquare, Wrench, Send,
  ChevronDown, ChevronUp, Bot, TrendingUp, Search, Lightbulb,
  GripVertical, Plus, Trash2, PanelTop,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CodeEditor } from "@/components/CodeEditor";
import type { GenerationProgress, GenerationResult } from "@/hooks/use-builder";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BrowserPreviewProps {
  html: string | null;
  isLoading: boolean;
  currentId?: number;
  progress: GenerationProgress;
  currentFiles?: GenerationResult["files"];
  onHtmlChange?: (html: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  pending:         "Starting...",
  planning:        "Planning project structure...",
  building:        "Generating files...",
  postprocessing:  "Optimizing & validating...",
  done:            "Done!",
  error:           "Error",
};

type ViewMode = "preview" | "editor";

// ── Section Builder templates ─────────────────────────────────────────────────
const SECTION_TEMPLATES: Record<string, { name: string; icon: string; html: string }> = {
  hero: {
    name: "Hero", icon: "🦸",
    html: `<section style="padding:80px 40px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);text-align:center;color:white;font-family:sans-serif"><h1 style="font-size:2.5rem;margin:0 0 16px;font-weight:800">Your Headline Here</h1><p style="font-size:1.1rem;opacity:.8;max-width:600px;margin:0 auto 32px">A short description of your product or service. Make it compelling and clear.</p><a href="#" style="display:inline-block;background:#6d28d9;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">Get Started →</a></section>`,
  },
  features: {
    name: "Features", icon: "⭐",
    html: `<section style="padding:64px 40px;background:#f9fafb;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Features</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:960px;margin:0 auto"><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07)"><div style="font-size:2rem;margin-bottom:12px">⚡</div><h3 style="font-weight:700;margin:0 0 8px;color:#111">Lightning Fast</h3><p style="color:#666;font-size:.9rem;margin:0">Blazing performance for the best user experience.</p></div><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07)"><div style="font-size:2rem;margin-bottom:12px">🔒</div><h3 style="font-weight:700;margin:0 0 8px;color:#111">Secure</h3><p style="color:#666;font-size:.9rem;margin:0">Enterprise-grade security built right in.</p></div><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07)"><div style="font-size:2rem;margin-bottom:12px">📊</div><h3 style="font-weight:700;margin:0 0 8px;color:#111">Analytics</h3><p style="color:#666;font-size:.9rem;margin:0">Detailed insights and powerful reporting tools.</p></div><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07)"><div style="font-size:2rem;margin-bottom:12px">🎨</div><h3 style="font-weight:700;margin:0 0 8px;color:#111">Customizable</h3><p style="color:#666;font-size:.9rem;margin:0">Tailor every aspect to fit your brand perfectly.</p></div></div></section>`,
  },
  pricing: {
    name: "Pricing", icon: "💰",
    html: `<section style="padding:64px 40px;background:white;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Simple Pricing</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:820px;margin:0 auto"><div style="border:1px solid #e5e7eb;padding:32px 24px;border-radius:16px;text-align:center"><h3 style="font-weight:700;color:#111;margin:0 0 8px">Basic</h3><div style="font-size:2.5rem;font-weight:800;color:#6d28d9;margin-bottom:16px">$9<span style="font-size:1rem;color:#888;font-weight:400">/mo</span></div><ul style="list-style:none;padding:0;margin:0 0 24px;color:#555;font-size:.9rem;display:flex;flex-direction:column;gap:8px"><li>✓ 10 projects</li><li>✓ 5GB storage</li><li>✓ Email support</li></ul><a href="#" style="display:block;background:#6d28d9;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:700">Get started</a></div><div style="border:2px solid #6d28d9;padding:32px 24px;border-radius:16px;text-align:center;background:#f5f3ff;position:relative"><div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6d28d9;color:white;font-size:.75rem;padding:4px 14px;border-radius:20px;font-weight:700">POPULAR</div><h3 style="font-weight:700;color:#111;margin:0 0 8px">Pro</h3><div style="font-size:2.5rem;font-weight:800;color:#6d28d9;margin-bottom:16px">$29<span style="font-size:1rem;color:#888;font-weight:400">/mo</span></div><ul style="list-style:none;padding:0;margin:0 0 24px;color:#555;font-size:.9rem;display:flex;flex-direction:column;gap:8px"><li>✓ Unlimited projects</li><li>✓ 50GB storage</li><li>✓ Priority support</li></ul><a href="#" style="display:block;background:#6d28d9;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:700">Get started</a></div><div style="border:1px solid #e5e7eb;padding:32px 24px;border-radius:16px;text-align:center"><h3 style="font-weight:700;color:#111;margin:0 0 8px">Enterprise</h3><div style="font-size:2.5rem;font-weight:800;color:#6d28d9;margin-bottom:16px">$99<span style="font-size:1rem;color:#888;font-weight:400">/mo</span></div><ul style="list-style:none;padding:0;margin:0 0 24px;color:#555;font-size:.9rem;display:flex;flex-direction:column;gap:8px"><li>✓ Everything in Pro</li><li>✓ Dedicated support</li><li>✓ Custom integrations</li></ul><a href="#" style="display:block;background:#6d28d9;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:700">Contact sales</a></div></div></section>`,
  },
  testimonials: {
    name: "Testimonials", icon: "💬",
    html: `<section style="padding:64px 40px;background:#f9fafb;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">What People Say</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;max-width:960px;margin:0 auto"><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><p style="color:#555;margin:0 0 16px;font-style:italic;font-size:.95rem">"Absolutely amazing product. It changed how our whole team works."</p><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:#6d28d9;display:flex;align-items:center;justify-content:center;color:white;font-weight:700">A</div><div><div style="font-weight:700;color:#111">Anna K.</div><div style="color:#888;font-size:.8rem">CEO, StartupXYZ</div></div></div></div><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><p style="color:#555;margin:0 0 16px;font-style:italic;font-size:.95rem">"The best tool I've used in years. Highly recommended!"</p><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:#059669;display:flex;align-items:center;justify-content:center;color:white;font-weight:700">M</div><div><div style="font-weight:700;color:#111">Marek S.</div><div style="color:#888;font-size:.8rem">Founder, Agency</div></div></div></div><div style="background:white;padding:28px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><p style="color:#555;margin:0 0 16px;font-style:italic;font-size:.95rem">"Incredible support and incredible results within the first week."</p><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:#ea580c;display:flex;align-items:center;justify-content:center;color:white;font-weight:700">L</div><div><div style="font-weight:700;color:#111">Lisa T.</div><div style="color:#888;font-size:.8rem">Marketing Director</div></div></div></div></div></section>`,
  },
  contact: {
    name: "Contact", icon: "📞",
    html: `<section style="padding:64px 40px;background:white;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Contact Us</h2><form style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:16px" onsubmit="event.preventDefault()"><input placeholder="Your Name" style="padding:13px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;transition:border-color .2s" onfocus="this.style.borderColor='#6d28d9'" onblur="this.style.borderColor='#e5e7eb'"><input type="email" placeholder="Email Address" style="padding:13px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;transition:border-color .2s" onfocus="this.style.borderColor='#6d28d9'" onblur="this.style.borderColor='#e5e7eb'"><input placeholder="Subject" style="padding:13px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;transition:border-color .2s" onfocus="this.style.borderColor='#6d28d9'" onblur="this.style.borderColor='#e5e7eb'"><textarea rows="4" placeholder="Your Message" style="padding:13px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;resize:vertical;transition:border-color .2s;font-family:inherit" onfocus="this.style.borderColor='#6d28d9'" onblur="this.style.borderColor='#e5e7eb'"></textarea><button type="submit" style="background:#6d28d9;color:white;padding:14px;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer">Send Message ✉️</button></form></section>`,
  },
  faq: {
    name: "FAQ", icon: "❓",
    html: `<section style="padding:64px 40px;background:#f9fafb;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Frequently Asked Questions</h2><div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px"><details style="background:white;padding:20px 24px;border-radius:12px;border:1px solid #e5e7eb;cursor:pointer"><summary style="font-weight:700;font-size:1rem;color:#111;list-style:none;display:flex;justify-content:space-between;align-items:center">What is included in the free plan? <span style="font-size:1.2rem">+</span></summary><p style="margin:12px 0 0;color:#555;font-size:.95rem;line-height:1.6">The free plan includes up to 10 projects, 5GB of storage, and community support with a 99.9% uptime SLA.</p></details><details style="background:white;padding:20px 24px;border-radius:12px;border:1px solid #e5e7eb;cursor:pointer"><summary style="font-weight:700;font-size:1rem;color:#111;list-style:none;display:flex;justify-content:space-between;align-items:center">Can I upgrade or cancel at any time? <span style="font-size:1.2rem">+</span></summary><p style="margin:12px 0 0;color:#555;font-size:.95rem;line-height:1.6">Yes, you can upgrade, downgrade, or cancel your subscription at any time directly from your account dashboard.</p></details><details style="background:white;padding:20px 24px;border-radius:12px;border:1px solid #e5e7eb;cursor:pointer"><summary style="font-weight:700;font-size:1rem;color:#111;list-style:none;display:flex;justify-content:space-between;align-items:center">Do you offer a money-back guarantee? <span style="font-size:1.2rem">+</span></summary><p style="margin:12px 0 0;color:#555;font-size:.95rem;line-height:1.6">We offer a 30-day money-back guarantee on all paid plans, no questions asked.</p></details><details style="background:white;padding:20px 24px;border-radius:12px;border:1px solid #e5e7eb;cursor:pointer"><summary style="font-weight:700;font-size:1rem;color:#111;list-style:none;display:flex;justify-content:space-between;align-items:center">Is my data secure? <span style="font-size:1.2rem">+</span></summary><p style="margin:12px 0 0;color:#555;font-size:.95rem;line-height:1.6">Absolutely. All data is encrypted at rest and in transit using AES-256 and TLS 1.3.</p></details></div></section>`,
  },
  team: {
    name: "Team", icon: "🧑‍💼",
    html: `<section style="padding:64px 40px;background:white;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Meet the Team</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px;max-width:900px;margin:0 auto;text-align:center"><div><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#7c3aed);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem">👨‍💼</div><h3 style="font-weight:700;margin:0 0 4px;color:#111">John Smith</h3><p style="color:#6d28d9;font-size:.9rem;margin:0 0 8px;font-weight:600">CEO & Co-founder</p><p style="color:#777;font-size:.85rem;margin:0">10+ years building great products.</p></div><div><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem">👩‍💻</div><h3 style="font-weight:700;margin:0 0 4px;color:#111">Sarah Lee</h3><p style="color:#059669;font-size:.9rem;margin:0 0 8px;font-weight:600">CTO & Co-founder</p><p style="color:#777;font-size:.85rem;margin:0">Full-stack engineer, open-source advocate.</p></div><div><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#ea580c,#f97316);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem">🎨</div><h3 style="font-weight:700;margin:0 0 4px;color:#111">Alex Kim</h3><p style="color:#ea580c;font-size:.9rem;margin:0 0 8px;font-weight:600">Head of Design</p><p style="color:#777;font-size:.85rem;margin:0">Turning ideas into pixel-perfect designs.</p></div></div></section>`,
  },
  gallery: {
    name: "Gallery", icon: "📷",
    html: `<section style="padding:64px 40px;background:#f9fafb;font-family:sans-serif"><h2 style="text-align:center;font-size:2rem;font-weight:800;margin:0 0 40px;color:#111">Gallery</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;max-width:960px;margin:0 auto"><div style="background:#e5e7eb;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">🖼️</div><div style="background:#ddd6fe;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">🎨</div><div style="background:#d1fae5;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">📸</div><div style="background:#fee2e2;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">🌟</div><div style="background:#fef3c7;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">💡</div><div style="background:#e0f2fe;border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3rem;overflow:hidden">🚀</div></div></section>`,
  },
  footer: {
    name: "Footer", icon: "🦶",
    html: `<footer style="padding:48px 40px 24px;background:#111;color:white;font-family:sans-serif"><div style="max-width:960px;margin:0 auto"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px"><div><h3 style="font-weight:800;font-size:1.2rem;margin:0 0 12px">YourBrand</h3><p style="color:#9ca3af;font-size:.9rem;line-height:1.6;margin:0 0 16px">Building great products for great people. Join thousands of satisfied customers.</p></div><div><h4 style="font-weight:700;margin:0 0 12px;color:white">Product</h4><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Features</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Pricing</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Changelog</a></li></ul></div><div><h4 style="font-weight:700;margin:0 0 12px;color:white">Company</h4><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">About</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Blog</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Careers</a></li></ul></div><div><h4 style="font-weight:700;margin:0 0 12px;color:white">Support</h4><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Help Center</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Contact</a></li><li><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.9rem">Privacy</a></li></ul></div></div><div style="border-top:1px solid #374151;padding-top:24px;text-align:center;color:#6b7280;font-size:.85rem">© 2024 YourBrand. All rights reserved.</div></div></footer>`,
  },
};

const STRUCTURAL_TAGS = new Set(["section", "header", "footer", "nav", "main", "article"]);

function parseStructuralSections(html: string): Array<{ name: string; tag: string; idx: number; preview: string }> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const children = Array.from(doc.body.children);
    const result: Array<{ name: string; tag: string; idx: number; preview: string }> = [];
    children.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      if (!STRUCTURAL_TAGS.has(tag) && !(tag === "div" && (el.id || el.className))) return;
      const h = el.querySelector("h1, h2, h3");
      const label = h?.textContent?.trim().slice(0, 36) ?? el.id ?? `${tag} ${result.length + 1}`;
      result.push({ name: label, tag, idx, preview: el.outerHTML.slice(0, 60) });
    });
    return result;
  } catch {
    return [];
  }
}

export function BrowserPreview({
  html,
  isLoading,
  currentId,
  progress,
  currentFiles,
  onHtmlChange,
}: BrowserPreviewProps) {
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [liveHtml, setLiveHtml] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<string>("index.html");
  const [publishState, setPublishState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // WordPress publish state
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpState, setWpState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [wpUrl, setWpUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpTitle, setWpTitle] = useState("AI Page");
  const [wpPublishedUrl, setWpPublishedUrl] = useState<string | null>(null);
  const [wpError, setWpError] = useState<string | null>(null);

  // ── AI Chat state ──
  const [showChat, setShowChat] = useState(false);
  type ChatMsg = { role: "user" | "ai" | "agent-step"; text: string; step?: number; total?: number };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── SEO state ──
  const [showSeo, setShowSeo] = useState(false);
  const [seoKeyword, setSeoKeyword] = useState("");
  const [seoState, setSeoState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [seoSuggestState, setSeoSuggestState] = useState<"idle" | "loading">("idle");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);

  // ── Section Builder state ──
  const [showSections, setShowSections] = useState(false);
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const projectUrl = currentId ? `${BASE}/api/project/${currentId}` : null;
  const zipUrl     = currentId ? `${BASE}/api/project/${currentId}/zip` : null;

  // The URL used for the iframe src (for saved multi-page projects).
  // During loading we never use iframeSrc — we wait for data to arrive first.
  const iframeSrc = currentId && !liveHtml && !isLoading && html
    ? `${BASE}/api/project/${currentId}/index.html`
    : null;

  // When generating a new project, reset view and page state
  React.useEffect(() => {
    if (isLoading) {
      setViewMode("preview");
      setLiveHtml(null);
      setCurrentPage("index.html");
    }
  }, [isLoading]);

  // When a new project finishes, reset to index.html
  React.useEffect(() => {
    if (currentId && !isLoading) {
      setCurrentPage("index.html");
      setLiveHtml(null);
    }
  }, [currentId]);

  // Track the current page as the iframe navigates
  const handleIframeLoad = useCallback(() => {
    try {
      const pathname = iframeRef.current?.contentWindow?.location?.pathname ?? "";
      const match = pathname.match(/\/([^/]+\.html)$/);
      if (match) setCurrentPage(match[1]);
    } catch {
      // cross-origin guard — safe to ignore
    }
  }, []);

  // liveHtml overrides the server html after in-editor changes
  const displayHtml = liveHtml ?? html;

  const handlePreviewUpdate = (newHtml: string) => {
    setLiveHtml(newHtml);
    onHtmlChange?.(newHtml);
  };

  const handleCopy = () => {
    if (!displayHtml) return;
    navigator.clipboard.writeText(displayHtml);
    setCopied(true);
    toast({ title: "Copied!", description: "HTML code copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInTab = () => {
    if (projectUrl) window.open(projectUrl, "_blank");
  };

  const handleDownloadZip = () => {
    if (!zipUrl) return;
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = `nexus-project-${currentId}.zip`;
    a.click();
    toast({ title: "Downloading ZIP...", description: "All project files bundled and downloading." });
  };

  const handlePublish = async () => {
    if (!currentId || publishState === "loading") return;
    setPublishState("loading");
    setPublishedUrl(null);
    setShowPublishModal(true);

    try {
      const res = await fetch(`${BASE}/api/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ generationId: currentId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "netlify_not_configured") {
          setPublishState("error");
          setPublishedUrl("__not_configured__");
        } else if (data.error === "publish_limit" || data.error === "no_credits") {
          setPublishState("error");
          setPublishedUrl("__publish_limit__");
        } else {
          throw new Error(data.message ?? data.error ?? "Deploy failed");
        }
        return;
      }

      setPublishedUrl(data.url);
      setPublishState("done");
    } catch (err: any) {
      setPublishState("error");
      setPublishedUrl(null);
      toast({ title: "Publish failed", description: err?.message ?? "Unexpected error", variant: "destructive" });
    }
  };

  const handlePublishWP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentId || wpState === "loading") return;
    setWpState("loading");
    setWpPublishedUrl(null);
    setWpError(null);
    try {
      const res = await fetch(`${BASE}/api/deploy-wp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ generationId: currentId, wpUrl, wpUser, wpAppPassword: wpPassword, title: wpTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "publish_limit" || data.error === "no_credits") {
          setWpError("No credits left 💸 — upgrade to PRO for unlimited publishing.");
        } else {
          setWpError(data.message ?? "Błąd publikacji");
        }
        setWpState("error");
        return;
      }
      setWpPublishedUrl(data.url);
      setWpState("done");
    } catch (err: any) {
      setWpError(err?.message ?? "Nieoczekiwany błąd");
      setWpState("error");
    }
  };

  // ── AI Chat helpers ──
  const currentHtml = liveHtml ?? html ?? "";

  const sendChatMessage = async (msg: string, mode: "chat" | "fix" = "chat") => {
    if (!msg.trim() || !currentHtml || chatLoading) return;

    const userMsg: ChatMsg = { role: "user", text: msg };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, html: currentHtml, mode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat error");

      const aiMsg: ChatMsg = { role: "ai", text: data.reply };
      setChatMessages((prev) => [...prev, aiMsg]);

      if (mode === "fix" && data.fixedHtml) {
        setLiveHtml(data.fixedHtml);
        onHtmlChange?.(data.fixedHtml);
        toast({ title: "Code fixed!", description: "The AI applied fixes to your page." });
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: `❌ Error: ${err.message ?? String(err)}` },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const handleFixCode = () => {
    sendChatMessage("Fix all bugs and improve the code quality.", "fix");
  };

  const handleRunAgent = async (iterations = 2) => {
    if (!currentHtml || agentRunning || chatLoading) return;

    setAgentRunning(true);
    setShowChat(true);

    const startMsg: ChatMsg = {
      role: "ai",
      text: `🤖 **AI Agent started** — running ${iterations} analyze→fix iterations on your code…`,
    };
    setChatMessages((prev) => [...prev, startMsg]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`${BASE}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: currentHtml, iterations }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent error");

      // Append each step as a separate message
      const stepMsgs: ChatMsg[] = data.steps.map((s: { step: number; issues: string }) => ({
        role: "agent-step" as const,
        text: s.issues,
        step: s.step,
        total: data.steps.length,
      }));

      const doneMsg: ChatMsg = {
        role: "ai",
        text: `✅ **Agent finished** — applied ${data.steps.length} round${data.steps.length > 1 ? "s" : ""} of fixes. Preview updated!`,
      };

      setChatMessages((prev) => [...prev, ...stepMsgs, doneMsg]);

      if (data.finalHTML) {
        setLiveHtml(data.finalHTML);
        onHtmlChange?.(data.finalHTML);
        toast({ title: "Agent done!", description: `${data.steps.length} iterations completed and applied.` });
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: `❌ Agent error: ${err.message ?? String(err)}` },
      ]);
    } finally {
      setAgentRunning(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  // ── SEO handlers ──
  const handleSeoOptimize = async () => {
    if (!currentHtml || !seoKeyword.trim() || seoState === "loading") return;
    setSeoState("loading");
    try {
      const res = await fetch(`${BASE}/api/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: currentHtml, keyword: seoKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SEO optimization failed");
      setLiveHtml(data.html);
      onHtmlChange?.(data.html);
      setSeoState("done");
      toast({ title: "SEO optimized!", description: `Page optimized for "${seoKeyword}"` });
    } catch (err: any) {
      setSeoState("error");
      toast({ title: "SEO failed", description: err.message ?? "Unexpected error", variant: "destructive" });
    }
  };

  const handleSeoSuggest = async () => {
    if (!currentHtml || seoSuggestState === "loading") return;
    setSeoSuggestState("loading");
    setSeoKeywords([]);
    try {
      const res = await fetch(`${BASE}/api/seo/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html: currentHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Keyword generation failed");
      setSeoKeywords(data.keywords ?? []);
    } catch (err: any) {
      toast({ title: "Keyword suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setSeoSuggestState("idle");
    }
  };

  // ── Section Builder handlers ──
  const handleAddSection = (type: string) => {
    const tpl = SECTION_TEMPLATES[type];
    if (!tpl) return;
    const base = currentHtml || "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Page</title></head><body></body></html>";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(base, "text/html");
      const temp = doc.createElement("div");
      temp.innerHTML = tpl.html;
      while (temp.firstChild) doc.body.appendChild(temp.firstChild);
      const newHtml = doc.documentElement.outerHTML;
      setLiveHtml(newHtml);
      onHtmlChange?.(newHtml);
      toast({ title: `${tpl.icon} ${tpl.name} added!`, description: "Section appended to your page." });
    } catch (err) {
      toast({ title: "Failed to add section", variant: "destructive" });
    }
  };

  const handleDeleteSection = (globalIdx: number) => {
    if (!currentHtml) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, "text/html");
      const children = Array.from(doc.body.children);
      const structural = children.filter((el) => {
        const tag = el.tagName.toLowerCase();
        return STRUCTURAL_TAGS.has(tag) || (tag === "div" && (el.id || el.className));
      });
      const el = structural[globalIdx];
      if (el) el.remove();
      const newHtml = doc.documentElement.outerHTML;
      setLiveHtml(newHtml);
      onHtmlChange?.(newHtml);
      toast({ title: "Section removed" });
    } catch {
      toast({ title: "Failed to remove section", variant: "destructive" });
    }
  };

  const handleReorderSection = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || !currentHtml) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, "text/html");
      const children = Array.from(doc.body.children);
      const structural = children.filter((el) => {
        const tag = el.tagName.toLowerCase();
        return STRUCTURAL_TAGS.has(tag) || (tag === "div" && (el.id || el.className));
      });
      if (fromIdx >= structural.length || toIdx >= structural.length) return;
      const moved = structural.splice(fromIdx, 1)[0];
      structural.splice(toIdx, 0, moved);
      // Rebuild body: non-structural elements first, then reordered structural ones
      const nonStructural = children.filter((el) => {
        const tag = el.tagName.toLowerCase();
        return !STRUCTURAL_TAGS.has(tag) && !(tag === "div" && (el.id || el.className));
      });
      while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild);
      nonStructural.forEach((el) => doc.body.appendChild(el));
      structural.forEach((el) => doc.body.appendChild(el));
      const newHtml = doc.documentElement.outerHTML;
      setLiveHtml(newHtml);
      onHtmlChange?.(newHtml);
    } catch {
      toast({ title: "Failed to reorder sections", variant: "destructive" });
    }
  };

  const phaseLabel   = PHASE_LABELS[progress.phase] ?? "Working...";
  const showProgress = progress.phase === "building" && progress.filesTotal > 0;
  const hasProject   = !!html && !!currentId && !isLoading;
  const canEdit      = hasProject && currentFiles && currentFiles.length > 0;

  const editorFiles = currentFiles?.map((f) => ({
    name: f.name,
    content: f.content,
    description: f.description,
  })) ?? (currentId && html ? [{ name: "index.html", content: html }] : []);

  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto px-6 pb-6 flex flex-col relative z-20">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2 text-foreground">
            <Monitor className="w-5 h-5 text-primary" />
            {viewMode === "editor" ? "Code Editor" : "Live Preview"}
            {currentFiles && currentFiles.length > 0 && !isLoading && (
              <span className="ml-1 text-xs font-normal text-muted-foreground bg-secondary border border-border/50 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {currentFiles.length} files
              </span>
            )}
          </h3>

          {/* Preview / Editor toggle */}
          {hasProject && (
            <div className="flex items-center rounded-lg border border-border/60 bg-secondary/50 p-0.5">
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "preview"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => setViewMode("editor")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "editor"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Edit Code
              </button>
            </div>
          )}

          {/* AI Chat toggle */}
          {hasProject && (
            <button
              onClick={() => setShowChat((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showChat
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                  : "bg-secondary/70 hover:bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              AI Chat
              {showChat ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* SEO toggle */}
          {hasProject && (
            <button
              onClick={() => setShowSeo((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showSeo
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-secondary/70 hover:bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              SEO
              {showSeo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* Section Builder toggle */}
          {hasProject && (
            <button
              onClick={() => setShowSections((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showSections
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-secondary/70 hover:bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <PanelTop className="w-3.5 h-3.5" />
              Sections
              {showSections ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {hasProject && viewMode === "preview" && (
          <div className="flex items-center gap-2">
            {currentId && (
              <button
                onClick={handlePublish}
                disabled={publishState === "loading"}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-sm font-medium transition-colors border border-violet-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {publishState === "loading" ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                {publishState === "loading" ? "Publishing..." : "Netlify"}
              </button>
            )}
            {currentId && (
              <button
                onClick={() => { setShowWpModal(true); setWpState("idle"); setWpPublishedUrl(null); setWpError(null); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors border border-blue-500/20"
              >
                <Blocks className="w-4 h-4" />
                WordPress
              </button>
            )}
            {currentId && (
              <a
                href={`${BASE}/api/project/${currentId}/${currentPage}`}
                download={currentPage}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors border border-blue-500/20"
                title={`Download ${currentPage}`}
              >
                <Download className="w-4 h-4" />
                Download Page
              </a>
            )}
            {zipUrl && (
              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-sm font-medium transition-colors border border-green-500/20"
              >
                <Download className="w-4 h-4" />
                Download ZIP
              </button>
            )}
            {projectUrl && (
              <button
                onClick={handleOpenInTab}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors border border-primary/20"
              >
                <ExternalLink className="w-4 h-4" />
                Open in tab
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground text-sm font-medium transition-colors border border-border/50"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              {copied ? "Copied" : "Copy HTML"}
            </button>
          </div>
        )}
      </div>

      {/* File badge strip */}
      <AnimatePresence>
        {currentFiles && currentFiles.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-x-auto pb-2 mb-2"
          >
            {currentFiles.map((f) => {
              const isHtmlPage = f.name.endsWith(".html");
              const isActivePage = isHtmlPage && f.name === currentPage;
              return (
                <button
                  key={f.name}
                  onClick={() => {
                    if (isHtmlPage && iframeSrc && viewMode === "preview") {
                      // Navigate the preview iframe to this page
                      const url = `${BASE}/api/project/${currentId}/${f.name}`;
                      if (iframeRef.current) iframeRef.current.src = url;
                      setCurrentPage(f.name);
                    } else {
                      if (hasProject) setViewMode("editor");
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap shrink-0 font-mono transition-colors ${
                    isActivePage
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary/70 hover:bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCode2 className={`w-3 h-3 ${isActivePage ? "text-primary" : "text-primary/70"}`} />
                  {f.name}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main panel — switches between editor and preview */}
      <AnimatePresence mode="wait">
        {viewMode === "editor" && canEdit && currentId ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0"
          >
            <CodeEditor
              projectId={currentId}
              initialFiles={editorFiles}
              onPreviewUpdate={handlePreviewUpdate}
            />
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 w-full bg-[#0a0a0a] rounded-xl border border-border/60 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Browser chrome */}
            <div className="h-12 border-b border-border/60 bg-[#121214] flex items-center px-4 shrink-0 gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="flex-1 min-w-0">
                {projectUrl ? (
                  <button
                    onClick={handleOpenInTab}
                    className="w-full h-7 bg-background/50 border border-border/30 rounded-md flex items-center px-3 text-[11px] font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors group/bar gap-1.5 overflow-hidden"
                  >
                    <Globe className="w-3 h-3 shrink-0 opacity-50" />
                    <span className="opacity-50 shrink-0">nexus.preview /</span>
                    <span className="text-foreground/70 truncate">{currentPage}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/bar:opacity-70 transition-opacity ml-auto shrink-0" />
                  </button>
                ) : (
                  <div className="w-full h-7 bg-background/50 border border-border/30 rounded-md flex items-center px-3 text-[11px] font-mono text-muted-foreground gap-1.5">
                    <Globe className="w-3 h-3 shrink-0 opacity-40" />
                    <span className="opacity-50">nexus.preview.local</span>
                  </div>
                )}
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 relative bg-white overflow-hidden">
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4"
                  >
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                      <div className="absolute inset-2 rounded-full border-r-2 border-accent animate-[spin_2s_linear_infinite_reverse]"></div>
                      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>

                    <div className="text-center">
                      <h4 className="text-xl font-display font-semibold text-white animate-pulse">
                        {phaseLabel}
                      </h4>
                      {showProgress && (
                        <p className="text-muted-foreground text-sm mt-1">
                          File {progress.filesDone} of {progress.filesTotal}
                        </p>
                      )}
                    </div>

                    {showProgress && (
                      <div className="w-64 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.round((progress.filesDone / progress.filesTotal) * 100)}%`,
                          }}
                          transition={{ type: "spring", stiffness: 60 }}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2">
                      {(["planning", "building"] as const).map((step) => (
                        <div key={step} className={`flex items-center gap-1.5 text-xs transition-colors ${
                          progress.phase === step
                            ? "text-primary"
                            : progress.phase === "building" && step === "planning"
                            ? "text-green-400"
                            : "text-white/20"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            progress.phase === step
                              ? "bg-primary animate-pulse"
                              : progress.phase === "building" && step === "planning"
                              ? "bg-green-400"
                              : "bg-white/20"
                          }`} />
                          {step === "planning" ? "Planning" : "Building"}
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
                      <div className="w-full h-24 bg-gradient-to-b from-transparent via-primary/60 to-transparent animate-scan"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!currentId && !displayHtml && !isLoading ? (
                <div className="absolute inset-0 bg-[#0f0f11] flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center mb-6 shadow-inner">
                    <LayoutTemplate className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">No Website Generated</p>
                  <p className="text-sm max-w-sm">Describe your app below. The AI will plan the file structure, generate each file, and show a live preview here.</p>
                </div>
              ) : iframeSrc ? (
                /* Multi-page project served from API — real navigation works */
                <iframe
                  key={iframeSrc}
                  ref={iframeRef}
                  src={iframeSrc}
                  title="Website Preview"
                  className="w-full h-full border-none bg-white transition-opacity duration-500"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={handleIframeLoad}
                />
              ) : displayHtml ? (
                /* Live editor preview — uses srcDoc so changes reflect immediately */
                <iframe
                  ref={iframeRef}
                  srcDoc={displayHtml}
                  title="Website Preview"
                  className="w-full h-full border-none bg-white transition-opacity duration-500"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Chat Panel ── */}
      <AnimatePresence>
        {showChat && hasProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-2xl border border-violet-500/30 bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-violet-500/5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-foreground">AI Code Assistant</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">— ask or auto-fix your page</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Quick fix (1 pass) */}
                <button
                  onClick={handleFixCode}
                  disabled={chatLoading || agentRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chatLoading && !agentRunning ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Wrench className="w-3.5 h-3.5" />
                  )}
                  Quick Fix
                </button>

                {/* AI Agent (multi-pass) */}
                <button
                  onClick={() => handleRunAgent(2)}
                  disabled={agentRunning || chatLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 text-xs font-semibold border border-fuchsia-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {agentRunning ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {agentRunning ? "Agent working…" : "🤖 AI Agent"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-56 overflow-y-auto px-4 py-3 space-y-3 text-sm">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 opacity-30" />
                  <p className="text-xs">Ask anything about your website — why something doesn't work, how to improve it, or anything else.</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    {["Why doesn't the contact form work?", "How to add a dark mode?", "Fix navigation on mobile"].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendChatMessage(q)}
                        disabled={chatLoading}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => {
                if (msg.role === "agent-step") {
                  return (
                    <div key={i} className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                        <span className="text-xs font-bold text-fuchsia-400">
                          Iteration {msg.step}{msg.total ? ` of ${msg.total}` : ""} — Issues found
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        msg.role === "user"
                          ? "bg-violet-600/20 border border-violet-500/20 text-foreground"
                          : "bg-secondary/80 border border-border/40 text-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              {chatLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="bg-secondary/80 border border-border/40 rounded-xl px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input row */}
            <div className="px-4 py-3 border-t border-border/40 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(chatInput); } }}
                placeholder="Ask AI about your website…"
                disabled={chatLoading}
                className="flex-1 text-sm bg-secondary/60 border border-border/50 rounded-xl px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEO Panel ── */}
      <AnimatePresence>
        {showSeo && hasProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-2xl border border-green-500/30 bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            {/* SEO header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-green-500/5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-foreground">SEO Optimizer</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">— optimize your page for search engines</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSeoSuggest}
                  disabled={seoSuggestState === "loading"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {seoSuggestState === "loading" ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Lightbulb className="w-3.5 h-3.5" />
                  )}
                  {seoSuggestState === "loading" ? "Analyzing…" : "AI Keywords"}
                </button>
              </div>
            </div>

            <div className="px-4 py-4 flex flex-col gap-3">
              {/* Suggested keywords */}
              {seoKeywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    Suggested keywords — click to use:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {seoKeywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => setSeoKeyword(kw)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          seoKeyword === kw
                            ? "bg-green-500/20 border-green-500/40 text-green-400"
                            : "bg-secondary/70 hover:bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {seoSuggestState === "idle" && seoKeywords.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400/50" />
                  Click <strong className="text-foreground">AI Keywords</strong> to get suggestions based on your page content.
                </p>
              )}

              {/* Keyword input + optimize button */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={seoKeyword}
                    onChange={(e) => setSeoKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSeoOptimize(); }}
                    placeholder="e.g. barber shop Warsaw, SaaS landing page…"
                    disabled={seoState === "loading"}
                    className="w-full text-sm bg-secondary/60 border border-border/50 rounded-xl pl-9 pr-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleSeoOptimize}
                  disabled={seoState === "loading" || !seoKeyword.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
                >
                  {seoState === "loading" ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                  {seoState === "loading" ? "Optimizing…" : "Optimize SEO"}
                </button>
              </div>

              {/* Status feedback */}
              {seoState === "done" && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Page successfully optimized for <strong>"{seoKeyword}"</strong>. Meta tags, headings and alt attributes updated.
                </div>
              )}
              {seoState === "error" && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <X className="w-3.5 h-3.5 shrink-0" />
                  SEO optimization failed. Please try again.
                </div>
              )}

              {/* Info row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                <span>Adds: title · meta description · H1-H3 · alt tags · semantic HTML</span>
                <div className="flex items-center gap-3">
                  <a
                    href={`${BASE}/sitemap.xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    sitemap.xml
                  </a>
                  <a
                    href={`${BASE}/robots.txt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    robots.txt
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section Builder Panel ── */}
      <AnimatePresence>
        {showSections && hasProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-2xl border border-blue-500/30 bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-blue-500/5">
              <div className="flex items-center gap-2">
                <PanelTop className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-foreground">Section Builder</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">— add &amp; reorder page sections</span>
              </div>
            </div>

            <div className="px-4 py-4 flex flex-col gap-4">
              {/* Add section buttons */}
              <div>
                <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  Click to append a section to your page:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SECTION_TEMPLATES).map(([key, tpl]) => (
                    <button
                      key={key}
                      onClick={() => handleAddSection(key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/70 hover:bg-blue-500/10 border border-border/50 hover:border-blue-500/30 text-xs text-muted-foreground hover:text-blue-300 transition-all font-medium"
                    >
                      <span>{tpl.icon}</span>
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page structure / drag-drop list */}
              {(() => {
                const sections = parseStructuralSections(currentHtml || "");
                return sections.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-blue-400" />
                      Page structure — drag to reorder:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {sections.map((sec, i) => (
                        <div
                          key={`${sec.idx}-${i}`}
                          draggable
                          onDragStart={() => setDragSectionIdx(i)}
                          onDragOver={(e) => { e.preventDefault(); setDragOverSectionIdx(i); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragSectionIdx !== null) {
                              handleReorderSection(dragSectionIdx, i);
                            }
                            setDragSectionIdx(null);
                            setDragOverSectionIdx(null);
                          }}
                          onDragEnd={() => { setDragSectionIdx(null); setDragOverSectionIdx(null); }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-all cursor-grab active:cursor-grabbing ${
                            dragOverSectionIdx === i && dragSectionIdx !== i
                              ? "border-blue-500/60 bg-blue-500/10"
                              : dragSectionIdx === i
                              ? "opacity-40 border-dashed border-blue-500/30 bg-blue-500/5"
                              : "border-border/40 bg-secondary/40 hover:bg-secondary/60"
                          }`}
                        >
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          <span className="text-muted-foreground font-mono text-[10px] bg-secondary/60 px-1.5 py-0.5 rounded shrink-0 uppercase">
                            {sec.tag}
                          </span>
                          <span className="flex-1 truncate text-foreground/80">{sec.name}</span>
                          <span className="text-[10px] text-muted-foreground/40 shrink-0">#{i + 1}</span>
                          <button
                            onClick={() => handleDeleteSection(i)}
                            className="shrink-0 p-1 rounded hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 transition-colors"
                            title="Remove section"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <LayoutTemplate className="w-3.5 h-3.5 text-blue-400/50" />
                    No structural sections detected yet. Add one using the buttons above.
                  </p>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WordPress publish modal */}
      <AnimatePresence>
        {showWpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget && wpState !== "loading") setShowWpModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
            >
              <button
                onClick={() => setShowWpModal(false)}
                disabled={wpState === "loading"}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>

              {wpState !== "done" && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Blocks className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Publikuj do WordPress</h3>
                      <p className="text-xs text-muted-foreground">Wymagane Application Password z WP Admin</p>
                    </div>
                  </div>

                  <form onSubmit={handlePublishWP} className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">URL WordPressa</label>
                      <input
                        type="url"
                        placeholder="https://mojwordpress.pl"
                        value={wpUrl}
                        onChange={(e) => setWpUrl(e.target.value)}
                        required
                        disabled={wpState === "loading"}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Login WP</label>
                      <input
                        type="text"
                        placeholder="admin"
                        value={wpUser}
                        onChange={(e) => setWpUser(e.target.value)}
                        required
                        disabled={wpState === "loading"}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Application Password
                        <a
                          href="https://wordpress.org/documentation/article/application-passwords/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1.5 text-primary hover:underline font-normal"
                        >
                          (jak wygenerować?)
                        </a>
                      </label>
                      <input
                        type="password"
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        value={wpPassword}
                        onChange={(e) => setWpPassword(e.target.value)}
                        required
                        disabled={wpState === "loading"}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tytuł strony</label>
                      <input
                        type="text"
                        placeholder="AI Page"
                        value={wpTitle}
                        onChange={(e) => setWpTitle(e.target.value)}
                        disabled={wpState === "loading"}
                        className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                      />
                    </div>

                    {wpError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-600 dark:text-red-400">
                        {wpError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={wpState === "loading" || !wpUrl || !wpUser || !wpPassword}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    >
                      {wpState === "loading" ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Publikowanie...
                        </>
                      ) : (
                        <>
                          <Blocks className="w-4 h-4" />
                          Opublikuj w WordPress
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              {wpState === "done" && wpPublishedUrl && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Strona opublikowana! 🎉</h3>
                    <p className="text-sm text-muted-foreground mb-3">Twoja strona jest już dostępna w WordPress.</p>
                    <a
                      href={wpPublishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Otwórz stronę
                    </a>
                  </div>
                  <div className="w-full flex items-center gap-2 bg-muted/40 border border-border/50 rounded-xl px-3 py-2">
                    <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">{wpPublishedUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(wpPublishedUrl!); toast({ title: "URL skopiowany!" }); }}
                      className="shrink-0 text-xs text-primary font-semibold hover:underline"
                    >
                      Kopiuj
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Netlify publish result modal */}
      <AnimatePresence>
        {showPublishModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPublishModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
            >
              <button
                onClick={() => setShowPublishModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {publishState === "loading" && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-violet-500 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Launching to Netlify…</h3>
                    <p className="text-sm text-muted-foreground">Creating site, packaging files, deploying. This takes a few seconds.</p>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-500 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "90%" }}
                      transition={{ duration: 4, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              )}

              {publishState === "done" && publishedUrl && publishedUrl !== "__not_configured__" && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Your site is live! 🎉</h3>
                    <p className="text-sm text-muted-foreground mb-3">Deployed to Netlify and accessible worldwide.</p>
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Live Site
                    </a>
                  </div>
                  <div className="w-full flex items-center gap-2 bg-muted/40 border border-border/50 rounded-xl px-3 py-2 mt-1">
                    <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">{publishedUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(publishedUrl!); toast({ title: "URL copied!" }); }}
                      className="shrink-0 text-xs text-primary font-semibold hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {publishState === "error" && publishedUrl === "__publish_limit__" && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">No credits left 💸</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      The free plan includes <strong>10 credits</strong> for generations &amp; publishing. Upgrade to PRO for unlimited use at <strong>$9.99/month</strong>.
                    </p>
                    <a
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-lg"
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade to PRO
                    </a>
                  </div>
                </div>
              )}

              {publishState === "error" && publishedUrl === "__not_configured__" && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Netlify token not set</h3>
                    <p className="text-sm text-muted-foreground">
                      To publish sites live, add your{" "}
                      <strong>Netlify Personal Access Token</strong> as the{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">NETLIFY_TOKEN</code>{" "}
                      secret in the Replit Secrets panel, then try again.
                    </p>
                  </div>
                  <a
                    href="https://app.netlify.com/user/applications#personal-access-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Get your Netlify token
                  </a>
                </div>
              )}

              {publishState === "error" && publishedUrl !== "__not_configured__" && publishedUrl !== "__publish_limit__" && (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Publish failed</h3>
                    <p className="text-sm text-muted-foreground">Something went wrong while deploying. Check your Netlify token and try again.</p>
                  </div>
                  <button
                    onClick={handlePublish}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Try again
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
