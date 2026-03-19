import React, { useState } from "react";
import { Sparkles, Loader2, Crown, Wand2, PlusCircle, Zap } from "lucide-react";

type Model = "openai" | "claude" | "groq";

interface PromptSectionProps {
  onSubmit: (prompt: string, model: Model, refineFromId?: number) => void;
  isLoading: boolean;
  currentPrompt?: string;
  refineId?: number;
  limitError?: boolean;
  onUpgrade?: () => void;
}

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

export function PromptSection({ onSubmit, isLoading, currentPrompt, refineId, limitError, onUpgrade }: PromptSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<Model>("openai");
  const [refineMode, setRefineMode] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, model, refineMode && refineId ? refineId : undefined);
  };

  const handleTemplate = (tpl: typeof TEMPLATES[0]) => {
    if (isLoading) return;
    setPrompt(tpl.prompt);
    setRefineMode(false);
  };

  React.useEffect(() => {
    if (currentPrompt && !isLoading) {
      setPrompt(currentPrompt);
    }
  }, [currentPrompt, isLoading]);

  React.useEffect(() => {
    if (refineId) setRefineMode(true);
    else setRefineMode(false);
  }, [refineId]);

  const selected = MODEL_OPTIONS.find((m) => m.value === model)!;
  const isRefining = refineMode && !!refineId;

  return (
    <div className="w-full max-w-4xl mx-auto px-6 pt-6 pb-4 relative z-20">
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

          <div className="flex items-center justify-between px-4 py-3 bg-background/50 border-t border-border/50 backdrop-blur-md gap-3">
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
    </div>
  );
}
