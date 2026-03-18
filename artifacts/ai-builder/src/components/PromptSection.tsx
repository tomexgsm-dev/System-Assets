import React, { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

type Model = "openai" | "claude";

interface PromptSectionProps {
  onSubmit: (prompt: string, model: Model) => void;
  isLoading: boolean;
  currentPrompt?: string;
}

const MODEL_OPTIONS: { value: Model; label: string; badge: string; color: string }[] = [
  { value: "openai", label: "OpenAI GPT", badge: "GPT-5.2", color: "from-emerald-500 to-teal-500" },
  { value: "claude", label: "Claude", badge: "Sonnet 4.6", color: "from-orange-500 to-amber-500" },
];

export function PromptSection({ onSubmit, isLoading, currentPrompt }: PromptSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<Model>("openai");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, model);
  };

  React.useEffect(() => {
    if (currentPrompt && !isLoading) {
      setPrompt(currentPrompt);
    }
  }, [currentPrompt, isLoading]);

  const selected = MODEL_OPTIONS.find((m) => m.value === model)!;

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8 relative z-20">
      <div className="mb-4 text-center">
        <h2 className="text-3xl font-display font-bold text-white mb-2">What will you build today?</h2>
        <p className="text-muted-foreground">Describe the website you want, and our AI will generate the layout instantly.</p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
        <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="E.g. A sleek landing page for a futuristic AI SaaS startup with dark mode, glowing buttons, hero section, pricing, and CTA..."
            className="w-full bg-transparent p-5 min-h-[120px] resize-none text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 font-body text-base leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Model selector + submit */}
          <div className="flex items-center justify-between px-4 py-3 bg-background/50 border-t border-border/50 backdrop-blur-md gap-3">
            {/* Model tabs */}
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
                  <span
                    className={`inline-block w-2 h-2 rounded-full bg-gradient-to-br ${opt.color}`}
                  />
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
                disabled={isLoading || !prompt.trim()}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r ${selected.color} text-white shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Site
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
