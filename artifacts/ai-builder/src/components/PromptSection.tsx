import React, { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";

interface PromptSectionProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  currentPrompt?: string;
}

export function PromptSection({ onSubmit, isLoading, currentPrompt }: PromptSectionProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt);
  };

  // Keep internal state in sync if a history item was selected
  React.useEffect(() => {
    if (currentPrompt && !isLoading) {
      setPrompt(currentPrompt);
    }
  }, [currentPrompt, isLoading]);

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
            placeholder="E.g. A sleek landing page for a futuristic AI SaaS startup with dark mode, glowing buttons, and a hero section..."
            className="w-full bg-transparent p-5 min-h-[120px] resize-none text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 font-body text-base leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="flex items-center justify-between px-4 py-3 bg-background/50 border-t border-border/50 backdrop-blur-md">
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px]">Cmd</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px]">Enter</kbd>
              <span className="ml-1">to generate</span>
            </div>
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-accent text-white shadow-glow hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all duration-200 flex items-center gap-2"
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
      </form>
    </div>
  );
}
