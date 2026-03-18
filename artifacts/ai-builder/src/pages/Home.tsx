import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { PromptSection } from "@/components/PromptSection";
import { BrowserPreview } from "@/components/BrowserPreview";
import { useBuilderGenerate, useBuilderGenerations, type GenerationResult } from "@/hooks/use-builder";
import { useAuth } from "@/hooks/use-auth";

type Model = "openai" | "claude";

export default function Home() {
  const [currentId, setCurrentId] = useState<number | undefined>();
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [currentFiles, setCurrentFiles] = useState<GenerationResult["files"]>(null);
  const [limitError, setLimitError] = useState(false);
  const autoLoadedRef = useRef(false);

  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { mutate: generateWebsite, isPending, progress, resetProgress } = useBuilderGenerate();
  const { data: generations } = useBuilderGenerations();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Auto-load the most recent project OR the ?project=ID from URL
  useEffect(() => {
    if (autoLoadedRef.current || !generations || generations.length === 0 || isPending) return;

    const params = new URLSearchParams(window.location.search);
    const projectIdParam = params.get("project");

    let target = projectIdParam
      ? generations.find((g) => g.id === Number(projectIdParam))
      : generations[0];

    if (!target) target = generations[0];

    if (target) {
      autoLoadedRef.current = true;
      setCurrentId(target.id);
      setCurrentHtml((target as any).html ?? null);
      setCurrentPrompt(target.prompt);
      setCurrentFiles((target as any).files ?? null);

      // Clean up ?project= from URL without reloading
      if (projectIdParam) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [generations, isPending]);

  const handleSelectHistory = (gen: any) => {
    autoLoadedRef.current = true;
    setCurrentId(gen.id);
    setCurrentHtml(gen.html);
    setCurrentPrompt(gen.prompt);
    setCurrentFiles(gen.files ?? null);
    setLimitError(false);
  };

  const handleGenerate = (prompt: string, model: Model) => {
    autoLoadedRef.current = true;
    setCurrentId(undefined);
    setCurrentHtml(null);
    setCurrentPrompt(prompt);
    setCurrentFiles(null);
    setLimitError(false);
    resetProgress();

    generateWebsite(
      { data: { prompt, model } },
      {
        onSuccess: (data) => {
          setCurrentId(data.id);
          setCurrentHtml(data.html);
          setCurrentPrompt(data.prompt);
          setCurrentFiles(data.files ?? null);
        },
        onError: (error: any) => {
          if (error?.data?.error === "limit_reached") {
            setLimitError(true);
          }
        },
      }
    );
  };

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <div
        className="absolute inset-0 z-0 opacity-8 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/mesh-bg.png')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/10 via-background/50 to-background pointer-events-none" />

      <Sidebar onSelectGeneration={handleSelectHistory} activeId={currentId} />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <PromptSection
          onSubmit={handleGenerate}
          isLoading={isPending}
          currentPrompt={currentPrompt}
          limitError={limitError}
          onUpgrade={() => navigate("/dashboard")}
        />

        <BrowserPreview
          html={currentHtml}
          isLoading={isPending}
          currentId={currentId}
          progress={progress}
          currentFiles={currentFiles}
          onHtmlChange={setCurrentHtml}
        />
      </main>
    </div>
  );
}
