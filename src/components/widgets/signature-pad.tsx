"use client";

import { Eraser } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Signature capture.
 *
 * Offers two routes deliberately, and treats them as equal rather than as a
 * primary and a fallback: draw it, or type your name. Drawing requires fine
 * motor control and a pointing device, so a drawn-signature-only flow locks
 * out keyboard users and anyone with a tremor -- for something as consequential
 * as acknowledging a contract document, that is not acceptable.
 *
 * Both produce the same thing: a name string, and optionally an image. The
 * legal weight sits in the recorded intent and timestamp, not in the ink.
 */

export interface SignatureResult {
  name: string;
  /** PNG data URL when drawn; null when typed. */
  image: string | null;
}

export function SignaturePad({
  onChange,
  className,
}: {
  onChange: (result: SignatureResult | null) => void;
  className?: string;
}) {
  const [mode, setMode] = React.useState<"draw" | "type">("type");
  const [typedName, setTypedName] = React.useState("");
  const [hasInk, setHasInk] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const lastPoint = React.useRef<{ x: number; y: number } | null>(null);

  // Size the backing store to the device pixel ratio, or the line is a blurry
  // approximation of where the pointer actually went.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#16281e";
  }, [mode]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = pointFrom(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    const from = lastPoint.current;
    if (!context || !from) return;

    const to = pointFrom(event);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    lastPoint.current = to;

    if (!hasInk) setHasInk(true);
  };

  // Bumped on every completed stroke, so the emit effect below re-runs and
  // re-reads the canvas. Using a counter rather than calling the callback from
  // the pointer handler keeps emission in exactly one place.
  const [strokeCount, setStrokeCount] = React.useState(0);

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    setStrokeCount((n) => n + 1);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    setStrokeCount((n) => n + 1);
  };

  // The callback is held in a ref so it can be called from the effect without
  // being a dependency -- a parent passing an inline function would otherwise
  // re-run this on every render of theirs.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  React.useEffect(() => {
    const name = typedName.trim();

    if (mode === "type") {
      onChangeRef.current(name.length >= 2 ? { name, image: null } : null);
      return;
    }

    const canvas = canvasRef.current;
    onChangeRef.current(
      canvas && hasInk && name.length >= 2 ? { name, image: canvas.toDataURL("image/png") } : null,
    );
  }, [mode, typedName, hasInk, strokeCount]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="radiogroup" aria-label="How to sign" className="flex gap-1">
        {(["type", "draw"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            variant={mode === option ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setMode(option)}
          >
            {option === "type" ? "Type my name" : "Draw my signature"}
          </Button>
        ))}
      </div>

      <Field
        label="Full name"
        htmlFor="signature-name"
        required
        hint="Recorded against the acknowledgement, whichever method you use."
      >
        <Input
          name="signatureName"
          value={typedName}
          onChange={(event) => setTypedName(event.target.value)}
          placeholder="Amara Okafor"
          autoComplete="name"
        />
      </Field>

      {mode === "draw" ? (
        <div className="flex flex-col gap-2">
          <div className="border-line-strong bg-surface relative border">
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className="block h-32 w-full cursor-crosshair touch-none"
              aria-label="Signature drawing area"
            />
            {!hasInk ? (
              <p className="text-ink-3 pointer-events-none absolute inset-0 grid place-items-center text-[12px]">
                Sign here
              </p>
            ) : null}
            {/* The signature rule, as on a printed form. */}
            <span className="bg-line pointer-events-none absolute right-6 bottom-6 left-6 h-px" />
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={clear} className="self-start">
            <Eraser />
            Clear
          </Button>
        </div>
      ) : (
        <div className="border-line-strong bg-surface-2 flex h-24 items-center justify-center border">
          <span className="ui-display text-ink text-[26px]">
            {typedName.trim() || (
              <span className="text-ink-3 text-[14px]">Your name appears here</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
