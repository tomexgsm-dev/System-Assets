import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateWebsite,
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

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

export function useBuilderGenerate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGenerateWebsite({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
        toast({
          title: "Website generated!",
          description: `Saved as Project #${data.id} — open it at /api/project/${data.id}`,
        });
      },
      onError: (error: any) => {
        const isLimit = error?.data?.error === "limit_reached";
        if (!isLimit) {
          toast({
            title: "Generation Failed",
            description: error?.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      },
    },
  });
}
