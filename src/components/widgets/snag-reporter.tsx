"use client";

import { Camera, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import * as React from "react";

import { reportSnag, type ActionResult } from "@/app/(app)/buyer-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui/form";
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
import { cn } from "@/lib/utils";

const SEVERITIES = [
  { value: "low", label: "Minor", detail: "Cosmetic — a scuff, a mark, a gap in the silicone." },
  {
    value: "medium",
    label: "Noticeable",
    detail: "Works, but not right — a sticking door, a loose fitting.",
  },
  {
    value: "high",
    label: "Serious",
    detail: "Leaks, safety, or something that stops a room being used.",
  },
] as const;

interface LocalSnag {
  title: string;
  room: string;
  severity: string;
}

/**
 * Snag reporting for the buyer.
 *
 * Built for a phone held in one hand in a half-finished room: few fields, a
 * camera input that opens the rear camera directly, and severity described by
 * what the buyer can see rather than by the build team's triage vocabulary.
 * The buyer suggests a severity; the build team owns the final one.
 */
export function SnagReporter({ rooms }: { rooms: string[] }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [room, setRoom] = React.useState("");
  const [severity, setSeverity] = React.useState<(typeof SEVERITIES)[number]["value"]>("medium");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<LocalSnag[]>([]);
  const lastSubmitted = React.useRef<LocalSnag | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = React.useActionState<ActionResult | null, FormData>(
    reportSnag,
    null,
  );

  // Revoke the preview URL whenever it changes or the reporter unmounts, or
  // every photo picked leaks its decoded image for the life of the tab.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok || state.demo) {
      if (lastSubmitted.current) {
        const snag = lastSubmitted.current;
        setRecent((current) => [snag, ...current]);
      }
      toast({
        tone: state.ok ? "success" : "info",
        title: "Snag reported",
        description: state.ok ? state.message : "Shown here, but not saved — this is demo data.",
      });
      formRef.current?.reset();
      setRoom("");
      setSeverity("medium");
      setPreview(null);
      setOpen(false);
    }
  }, [state, toast]);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <TriangleAlert />
        Report a snag
      </Button>

      {recent.length > 0 ? (
        <ul className="sr-only" aria-live="polite">
          {recent.map((snag, i) => (
            <li key={`${snag.title}-${i}`}>Reported: {snag.title}</li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Report a snag</DialogTitle>
            <DialogDescription>
              Something not right? Tell the site team what and where. A photo makes it far quicker
              to fix.
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            action={formAction}
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              lastSubmitted.current = {
                title: String(data.get("title") ?? ""),
                room: String(data.get("room") ?? ""),
                severity: String(data.get("severity") ?? ""),
              };
            }}
          >
            <input type="hidden" name="room" value={room} />
            <input type="hidden" name="severity" value={severity} />

            <DialogBody className="flex flex-col gap-4">
              <Field label="What's wrong" htmlFor="snag-title" required>
                <Input
                  name="title"
                  placeholder="e.g. Bedroom door catches on the frame"
                  maxLength={160}
                  required
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="snag-room" className="ui-label text-ink-2 text-[10px]">
                  Room
                  <span className="text-critical ml-0.5" aria-hidden="true">
                    *
                  </span>
                </label>
                <Select value={room} onValueChange={setRoom}>
                  <SelectTrigger id="snag-room" aria-required="true">
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <fieldset>
                <legend className="ui-label text-ink-2 mb-2 text-[10px]">How bad is it?</legend>
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                  {SEVERITIES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={severity === option.value}
                      onClick={() => setSeverity(option.value)}
                      className={cn(
                        "border p-3 text-left transition-colors",
                        "focus-visible:ring-ring focus-visible:ring-2",
                        severity === option.value
                          ? "border-brand bg-brand-subtle/50 border-2"
                          : "border-line hover:bg-surface-2",
                      )}
                    >
                      <span className="text-ink block text-[13px] font-semibold">
                        {option.label}
                      </span>
                      <span className="text-ink-3 mt-0.5 block text-[11px] leading-snug">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Details"
                htmlFor="snag-description"
                hint="Where exactly, and anything you noticed."
              >
                <Textarea name="description" rows={3} maxLength={2000} />
              </Field>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="snag-photo"
                  className="border-line-strong hover:bg-surface-2 flex cursor-pointer items-center gap-3 border border-dashed p-3 transition-colors"
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local object URL cannot go through the image optimiser
                    <img
                      src={preview}
                      alt="The photo you picked"
                      className="size-16 object-cover"
                    />
                  ) : (
                    <span className="bg-surface-3 text-ink-3 grid size-16 place-items-center">
                      <Camera className="size-5" aria-hidden="true" />
                    </span>
                  )}
                  <span>
                    <span className="text-ink block text-[13px] font-medium">
                      {preview ? "Change photo" : "Add a photo"}
                    </span>
                    <span className="text-ink-3 block text-[11px]">
                      JPEG, PNG or WebP, up to 10 MB
                    </span>
                  </span>
                </label>
                <input
                  id="snag-photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </div>

              {state && !state.ok && !state.demo ? (
                <Alert tone="critical" icon={Info}>
                  {state.message}
                </Alert>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !room}>
                <CheckCircle2 />
                {pending ? "Sending…" : "Report snag"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
