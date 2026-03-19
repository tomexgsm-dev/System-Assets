import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, LayoutTemplate, Monitor, Sparkles,
  ExternalLink, Download, FileCode2, Layers, Code2, Eye, Globe,
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
  pending:  "Starting...",
  planning: "Planning project structure...",
  building: "Generating files...",
  done:     "Done!",
  error:    "Error",
};

type ViewMode = "preview" | "editor";

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
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const projectUrl = currentId ? `${BASE}/api/project/${currentId}` : null;
  const zipUrl     = currentId ? `${BASE}/api/project/${currentId}/zip` : null;

  // The URL used for the iframe src (for saved multi-page projects)
  const iframeSrc = currentId && !liveHtml
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
        </div>

        {hasProject && viewMode === "preview" && (
          <div className="flex items-center gap-2">
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
    </div>
  );
}
