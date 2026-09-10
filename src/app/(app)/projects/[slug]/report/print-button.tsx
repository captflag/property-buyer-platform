"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Opens the browser's print dialog.
 *
 * Deliberately not a "Download PDF" button: the browser's own dialog already
 * offers "Save as PDF" on every platform, renders with the real print
 * stylesheet, and does not need a server round trip or a PDF library. A custom
 * export would produce a worse document and a larger bundle.
 */
export function PrintButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => window.print()}>
      <Printer />
      Print or save as PDF
    </Button>
  );
}
