import React, { useState, useRef, useCallback, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Save, Check, Play, FileCode2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Inline local CSS/JS files into HTML so the srcDoc iframe preview works
// without a real server. CDN (http/https/://) links are left as-is.
function inlineAssets(html: string, files: EditorFile[]): string {
  const byName = new Map(files.map((f) => [f.name, f.content]));
  const isExternal = (u: string) =>
    u.startsWith("http://") || u.startsWith("https://") || u.startsWith("//");

  let result = html
    .replace(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi,
      (match, href) => {
        if (isExternal(href)) return match;
        const css = byName.get(href.split("/").pop() ?? href) ?? byName.get(href);
        return css ? `<style>\n${css}\n</style>` : match;
      }
    )
    .replace(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*\/?>/gi,
      (match, href) => {
        if (isExternal(href)) return match;
        const css = byName.get(href.split("/").pop() ?? href) ?? byName.get(href);
        return css ? `<style>\n${css}\n</style>` : match;
      }
    )
    .replace(
      /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,
      (match, src) => {
        if (isExternal(src)) return match;
        const js = byName.get(src.split("/").pop() ?? src) ?? byName.get(src);
        return js ? `<script>\n${js}\n</script>` : match;
      }
    );

  return result;
}

export interface EditorFile {
  name: string;
  content: string;
  description?: string;
}

interface CodeEditorProps {
  projectId: number;
  initialFiles: EditorFile[];
  onPreviewUpdate: (html: string) => void;
}

function getLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    py: "python",
  };
  return map[ext] ?? "plaintext";
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "🟠",
    css: "🔵",
    js: "🟡",
    ts: "🔷",
    jsx: "🟡",
    tsx: "🔷",
    json: "⚪",
    md: "📄",
    py: "🐍",
  };
  return map[ext] ?? "📄";
}

export function CodeEditor({ projectId, initialFiles, onPreviewUpdate }: CodeEditorProps) {
  const [files, setFiles] = useState<EditorFile[]>(initialFiles);
  const [activeFile, setActiveFile] = useState(initialFiles[0]?.name ?? "");
  const [savedFiles, setSavedFiles] = useState<Set<string>>(new Set());
  const [savingFiles, setSavingFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  const editorRef = useRef<any>(null);

  const currentFile = files.find((f) => f.name === activeFile);

  // Auto-save debounce timers per file
  const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!currentFile || value === undefined) return;

      setFiles((prev) =>
        prev.map((f) => (f.name === activeFile ? { ...f, content: value } : f))
      );

      // Mark file as unsaved
      setSavedFiles((prev) => {
        const next = new Set(prev);
        next.delete(activeFile);
        return next;
      });

      // Auto-save after 2s of inactivity
      clearTimeout(autoSaveTimers.current[activeFile]);
      autoSaveTimers.current[activeFile] = setTimeout(() => {
        saveFile(activeFile, value);
      }, 2000);
    },
    [activeFile, currentFile]
  );

  const saveFile = useCallback(
    async (fileName: string, content?: string) => {
      const fileContent =
        content ?? files.find((f) => f.name === fileName)?.content ?? "";

      setSavingFiles((prev) => new Set(prev).add(fileName));

      try {
        const res = await fetch(`${BASE}/api/project/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fileName, content: fileContent }),
        });

        if (!res.ok) throw new Error("Save failed");

        setSavedFiles((prev) => new Set(prev).add(fileName));

        // Update live preview if index.html was saved
        if (fileName === "index.html") {
          onPreviewUpdate(fileContent);
        }
      } catch {
        toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
      } finally {
        setSavingFiles((prev) => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });
      }
    },
    [files, projectId, onPreviewUpdate, toast]
  );

  const handleSaveNow = () => {
    clearTimeout(autoSaveTimers.current[activeFile]);
    saveFile(activeFile);
  };

  const handleRun = () => {
    setIsRunning(true);
    const htmlFile = files.find((f) => f.name === "index.html");
    if (htmlFile) {
      onPreviewUpdate(inlineAssets(htmlFile.content, files));
      toast({ title: "Preview updated!", description: "Live preview refreshed with latest code." });
    }
    setTimeout(() => setIsRunning(false), 600);
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        clearTimeout(autoSaveTimers.current[activeFile]);
        saveFile(activeFile);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFile, saveFile]);

  const isSaved = savedFiles.has(activeFile);
  const isSaving = savingFiles.has(activeFile);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-xl border border-border/60 overflow-hidden shadow-2xl">
      {/* Editor toolbar */}
      <div className="h-12 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-3 shrink-0">
        {/* File tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 mr-3">
          {files.map((file) => {
            const isActive = file.name === activeFile;
            const fileSaved = savedFiles.has(file.name);
            const fileSaving = savingFiles.has(file.name);

            return (
              <button
                key={file.name}
                onClick={() => setActiveFile(file.name)}
                className={`flex items-center gap-1.5 px-3 h-9 text-xs font-mono whitespace-nowrap border-t-2 transition-colors shrink-0 ${
                  isActive
                    ? "border-primary bg-[#1e1e1e] text-white"
                    : "border-transparent bg-[#2d2d2d] text-[#8b8b8b] hover:text-white hover:bg-[#2a2a2a]"
                }`}
              >
                <span>{getFileIcon(file.name)}</span>
                <span>{file.name}</span>
                {fileSaving ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse ml-0.5" />
                ) : !fileSaved && isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 ml-0.5" />
                ) : fileSaved ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSaveNow}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              isSaved
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white border border-[#555]"
            }`}
            title="Save (Ctrl+S)"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save
              </>
            )}
          </button>
          <button
            onClick={handleRun}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-primary/90 hover:bg-primary text-white transition-all border border-primary/50 ${
              isRunning ? "scale-95" : ""
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Run
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          key={activeFile}
          height="100%"
          language={getLanguage(activeFile)}
          value={currentFile?.content ?? ""}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
            tabSize: 2,
            renderLineHighlight: "gutter",
          }}
        />
      </div>

      {/* Status bar */}
      <div className="h-6 bg-[#007acc] flex items-center justify-between px-3 text-[10px] text-white/80 shrink-0">
        <div className="flex items-center gap-3">
          <span>
            <FileCode2 className="w-3 h-3 inline mr-1" />
            {getLanguage(activeFile).toUpperCase()}
          </span>
          <span>{files.length} files</span>
        </div>
        <div>
          {isSaving ? "Saving..." : isSaved ? "✓ Saved" : "Auto-saves in 2s"}
        </div>
      </div>
    </div>
  );
}
