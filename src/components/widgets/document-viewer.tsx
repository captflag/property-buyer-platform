"use client";

import { Download, FileText, Lock, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { SignaturePad, type SignatureResult } from "@/components/widgets/signature-pad";
import { formatDate, formatFileSize, humanise } from "@/lib/format";
import type { ProjectDocument } from "@/types/database";

/**
 * Document preview and acknowledgement.
 *
 * The preview uses an `<object>` with the browser's own PDF renderer rather
 * than shipping a JavaScript PDF library: it is a couple of hundred kilobytes
 * lighter, it inherits the browser's accessibility and text selection, and it
 * degrades to a download link on its own.
 *
 * In demo mode there is no file behind the path, so rather than showing a
 * broken frame the viewer renders the document's own metadata as a facsimile
 * and says plainly that the file is not present. A blank grey rectangle would
 * read as a bug; this reads as a demonstration.
 */
export function DocumentViewer({
  document,
  url,
  open,
  onOpenChange,
  onAcknowledged,
}: {
  document: ProjectDocument;
  /** Signed URL, or null in demo mode. */
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged?: (signature: SignatureResult) => void;
}) {
  const { toast } = useToast();
  const [signing, setSigning] = React.useState(false);
  const [signature, setSignature] = React.useState<SignatureResult | null>(null);

  const acknowledge = () => {
    if (!signature) return;
    onAcknowledged?.(signature);
    setSigning(false);
    onOpenChange(false);
    toast({
      tone: "success",
      title: "Acknowledgement recorded",
      description: `${document.name} — signed as ${signature.name}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="p-0">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
          <DialogDescription>
            {humanise(document.category)} · {formatFileSize(document.size_bytes)}
            {document.issued_at ? ` · issued ${formatDate(document.issued_at, "medium")}` : ""}
            {document.version > 1 ? ` · version ${document.version}` : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-wrap gap-1.5 pb-3">
            {document.requires_ack ? (
              <Badge tone="warning" icon={ShieldCheck}>
                Needs acknowledgement
              </Badge>
            ) : null}
            {document.is_confidential ? (
              <Badge tone="neutral" icon={Lock}>
                Internal to the build team
              </Badge>
            ) : null}
            {document.expires_at ? (
              <Badge tone="neutral">Expires {formatDate(document.expires_at, "medium")}</Badge>
            ) : null}
          </div>

          {signing ? (
            <div className="border-line border-t pt-4">
              <p className="text-ink-2 mb-3 text-[13px] leading-relaxed">
                Acknowledging records that you have seen this document, with your name and the time.
                It is not a signature on the contract itself.
              </p>
              <SignaturePad onChange={setSignature} />
            </div>
          ) : url ? (
            <object
              data={url}
              type={document.mime_type}
              className="border-line h-[60vh] w-full border"
              aria-label={`Preview of ${document.name}`}
            >
              <DocumentFacsimile
                document={document}
                note="Your browser cannot preview this file."
              />
            </object>
          ) : (
            <DocumentFacsimile
              document={document}
              note="Running in demonstration mode, so there is no file behind this record. With storage connected, the document renders here."
            />
          )}
        </DialogBody>

        <DialogFooter>
          {signing ? (
            <>
              <Button variant="ghost" onClick={() => setSigning(false)}>
                Back
              </Button>
              <Button variant="primary" disabled={!signature} onClick={acknowledge}>
                <ShieldCheck />
                Record acknowledgement
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  toast({
                    tone: url ? "info" : "warning",
                    title: url ? "Download started" : "No file to download",
                    description: url
                      ? document.name
                      : "This is demonstration data — connect storage to download real documents.",
                  })
                }
              >
                <Download />
                Download
              </Button>
              {document.requires_ack ? (
                <Button variant="primary" onClick={() => setSigning(true)}>
                  <ShieldCheck />
                  Acknowledge
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A stand-in for the document itself, drawn in the deed language of the theme.
 * Shows what the record holds rather than pretending to be the file.
 */
function DocumentFacsimile({ document, note }: { document: ProjectDocument; note: string }) {
  return (
    <div className="border-line bg-surface-2 flex flex-col items-center border px-6 py-10">
      <div className="ui-card w-full max-w-md px-8 py-10">
        <p className="ui-label text-ink-3 text-[9px]">{humanise(document.category)}</p>
        <h3 className="ui-display text-ink mt-2 text-xl">{document.name}</h3>

        <div className="border-line-strong my-5 border-t" />

        <dl className="flex flex-col gap-2 text-[12px]">
          {[
            ["Issued", document.issued_at ? formatDate(document.issued_at, "long") : "—"],
            ["Version", String(document.version)],
            ["File size", formatFileSize(document.size_bytes)],
            ["Format", document.mime_type],
            ["Expires", document.expires_at ? formatDate(document.expires_at, "long") : "—"],
          ].map(([term, value]) => (
            <div key={term} className="border-line flex justify-between gap-4 border-b pb-1.5">
              <dt className="text-ink-3">{term}</dt>
              <dd className="text-ink font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex items-center gap-2">
          <FileText className="text-ink-3 size-4" aria-hidden="true" />
          <p className="text-ink-3 text-[11px] leading-relaxed">{note}</p>
        </div>
      </div>
    </div>
  );
}
