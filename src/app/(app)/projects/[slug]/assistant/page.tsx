import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { getWorkspace } from "@/lib/data/workspace";
import { isAiConfigured } from "@/lib/env";

import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AssistantPage({ params }: PageProps<"/projects/[slug]/assistant">) {
  const { slug } = await params;
  const w = await getWorkspace(slug);

  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Answers grounded in your project's own records, with the entries they came from."
      />
      <AssistantChat
        slug={slug}
        projectName={w.project.name || "your project"}
        aiEnabled={isAiConfigured()}
      />
    </>
  );
}
