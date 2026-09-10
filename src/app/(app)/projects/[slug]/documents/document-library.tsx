"use client";

import {
  Award,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Lock,
  Receipt,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { Hint } from "@/components/ui/overlay";
import { AskAboutLink } from "@/components/widgets/ask-about";
import { DocumentViewer } from "@/components/widgets/document-viewer";
import type { SignatureResult } from "@/components/widgets/signature-pad";
import { formatDate, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentCategory, ProjectDocument } from "@/types/database";

const CATEGORY_META: Record<DocumentCategory, { icon: LucideIcon; label: string }> = {
  permit: { icon: FileCheck2, label: "Permits" },
  blueprint: { icon: FileSpreadsheet, label: "Drawings" },
  contract: { icon: FileText, label: "Contracts" },
  certificate: { icon: Award, label: "Certificates" },
  invoice: { icon: Receipt, label: "Invoices" },
  report: { icon: FileText, label: "Reports" },
  warranty: { icon: ShieldCheck, label: "Warranties" },
  insurance: { icon: ShieldCheck, label: "Insurance" },
  other: { icon: FileText, label: "Other" },
};

export function DocumentLibrary({
  documents,
  now,
  slug,
}: {
  documents: ProjectDocument[];
  now: string;
  slug: string;
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<DocumentCategory | "all">("all");
  const [viewing, setViewing] = React.useState<ProjectDocument | null>(null);

  // Acknowledgements are held locally in this build. With Supabase connected
  // this becomes an insert into document_acknowledgements, and the initial set
  // arrives as a prop -- the shape of the state does not change.
  const [acknowledged, setAcknowledged] = React.useState<Map<string, string>>(new Map());

  const recordAcknowledgement = React.useCallback(
    (documentId: string, signature: SignatureResult) => {
      setAcknowledged((current) => new Map(current).set(documentId, signature.name));
    },
    [],
  );

  const today = now.slice(0, 10);

  const categories = React.useMemo(() => {
    const counts = new Map<DocumentCategory, number>();
    for (const doc of documents) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [documents]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;
      return (
        doc.name.toLowerCase().includes(needle) ||
        doc.category.toLowerCase().includes(needle) ||
        (doc.description?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [documents, query, category]);

  const needsAck = documents.filter((d) => d.requires_ack && !acknowledged.has(d.id));

  return (
    <div className="flex flex-col gap-4">
      {needsAck.length > 0 ? (
        <Card className="border-warning/40 bg-warning-subtle flex items-center gap-3 p-4">
          <FileWarning className="text-warning-ink size-4 shrink-0" aria-hidden="true" />
          <p className="text-warning-ink text-[13px]">
            <span className="font-semibold">
              {needsAck.length} document{needsAck.length === 1 ? "" : "s"} need your
              acknowledgement.
            </span>{" "}
            Opening a document does not count as acknowledging it — use the button on the card.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant={category === "all" ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
          >
            All
            <span className="text-ink-3 ml-1 text-[11px]">{documents.length}</span>
          </Button>
          {categories.map(([value, count]) => (
            <Button
              key={value}
              variant={category === value ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
            >
              {CATEGORY_META[value].label}
              <span className="text-ink-3 ml-1 text-[11px]">{count}</span>
            </Button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Search
            className="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="pl-8"
          />
        </div>
      </div>

      <p aria-live="polite" className="text-ink-3 text-[12px]">
        {visible.length} of {documents.length} document{documents.length === 1 ? "" : "s"}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents match"
          description={query ? `Nothing matches “${query}”.` : "This category is empty."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((doc) => {
            const meta = CATEGORY_META[doc.category];
            const expiring =
              doc.expires_at != null && doc.expires_at > today
                ? new Date(doc.expires_at).getTime() - new Date(today).getTime() < 60 * 86_400_000
                : false;
            const expired = doc.expires_at != null && doc.expires_at <= today;
            const signedBy = acknowledged.get(doc.id);
            const isAcknowledged = signedBy !== undefined;

            return (
              <li key={doc.id}>
                <Card interactive className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="bg-surface-3 text-ink-2 grid size-9 shrink-0 place-items-center rounded-[var(--radius-card)]">
                      <meta.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-ink text-[13px] leading-snug font-medium">{doc.name}</h3>
                      <p className="text-ink-3 mt-0.5 text-[11px]">
                        {meta.label} · {formatFileSize(doc.size_bytes)}
                        {doc.version > 1 ? ` · v${doc.version}` : ""}
                      </p>
                    </div>

                    {doc.is_confidential ? (
                      <Hint content="Internal to the build team. Not visible to the buyer.">
                        <span>
                          <Lock className="text-ink-3 size-3.5" aria-label="Confidential" />
                        </span>
                      </Hint>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {doc.requires_ack && !isAcknowledged ? (
                      <Badge tone="warning" icon={FileWarning}>
                        Needs acknowledgement
                      </Badge>
                    ) : null}
                    {expired ? (
                      <Badge tone="critical" icon={FileWarning}>
                        Expired
                      </Badge>
                    ) : expiring ? (
                      <Badge tone="serious" icon={FileWarning}>
                        Expires {formatDate(doc.expires_at, "short")}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="text-ink-3 text-[11px]">
                      Issued {formatDate(doc.issued_at, "medium")}
                    </p>
                    <AskAboutLink slug={slug} kind="document" id={doc.id} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setViewing(doc)}
                    >
                      <Eye />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${doc.name}`}
                      onClick={() => setViewing(doc)}
                    >
                      <Download />
                    </Button>
                  </div>

                  {doc.requires_ack ? (
                    isAcknowledged ? (
                      <p className="text-good-ink flex items-center gap-1.5 text-[11px] font-medium">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Acknowledged by {signedBy}
                      </p>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className={cn("w-full")}
                        onClick={() => setViewing(doc)}
                      >
                        Acknowledge
                      </Button>
                    )
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {viewing ? (
        <DocumentViewer
          document={viewing}
          url={null}
          open
          onOpenChange={(next) => {
            if (!next) setViewing(null);
          }}
          onAcknowledged={(signature) => recordAcknowledgement(viewing.id, signature)}
        />
      ) : null}
    </div>
  );
}
