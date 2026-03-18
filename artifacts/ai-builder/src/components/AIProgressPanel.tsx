import React, { useEffect, useRef } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, Sparkles, FileCode, FileType, FileJson, File, Brain } from "lucide-react";
import type { GenerationProgress } from "@/hooks/use-builder";

interface Props {
  progress: GenerationProgress;
}

function fileIcon(name: string) {
  if (name.endsWith(".html")) return <FileType className="w-3.5 h-3.5" />;
  if (name.endsWith(".css")) return <FileCode className="w-3.5 h-3.5" />;
  if (name.endsWith(".js") || name.endsWith(".ts")) return <FileCode className="w-3.5 h-3.5" />;
  if (name.endsWith(".json")) return <FileJson className="w-3.5 h-3.5" />;
  return <File className="w-3.5 h-3.5" />;
}

type StepStatus = "waiting" | "active" | "done" | "error";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "active") return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
}

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div className="ml-[7px] w-px h-3 shrink-0" style={{ background: done ? "rgb(52 211 153)" : "rgb(63 63 70 / 0.6)" }} />
  );
}

export function AIProgressPanel({ progress }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [progress.filesDone]);

  const { phase, filePlan, completedFiles, currentFile } = progress;

  const planningStatus: StepStatus =
    phase === "pending" ? "waiting"
    : phase === "planning" ? "active"
    : phase === "error" && !filePlan ? "error"
    : "done";

  const hasPlan = filePlan && filePlan.length > 0;
  const isError = phase === "error";
  const isDone = phase === "done";

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden" style={{ animation: "slideInFromLeft 0.25s ease-out" }}>
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-1 scrollbar-thin">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">AI Activity</p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {isDone ? "Generation complete" : isError ? "Failed" : "Generating…"}
            </p>
          </div>
          {(phase === "planning" || phase === "building") && (
            <Sparkles className="w-3 h-3 text-primary ml-auto animate-pulse" />
          )}
        </div>

        {/* Planning step */}
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col items-center">
            <StepIcon status={planningStatus} />
            {hasPlan && <ConnectorLine done={planningStatus === "done"} />}
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <p className={`text-xs font-medium leading-tight ${planningStatus === "active" ? "text-primary" : planningStatus === "done" ? "text-foreground" : "text-muted-foreground/60"}`}>
              Planning project structure
            </p>
            {planningStatus === "active" && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Analysing your prompt…</p>
            )}
            {planningStatus === "done" && hasPlan && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {filePlan.length} file{filePlan.length !== 1 ? "s" : ""} planned
              </p>
            )}
          </div>
        </div>

        {/* File steps */}
        {hasPlan && filePlan.map((file, idx) => {
          const isCompleted = completedFiles.includes(file.name);
          const isCurrent = currentFile === file.name && !isCompleted;
          const isWaiting = !isCompleted && !isCurrent;
          const isLast = idx === filePlan.length - 1;

          const status: StepStatus =
            isError && isCurrent ? "error"
            : isCompleted ? "done"
            : isCurrent ? "active"
            : "waiting";

          return (
            <React.Fragment key={file.name}>
              <ConnectorLine done={isCompleted} />
              <div className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <StepIcon status={status} />
                  {!isLast && <ConnectorLine done={isCompleted} />}
                </div>
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${isCompleted ? "text-emerald-400" : isCurrent ? "text-primary" : "text-muted-foreground/40"}`}>
                      {fileIcon(file.name)}
                    </span>
                    <p className={`text-xs font-medium leading-tight font-mono truncate ${isCompleted ? "text-foreground" : isCurrent ? "text-primary" : "text-muted-foreground/50"}`}>
                      {file.name}
                    </p>
                  </div>
                  {isCurrent && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">
                      {file.description}
                    </p>
                  )}
                  {isCompleted && (
                    <p className="text-[10px] text-emerald-500/70 mt-0.5 leading-tight">Ready</p>
                  )}
                  {isWaiting && !isError && (
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 leading-tight truncate">
                      {file.description}
                    </p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Error message */}
        {isError && (
          <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-[10px] text-destructive font-medium">Generation failed</p>
            <p className="text-[10px] text-destructive/70 mt-0.5">Check your prompt and try again.</p>
          </div>
        )}

        {/* Done banner */}
        {isDone && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[10px] text-emerald-400 font-medium">All files generated</p>
            <p className="text-[10px] text-emerald-500/60 mt-0.5">Preview is ready below.</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
