import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { PromptSection } from "@/components/PromptSection";
import { BrowserPreview } from "@/components/BrowserPreview";
import { useBuilderGenerate } from "@/hooks/use-builder";
import type { Generation } from "@workspace/api-client-react/src/generated/api.schemas";

type Model = "openai" | "claude";

export default function Home() {
  const [activeGenerationId, setActiveGenerationId] = useState<number | undefined>();
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  const { mutate: generateWebsite, isPending } = useBuilderGenerate();

  const handleSelectHistory = (gen: Generation) => {
    setActiveGenerationId(gen.id);
    setCurrentHtml(gen.html);
    setCurrentPrompt(gen.prompt);
  };

  const handleGenerate = (prompt: string, model: Model) => {
    setActiveGenerationId(undefined);
    setCurrentPrompt(prompt);

    generateWebsite(
      { data: { prompt, model } },
      {
        onSuccess: (data) => {
          setCurrentHtml(data.html);
          setCurrentPrompt(data.prompt);
        },
      }
    );
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Background aesthetic */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/mesh-bg.png')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/40 via-background/80 to-background pointer-events-none" />

      <Sidebar onSelectGeneration={handleSelectHistory} activeId={activeGenerationId} />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <PromptSection
          onSubmit={handleGenerate}
          isLoading={isPending}
          currentPrompt={currentPrompt}
        />

        <BrowserPreview html={currentHtml} isLoading={isPending} />
      </main>
    </div>
  );
}
