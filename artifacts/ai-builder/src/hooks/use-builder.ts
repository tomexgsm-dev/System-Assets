import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

// Polls /api/status/:taskId until done or error
async function pollTaskStatus(
  taskId: string,
  signal: AbortSignal
): Promise<{ id: number; html: string; prompt: string }> {
  while (!signal.aborted) {
    const res = await fetch(`${BASE}/api/status/${taskId}`, {
      credentials: "include",
      signal,
    });

    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = await res.json();

    if (data.status === "done") return data;
    if (data.status === "error") throw new Error(data.error ?? "Generation failed");

    // Still pending — wait 2 seconds before next poll
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

  return useMutation({
    mutationFn: async ({
      data,
      signal,
    }: {
      data: { prompt: string; model?: "openai" | "claude" };
      signal?: AbortSignal;
    }) => {
      const abortController = new AbortController();
      const effectiveSignal = signal ?? abortController.signal;

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

      // Poll until the generation is complete
      const result = await pollTaskStatus(taskId, effectiveSignal);
      return { ...result, cached };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      toast({
        title: data.cached ? "Loaded from cache!" : "Website generated!",
        description: data.cached
          ? "Returned a previously generated version of this prompt."
          : `Project #${data.id} saved — open at /api/project/${data.id}`,
      });
    },
    onError: (error: any) => {
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
}
