"use client";

import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import * as React from "react";

import { cn, localId } from "@/lib/utils";

/**
 * Toasts.
 *
 * Hand-rolled rather than pulled from a library, for two reasons: the app needs
 * exactly one notification pattern, and the accessibility contract here is
 * specific enough that a generic component would need overriding anyway.
 *
 * That contract: the region is a polite live region, so a success message is
 * announced without interrupting whatever the user is reading. Errors escalate
 * to `role="alert"` on the individual toast, because a failed save is worth
 * interrupting for. Nothing auto-dismisses if it is an error -- a message that
 * disappears before it is read is the same as no message.
 */

export type ToastTone = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. Errors default to never. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id">;

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: OctagonAlert,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "border-l-brand",
  success: "border-l-good",
  warning: "border-l-warning",
  error: "border-l-critical",
};

const ICON_CLASSES: Record<ToastTone, string> = {
  info: "text-brand",
  success: "text-good",
  warning: "text-warning",
  error: "text-critical",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = localId("toast");
      // Errors persist until dismissed. Everything else clears itself.
      const duration = input.duration ?? (input.tone === "error" ? 0 : 5000);

      setToasts((current) => [...current.slice(-3), { ...input, id }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  // Clear every pending timer if the provider unmounts mid-flight.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed z-[80] flex flex-col gap-2",
          // Above the mobile tab bar on small screens; bottom-right elsewhere.
          "right-3 bottom-20 left-3 sm:right-5 sm:bottom-5 sm:left-auto sm:w-88",
        )}
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : undefined}
              className={cn(
                "ui-panel animate-fade-in-up pointer-events-auto flex gap-3 border-l-4 p-3.5",
                TONE_CLASSES[item.tone],
              )}
            >
              <Icon
                className={cn("mt-0.5 size-4 shrink-0", ICON_CLASSES[item.tone])}
                strokeWidth={2.25}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="text-ink text-[13px] font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="text-ink-2 mt-0.5 text-[12px] leading-relaxed">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.action!.onClick();
                      dismiss(item.id);
                    }}
                    className="text-brand mt-1.5 text-[12px] font-semibold hover:underline"
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="text-ink-3 hover:text-ink -mt-0.5 -mr-0.5 shrink-0 self-start p-1"
                aria-label={`Dismiss: ${item.title}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
