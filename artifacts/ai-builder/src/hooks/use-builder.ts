import { useState, useRef, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface GenerationProgress {
  phase: "pending" | "planning" | "building" | "postprocessing" | "done" | "error";
  filesDone: number;
  filesTotal: number;
  filePlan: Array<{ name: string; description: string }> | null;
  completedFiles: string[];
  currentFile: string | null;
}

export interface GenerationResult {
  id: number;
  html: string;
  prompt: string;
  files: Array<{ name: string; content: string; description?: string }> | null;
  cached: boolean;
}

export function useBuilderGenerations() {
  return useListGenerations({
    query: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false;
        return failureCount < 2;
      },
    },
  });
}

async function pollTaskStatus(
  taskId: string,
  signal: AbortSignal,
  onProgress: (p: GenerationProgress) => void
): Promise<GenerationResult & { cached?: boolean }> {
  while (!signal.aborted) {
    const res = await fetch(`${BASE}/api/status/${taskId}`, {
      credentials: "include",
      signal,
    });

    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = await res.json();

    if (data.status === "done") return data;
    if (data.status === "error") throw new Error(data.error ?? "Generation failed");

    // Report progress for pending/planning/building
    onProgress({
      phase: data.status,
      filesDone: data.filesDone ?? 0,
      filesTotal: data.filesTotal ?? 0,
      filePlan: data.filePlan ?? null,
      completedFiles: data.completedFiles ?? [],
      currentFile: data.currentFile ?? null,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 2000);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      });
    });
  }
  throw new Error("Aborted");
}

export function useBuilderGenerate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const emptyProgress: GenerationProgress = {
    phase: "pending",
    filesDone: 0,
    filesTotal: 0,
    filePlan: null,
    completedFiles: [],
    currentFile: null,
  };

  const [progress, setProgress] = useState<GenerationProgress>(emptyProgress);

  // Use ref so mutationFn closure always gets the latest setter
  const setProgressRef = useRef(setProgress);
  setProgressRef.current = setProgress;

  const resetProgress = useCallback(() => {
    setProgress(emptyProgress);
  }, []);

  const mutation = useMutation({
    mutationFn: async ({
      data,
      signal,
    }: {
      data: { prompt: string; model?: "openai" | "claude" | "groq"; refineFromId?: number; imageBase64?: string; imageMimeType?: string };
      signal?: AbortSignal;
    }): Promise<GenerationResult> => {
      const abortController = new AbortController();
      const effectiveSignal = signal ?? abortController.signal;

      setProgressRef.current(emptyProgress);

      // Start the async generation task
      const res = await fetch(`${BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
        signal: effectiveSignal,
      });

      const startData = await res.json();

      if (!res.ok) {
        throw Object.assign(new Error(startData.message ?? "Generation failed"), {
          status: res.status,
          data: startData,
        });
      }

      const { taskId, cached } = startData;

      // If cached, skip polling
      if (cached) {
        const statusRes = await fetch(`${BASE}/api/status/${taskId}`, {
          credentials: "include",
          signal: effectiveSignal,
        });
        const statusData = await statusRes.json();
        return { ...statusData, cached: true };
      }

      // Poll until the generation is complete
      const result = await pollTaskStatus(taskId, effectiveSignal, (p) => {
        setProgressRef.current(p);
      });

      return { ...result, cached: false };
    },
    onSuccess: (data) => {
      setProgress({
        phase: "done",
        filesDone: data.files?.length ?? 1,
        filesTotal: data.files?.length ?? 1,
        filePlan: data.files?.map((f) => ({ name: f.name, description: f.description ?? "" })) ?? null,
        completedFiles: data.files?.map((f) => f.name) ?? [],
        currentFile: null,
      });
      queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });

      const fileCount = data.files?.length;
      toast({
        title: data.cached ? "Showing saved version" : "Website generated!",
        description: data.cached
          ? "This prompt was used before — showing the existing result. Change the prompt or use Refine to update it."
          : fileCount
          ? `Built ${fileCount} files — download the full project as a ZIP!`
          : `Project #${data.id} is ready.`,
      });
    },
    onError: (error: any) => {
      setProgress({ phase: "error", filesDone: 0, filesTotal: 0 });
      const isLimit = error?.data?.error === "limit_reached";
      const isRate = error?.data?.error === "rate_limit";
      if (!isLimit) {
        toast({
          title: isRate ? "Slow down!" : "Generation Failed",
          description: error?.data?.message ?? error?.message ?? "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    },
  });

  return { ...mutation, progress, resetProgress };
}
