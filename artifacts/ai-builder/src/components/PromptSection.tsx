import React, { useState, useRef } from "react";
import { Sparkles, Loader2, Crown, Wand2, PlusCircle, Zap, Paperclip, X, Rocket, CheckCircle2, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Model = "openai" | "claude" | "groq";

interface PromptSectionProps {
  onSubmit: (prompt: string, model: Model, refineFromId?: number, imageBase64?: string, imageMimeType?: string) => void;
  isLoading: boolean;
  currentPrompt?: string;
  refineId?: number;
  limitError?: boolean;
  onUpgrade?: () => void;
  onAutoBusinessResult?: (id: number, html: string, prompt: string) => void;
}

type AppMode = "builder" | "business";
type BizStep = "idle" | "planning" | "generating" | "done" | "error";

const MODEL_OPTIONS: { value: Model; label: string; badge: string; color: string }[] = [
  { value: "openai", label: "OpenAI GPT", badge: "GPT-5.2", color: "from-emerald-500 to-teal-500" },
  { value: "claude", label: "Claude", badge: "Sonnet 4.6", color: "from-orange-500 to-amber-500" },
  { value: "groq", label: "Groq", badge: "Llama 3.3", color: "from-violet-500 to-purple-600" },
];

const TEMPLATES: { icon: string; label: string; prompt: string }[] = [
  {
    icon: "🏋️",
    label: "Fitness",
    prompt: "Modern fitness gym landing page with hero video background, class schedule, trainer profiles, membership pricing tiers, and motivational testimonials. Dark theme with electric blue and neon green accents.",
  },
  {
    icon: "📷",
    label: "Portfolio",
    prompt: "Elegant photography portfolio website with full-screen hero gallery, masonry photo grid, about me page, services & pricing, and contact form. Minimal dark aesthetic with elegant typography.",
  },
  {
    icon: "🛒",
    label: "Online Store",
    prompt: "Modern e-commerce store for handmade jewelry with product grid, product detail pages, shopping cart UI, about the artisan, and contact. Warm gold and cream color palette.",
  },
  {
    icon: "🚀",
    label: "SaaS App",
    prompt: "Futuristic SaaS landing page for an AI productivity tool. Features: animated hero with dashboard mockup, feature highlights, how-it-works steps, pricing table (free/pro/enterprise), and FAQ. Dark mode with purple and cyan gradients.",
  },
  {
    icon: "🍕",
    label: "Restaurant",
    prompt: "Upscale Italian restaurant website with hero food photography, full menu with categories (antipasti, pasta, mains, desserts), reservation booking form, chef story, and location map. Warm red and cream palette.",
  },
  {
    icon: "💼",
    label: "Agency",
    prompt: "Creative digital agency website with bold animated hero, services (branding, web, social), portfolio case studies, team page with bios, client logos, and contact. Black and gold luxury aesthetic.",
  },
];

async function resizeImageToBase64(file: Blob, maxPx = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function PromptSection({ onSubmit, isLoading, currentPrompt, refineId, limitError, onUpgrade, onAutoBusinessResult }: PromptSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<Model>("openai");
  const [refineMode, setRefineMode] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageMimeType, setImageMimeType] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto Business mode ──
  const [mode, setMode] = useState<AppMode>("builder");
  const [bizIdea, setBizIdea] = useState("");
  const [bizStep, setBizStep] = useState<BizStep>("idle");
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizPlan, setBizPlan] = useState<{ companyName?: string; tagline?: string } | null>(null);

  const handleAutoBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizIdea.trim() || bizStep !== "idle") return;
    setBizError(null);
    setBizPlan(null);
    setBizStep("planning");

    try {
      const res = await fetch(`${BASE}/api/auto-business`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: bizIdea }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "no_credits") {
          setBizStep("error");
          setBizError("no_credits");
          return;
        }
        throw new Error(data.error ?? "Generation failed");
      }

      setBizStep("generating");
      // Small pause to let user see the "Generating page…" step before result arrives
      // (both steps happen server-side; we show them sequentially here as UX polish)
      await new Promise((r) => setTimeout(r, 600));

      setBizPlan({ companyName: data.plan?.companyName, tagline: data.plan?.tagline });
      setBizStep("done");
      onAutoBusinessResult?.(data.id, data.html, data.prompt);
    } catch (err: any) {
      setBizStep("error");
      setBizError(err.message ?? "Unknown error");
    }
  };

  const resetBiz = () => {
    setBizStep("idle");
    setBizError(null);
    setBizPlan(null);
  };

  const handleImageFile = async (blob: Blob) => {
    if (!blob.type.startsWith("image/")) return;
    try {
      const { base64, mimeType } = await resizeImageToBase64(blob);
      setImageBase64(base64);
      setImageMimeType(mimeType);
      setImagePreview(`data:${mimeType};base64,${base64}`);
    } catch {
      console.error("Failed to process image");
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      const blob = imageItem.getAsFile();
      if (blob) {
        e.preventDefault();
        await handleImageFile(blob);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleImageFile(file);
    e.target.value = "";
  };

  const clearImage = () => {
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, model, refineMode && refineId ? refineId : undefined, imageBase64, imageMimeType);
  };

  const handleTemplate = (tpl: typeof TEMPLATES[0]) => {
    if (isLoading) return;
    setPrompt(tpl.prompt);
    setRefineMode(false);
  };

  React.useEffect(() => {
    // In refine mode: clear the textarea so the user types ONLY the refinement instruction.
    // In new-site mode: pre-fill with the last prompt so the user can iterate on it.
    if (!isLoading) {
      if (refineMode && refineId) {
        setPrompt("");
      } else if (currentPrompt) {
        setPrompt(currentPrompt);
      }
    }
  }, [currentPrompt, isLoading]);

  React.useEffect(() => {
    if (refineId) {
      setRefineMode(true);
      setPrompt(""); // clear textarea when a project is loaded for refining
    } else {
      setRefineMode(false);
    }
  }, [refineId]);

  const selected = MODEL_OPTIONS.find((m) => m.value === model)!;
  const isRefining = refineMode && !!refineId;

  const bizBusy = bizStep === "planning" || bizStep === "generating";

  return (
    <div className="w-full max-w-4xl mx-auto px-6 pt-6 pb-4 relative z-20">
      {/* ── Mode tabs ── */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <div className="flex items-center rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("builder")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "builder"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Site Builder
          </button>
          <button
            type="button"
            onClick={() => { setMode("business"); resetBiz(); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "business"
                ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            Auto Business
          </button>
        </div>
      </div>

      {/* ── Auto Business mode ── */}
      {mode === "business" && (
        <div className="relative group mb-2">
          <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-500/30 to-violet-500/30 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">

            {/* Header */}
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-fuchsia-500/5 to-violet-500/5 border-b border-border/30">
              <h2 className="text-xl font-display font-bold text-foreground mb-0.5">🚀 Auto Business Generator</h2>
              <p className="text-xs text-muted-foreground">Describe your business idea — AI plans it and builds a complete landing page in 2 steps.</p>
            </div>

            {bizStep === "idle" && (
              <form onSubmit={handleAutoBusiness} className="p-5 flex flex-col gap-3">
                <textarea
                  value={bizIdea}
                  onChange={(e) => setBizIdea(e.target.value)}
                  placeholder="E.g. barber shop in Warsaw, organic food delivery in Kraków, SaaS project management tool..."
                  className="w-full bg-background/60 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 resize-none min-h-[72px] transition-all"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAutoBusiness(e as any); } }}
                />
                {limitError && (
                  <div className="flex items-center justify-between gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                    <p className="text-xs text-orange-400 font-medium">No credits — upgrade to continue</p>
                    {onUpgrade && (
                      <button type="button" onClick={onUpgrade} className="shrink-0 text-xs bg-orange-500 text-white font-bold px-3 py-1.5 rounded-lg">
                        <Crown className="w-3 h-3 inline mr-1" />Upgrade
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 font-medium border border-fuchsia-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 inline-block" />
                      Groq · Llama 3.3
                    </span>
                    <span>·</span>
                    <span>2-step AI generation</span>
                    <span>·</span>
                    <span>costs 1 credit</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!bizIdea.trim() || !!limitError}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-sm font-bold shadow-lg shadow-fuchsia-500/20 hover:opacity-90 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Rocket className="w-4 h-4" />
                    Generate Business
                  </button>
                </div>
              </form>
            )}

            {bizBusy && (
              <div className="p-6 flex flex-col gap-4">
                {/* Progress steps */}
                {(["planning", "generating"] as BizStep[]).map((s, idx) => {
                  const isActive = bizStep === s;
                  const isDone = (bizStep === "generating" && s === "planning") || bizStep === "done";
                  return (
                    <div key={s} className={`flex items-center gap-3 ${isActive ? "opacity-100" : isDone ? "opacity-100" : "opacity-30"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isDone ? "bg-green-500/20 border-green-500/40" : isActive ? "bg-fuchsia-500/20 border-fuchsia-500/40" : "border-border/40"
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{idx + 1}</span>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isActive ? "text-fuchsia-400" : isDone ? "text-green-400" : "text-muted-foreground"}`}>
                          {s === "planning" ? "Step 1 — Planning your business" : "Step 2 — Generating landing page"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s === "planning"
                            ? "AI creates: company name, tagline, packages, services, testimonials…"
                            : "AI builds a fully responsive HTML page with animations and CTAs…"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {bizStep === "done" && bizPlan && (
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{bizPlan.companyName ?? "Your Business"}</p>
                    <p className="text-xs text-muted-foreground truncate">{bizPlan.tagline ?? "Landing page ready in preview!"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Landing page generated — check the preview on the right.</p>
                  <button
                    type="button"
                    onClick={resetBiz}
                    className="flex items-center gap-1.5 text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold transition-colors px-3 py-1.5 rounded-lg border border-fuchsia-500/20 hover:bg-fuchsia-500/10"
                  >
                    <Rocket className="w-3 h-3" />
                    New business
                  </button>
                </div>
              </div>
            )}

            {bizStep === "error" && (
              <div className="p-5 flex flex-col gap-3">
                {bizError === "no_credits" ? (
                  <div className="flex items-center justify-between gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-orange-400">No credits remaining</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Upgrade to PRO for unlimited generations.</p>
                    </div>
                    {onUpgrade && (
                      <button type="button" onClick={onUpgrade} className="shrink-0 flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold px-3 py-2 rounded-xl">
                        <Crown className="w-3.5 h-3.5" />Upgrade
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-red-400">Generation failed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{bizError}</p>
                    </div>
                    <button type="button" onClick={resetBiz} className="shrink-0 text-xs border border-border/50 text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Original builder mode ── */}
      {mode === "builder" && (
      <div>
      <div className="mb-4 text-center">
        <h2 className="text-3xl font-display font-bold text-foreground mb-1">What will you build today?</h2>
        <p className="text-muted-foreground text-sm">Describe your site, or pick a template below — AI generates it live.</p>
      </div>

      {/* Quick template buttons */}
      {!refineId && (
        <div className="mb-4 flex items-center gap-2 flex-wrap justify-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
            <Zap className="w-3 h-3" />
            Quick start:
          </span>
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => handleTemplate(tpl)}
              disabled={isLoading || !!limitError}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-border/60 bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:-translate-y-0.5"
            >
              <span>{tpl.icon}</span>
              {tpl.label}
            </button>
          ))}
        </div>
      )}

      {limitError && (
        <div className="mb-4 flex items-center justify-between gap-4 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Free plan limit reached</p>
            <p className="text-xs text-orange-600 dark:text-orange-300">Upgrade to PRO for unlimited generations at $9.99.</p>
          </div>
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
        <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">

          {/* Refine / New site toggle */}
          {refineId && (
            <div className="flex items-center gap-1 px-4 pt-3 pb-0">
              <div className="flex items-center rounded-lg border border-border/50 bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setRefineMode(true)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-50 ${
                    isRefining
                      ? "bg-card text-foreground shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  Refine current site
                </button>
                <button
                  type="button"
                  onClick={() => setRefineMode(false)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all disabled:opacity-50 ${
                    !isRefining
                      ? "bg-card text-foreground shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PlusCircle className="w-3 h-3" />
                  New site
                </button>
              </div>
              {isRefining && (
                <span className="text-xs text-muted-foreground ml-1">
                  AI will remember the current website and apply your changes
                </span>
              )}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePaste}
            disabled={isLoading || limitError}
            placeholder={
              isRefining
                ? "E.g. Make the navbar dark, add a pricing section, change the accent color to blue..."
                : "E.g. A futuristic AI SaaS landing page with dark mode, glassmorphism cards, animated hero, pricing table, and smooth scroll..."
            }
            className="w-full bg-transparent p-5 min-h-[100px] resize-none text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 font-body text-base leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Image attachment preview */}
          {imagePreview && (
            <div className="px-5 pb-3 flex items-start gap-3">
              <div className="relative group/img inline-flex">
                <img
                  src={imagePreview}
                  alt="Reference"
                  className="h-20 w-auto max-w-[160px] rounded-xl border border-border/60 object-cover shadow-md"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col justify-center gap-0.5 pt-1">
                <span className="text-xs font-semibold text-foreground">Reference image attached</span>
                <span className="text-[11px] text-muted-foreground">AI will match its style &amp; layout</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 bg-background/50 border-t border-border/50 backdrop-blur-md gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-1 border border-border/40">
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setModel(opt.value)}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
                      model === opt.value
                        ? "bg-card text-foreground shadow-sm border border-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full bg-gradient-to-br ${opt.color}`} />
                    {opt.label}
                    {model === opt.value && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md bg-gradient-to-r ${opt.color} text-white font-bold`}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Attach image button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title={imagePreview ? "Replace image" : "Attach reference image (or paste one)"}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
                  imagePreview
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                {imagePreview ? "Image" : "Image"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground font-medium hidden sm:flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px]">Cmd</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px]">Enter</kbd>
              </div>
              <button
                type="submit"
                disabled={isLoading || !prompt.trim() || !!limitError}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r ${selected.color} text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center gap-2`}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                ) : isRefining ? (
                  <><Wand2 className="w-4 h-4" />Refine Site</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Generate Site</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      </div>)}
    </div>
  );
}
