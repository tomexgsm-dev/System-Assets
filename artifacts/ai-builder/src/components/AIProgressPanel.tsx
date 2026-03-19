import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Sparkles, ChevronRight } from "lucide-react";
import type { GenerationProgress } from "@/hooks/use-builder";

interface Props {
  progress: GenerationProgress;
}

interface LogEntry {
  id: number;
  type: "info" | "success" | "working" | "error" | "section";
  text: string;
  sub?: string;
  count?: string;
}

let nextId = 0;
function makeEntry(type: LogEntry["type"], text: string, sub?: string, count?: string): LogEntry {
  return { id: nextId++, type, text, sub, count };
}

export function AIProgressPanel({ progress }: Props) {
  const { phase, filePlan, completedFiles, currentFile, filesDone, filesTotal } = progress;

  const [log, setLog] = useState<LogEntry[]>([]);
  const prevPhaseRef = useRef<string>("");
  const prevCurrentFileRef = useRef<string | null>(null);
  const prevCompletedRef = useRef<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Accumulate log messages as progress changes
  useEffect(() => {
    const entries: LogEntry[] = [];

    // Phase transition: pending → planning
    if (phase === "planning" && prevPhaseRef.current !== "planning") {
      entries.push(makeEntry("section", "Analysing prompt", "Planning the project structure and files…"));
    }

    // Phase transition: planning → building (plan received)
    if (phase === "building" && prevPhaseRef.current !== "building") {
      if (filePlan && filePlan.length > 0) {
        const names = filePlan.map((f) => f.name).join(", ");
        entries.push(
          makeEntry("success", "Structure ready", `${filePlan.length} files planned: ${names}`, `${filePlan.length} files`)
        );
        entries.push(makeEntry("section", "Building files", "Writing code for each file…"));
      }
    }

    // New file started
    if (currentFile && currentFile !== prevCurrentFileRef.current) {
      const fileInfo = filePlan?.find((f) => f.name === currentFile);
      entries.push(
        makeEntry("working", `Writing ${currentFile}`, fileInfo?.description, `${filesDone + 1}/${filesTotal}`)
      );
    }

    // New files completed
    const newlyCompleted = (completedFiles ?? []).filter((f) => !(prevCompletedRef.current ?? []).includes(f));
    for (const name of newlyCompleted) {
      const idx = (filePlan ?? []).findIndex((f) => f.name === name);
      const n = idx + 1;
      const total = filesTotal;
      entries.push(makeEntry("success", `${name} ready`, undefined, `${n}/${total}`));
    }

    // Done
    if (phase === "done" && prevPhaseRef.current !== "done") {
      entries.push(
        makeEntry("success", "Website generated!", `${filesTotal} file${filesTotal !== 1 ? "s" : ""} ready — check the preview`, `${filesTotal} files`)
      );
    }

    // Error
    if (phase === "error" && prevPhaseRef.current !== "error") {
      entries.push(makeEntry("error", "Generation failed", "Check your prompt and try again."));
    }

    if (entries.length > 0) {
      setLog((prev) => [...prev, ...entries]);
    }

    prevPhaseRef.current = phase;
    prevCurrentFileRef.current = currentFile;
    prevCompletedRef.current = completedFiles ?? [];
  }, [phase, currentFile, (completedFiles ?? []).length, filesDone]);

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [log.length]);

  const isWorking = phase === "planning" || phase === "building";
  const isDone = phase === "done";
  const isError = phase === "error";

  return (
    <div
      className="flex flex-col w-64 shrink-0 border-r border-border/50 bg-card/70 backdrop-blur-xl overflow-hidden"
      style={{ animation: "slideInFromLeft 0.25s ease-out" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">AI is working</p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            {isDone ? "Generation complete" : isError ? "Failed" : isWorking ? "Generating…" : "Starting…"}
          </p>
        </div>
        {isWorking && (
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
        )}
        {isDone && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        {isError && (
          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
        )}
      </div>

      {/* Log feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 py-2 px-3 scrollbar-thin">
        {log.map((entry) => (
          <LogRow key={entry.id} entry={entry} />
        ))}

        {/* Live "Working…" pulse at the end while active */}
        {isWorking && (
          <div className="flex items-center gap-2 px-1 py-1.5 mt-1">
            <div className="flex gap-0.5 items-center">
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-[10px] text-muted-foreground">Working…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer progress bar */}
      {(isWorking || isDone) && filesTotal > 0 && (
        <div className="shrink-0 px-4 py-3 border-t border-border/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">Files</span>
            <span className="text-[10px] font-medium text-foreground">{filesDone}/{filesTotal}</span>
          </div>
          <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: filesTotal > 0 ? `${(filesDone / filesTotal) * 100}%` : "0%",
                background: isDone ? "rgb(52 211 153)" : "linear-gradient(to right, var(--color-primary), var(--color-accent, var(--color-primary)))",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  if (entry.type === "section") {
    return (
      <div className="flex items-start gap-2 px-1 py-2 mt-1">
        <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">{entry.text}</p>
          {entry.sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{entry.sub}</p>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "success") {
    return (
      <div className="flex items-start gap-2 px-1 py-1.5 rounded-lg">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-foreground leading-tight">{entry.text}</p>
            {entry.count && (
              <span className="text-[9px] font-semibold bg-emerald-500/15 text-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
                {entry.count}
              </span>
            )}
          </div>
          {entry.sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{entry.sub}</p>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "working") {
    return (
      <div className="flex items-start gap-2 px-1 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-primary leading-tight">{entry.text}</p>
            {entry.count && (
              <span className="text-[9px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none">
                {entry.count}
              </span>
            )}
          </div>
          {entry.sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{entry.sub}</p>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "error") {
    return (
      <div className="flex items-start gap-2 px-1 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
        <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-destructive leading-tight">{entry.text}</p>
          {entry.sub && (
            <p className="text-[10px] text-destructive/70 mt-0.5 leading-snug">{entry.sub}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
