import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, LayoutTemplate, Monitor, Sparkles, ExternalLink, Download, FileCode2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GenerationProgress, GenerationResult } from "@/hooks/use-builder";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BrowserPreviewProps {
  html: string | null;
  isLoading: boolean;
  currentId?: number;
  progress: GenerationProgress;
  currentFiles?: GenerationResult["files"];
}

const PHASE_LABELS: Record<string, string> = {
  pending:  "Starting...",
  planning: "Planning project structure...",
  building: "Generating files...",
  done:     "Done!",
  error:    "Error",
};

export function BrowserPreview({ html, isLoading, currentId, progress, currentFiles }: BrowserPreviewProps) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const projectUrl = currentId ? `${BASE}/api/project/${currentId}` : null;
  const zipUrl     = currentId ? `${BASE}/api/project/${currentId}/zip` : null;

  const handleCopy = () => {
    if (!html) return;
    navigator.clipboard.writeText(html);
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

  // Loading overlay content
  const phaseLabel   = PHASE_LABELS[progress.phase] ?? "Working...";
  const showProgress = progress.phase === "building" && progress.filesTotal > 0;

  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto px-6 pb-6 flex flex-col relative z-20">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 text-foreground">
          <Monitor className="w-5 h-5 text-primary" />
          Live Preview
          {currentFiles && currentFiles.length > 0 && !isLoading && (
            <span className="ml-1 text-xs font-normal text-muted-foreground bg-secondary border border-border/50 rounded-full px-2 py-0.5 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {currentFiles.length} files
            </span>
          )}
        </h3>

        {html && !isLoading && (
          <div className="flex items-center gap-2">
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

      {/* File list strip */}
      <AnimatePresence>
        {currentFiles && currentFiles.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-thin"
          >
            {currentFiles.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/70 border border-border/50 text-xs text-muted-foreground whitespace-nowrap shrink-0 font-mono"
              >
                <FileCode2 className="w-3 h-3 text-primary/70" />
                {f.name}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser window */}
      <div className="flex-1 w-full bg-[#0a0a0a] rounded-xl border border-border/60 shadow-2xl flex flex-col overflow-hidden relative group">
        {/* Chrome bar */}
        <div className="h-12 border-b border-border/60 bg-[#121214] flex items-center px-4 shrink-0 relative">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-sm">
            {projectUrl ? (
              <button
                onClick={handleOpenInTab}
                className="w-full h-7 bg-background/50 border border-border/30 rounded-md flex items-center justify-center text-[11px] font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors group/bar gap-1"
              >
                <span className="opacity-50">https://</span>
                <span>nexus.preview.local</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/bar:opacity-70 transition-opacity ml-1" />
              </button>
            ) : (
              <div className="w-full h-7 bg-background/50 border border-border/30 rounded-md flex items-center justify-center text-[11px] font-mono text-muted-foreground">
                <span className="opacity-50 mr-1">https://</span>nexus.preview.local
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 relative bg-white overflow-hidden">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4"
              >
                {/* Spinner */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-r-2 border-accent animate-[spin_2s_linear_infinite_reverse]"></div>
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                </div>

                {/* Phase label */}
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

                {/* Progress bar */}
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

                {/* Step indicators */}
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

                {/* Scan animation */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
                  <div className="w-full h-24 bg-gradient-to-b from-transparent via-primary/60 to-transparent animate-scan"></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!html && !isLoading ? (
            <div className="absolute inset-0 bg-[#0f0f11] flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center mb-6 shadow-inner">
                <LayoutTemplate className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">No Website Generated</p>
              <p className="text-sm max-w-sm">Describe your app below. The AI will plan the file structure, generate each file, and show a live preview here.</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={html || ""}
              title="Website Preview"
              className="w-full h-full border-none bg-white transition-opacity duration-500"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
