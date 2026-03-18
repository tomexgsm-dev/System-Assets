import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateWebsite,
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useBuilderGenerations() {
  return useListGenerations();
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
          description: `Project saved. Open it at /api/project/${data.id}`,
        });
      },
      onError: (error: any) => {
        toast({
          title: "Generation Failed",
          description: error?.message || "An unexpected error occurred while generating the website.",
          variant: "destructive",
        });
      },
    },
  });
}
