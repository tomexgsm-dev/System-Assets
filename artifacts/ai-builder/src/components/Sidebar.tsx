import React from "react";
import { format } from "date-fns";
import { History, Search, Loader2, Sparkles } from "lucide-react";
import { useBuilderGenerations } from "@/hooks/use-builder";
import type { Generation } from "@workspace/api-client-react/src/generated/api.schemas";

interface SidebarProps {
  onSelectGeneration: (generation: Generation) => void;
  activeId?: number;
}

export function Sidebar({ onSelectGeneration, activeId }: SidebarProps) {
  const { data: generations, isLoading } = useBuilderGenerations();

  return (
    <div className="w-80 flex-shrink-0 h-full flex flex-col bg-card/80 backdrop-blur-xl border-r border-border/50 relative z-20">
      <div className="p-6 border-b border-border/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          Nexus Builder
        </h1>
      </div>

      <div className="px-4 py-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search history..."
            className="w-full bg-background/50 border border-border/50 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <History className="w-3.5 h-3.5" />
          Recent Generations
        </h3>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
            <span className="text-sm">Loading history...</span>
          </div>
        ) : generations?.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-muted-foreground">No websites generated yet. Start typing a prompt!</p>
          </div>
        ) : (
          generations?.map((gen) => (
            <button
              key={gen.id}
              onClick={() => onSelectGeneration(gen)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                activeId === gen.id 
                  ? 'bg-primary/10 border border-primary/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]' 
                  : 'bg-background/30 border border-transparent hover:border-border hover:bg-background/50'
              }`}
            >
              <p className={`text-sm font-medium line-clamp-2 leading-snug mb-1.5 ${
                activeId === gen.id ? 'text-primary' : 'text-foreground group-hover:text-primary/90 transition-colors'
              }`}>
                {gen.prompt}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(gen.createdAt), "MMM d, yyyy • h:mm a")}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
