import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { getWorkspace } from "@/lib/data/workspace";

import { DocumentLibrary } from "./document-library";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: PageProps<"/projects/[slug]/documents">) {
  const { slug } = await params;
  const w = await getWorkspace(slug, ["documents"]);

  return (
    <>
      <PageHeader
        title="Documents"
        scene="dining"
        description="Permits, drawings, contracts, certificates and warranties for your build — versioned, searchable, and yours to keep."
      />
      <DocumentLibrary documents={w.documents} now={w.now} slug={slug} />
    </>
  );
}
