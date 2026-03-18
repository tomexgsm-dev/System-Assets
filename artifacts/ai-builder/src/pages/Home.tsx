import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { PromptSection } from "@/components/PromptSection";
import { BrowserPreview } from "@/components/BrowserPreview";
import { useBuilderGenerate } from "@/hooks/use-builder";
import type { Generation } from "@workspace/api-client-react/src/generated/api.schemas";

type Model = "openai" | "claude";

export default function Home() {
  const [currentId, setCurrentId] = useState<number | undefined>();
  const [currentHtml, setCurrentHtml] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  const { mutate: generateWebsite, isPending } = useBuilderGenerate();

  const handleSelectHistory = (gen: Generation) => {
    setCurrentId(gen.id);
    setCurrentHtml(gen.html);
    setCurrentPrompt(gen.prompt);
  };

  const handleGenerate = (prompt: string, model: Model) => {
    setCurrentId(undefined);
    setCurrentPrompt(prompt);

    generateWebsite(
      { data: { prompt, model } },
      {
        onSuccess: (data) => {
          setCurrentId(data.id);
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
        />

        <BrowserPreview
          html={currentHtml}
          isLoading={isPending}
          currentId={currentId}
        />
      </main>
    </div>
  );
}
