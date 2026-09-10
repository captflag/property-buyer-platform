"use client";

import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { cn, localId } from "@/lib/utils";
import type { AiCitation } from "@/types/database";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  source?: "model" | "local";
}

const SUGGESTIONS = [
  "Why has the completion date moved?",
  "Is the build over budget?",
  "What is happening on site this week?",
  "When is my next payment due?",
  "What issues are still open?",
];

export function AssistantChat({
  slug,
  projectName,
  aiEnabled,
}: {
  slug: string;
  projectName: string;
  aiEnabled: boolean;
}) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    const userMessage: Message = { id: localId("msg"), role: "user", content: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, slug, history }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The assistant is unavailable right now.");
      }

      const answer = (await response.json()) as {
        content: string;
        citations: AiCitation[];
        source: "model" | "local";
      };

      setMessages((current) => [
        ...current,
        {
          id: localId("msg"),
          role: "assistant",
          content: answer.content,
          citations: answer.citations,
          source: answer.source,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[32rem] flex-col gap-3">
      <div
        className="flex-1 scrollbar-thin overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Conversation with the project assistant"
      >
        {messages.length === 0 ? (
          <Welcome projectName={projectName} onPick={send} aiEnabled={aiEnabled} />
        ) : (
          <ol className="flex flex-col gap-5 pb-2">
            {messages.map((message) => (
              <li key={message.id}>
                <MessageBubble message={message} />
              </li>
            ))}
            {pending ? (
              <li>
                <div className="flex gap-3">
                  <Bubble role="assistant" />
                  <div className="flex items-center gap-1.5 pt-2">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="bg-ink-3 size-1.5 animate-bounce rounded-full"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                    <span className="sr-only">The assistant is composing a reply</span>
                  </div>
                </div>
              </li>
            ) : null}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      {error ? (
        <Alert tone="critical" title="Could not get an answer">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="relative"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Ask a question about your project
        </label>
        <Textarea
          id="assistant-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter makes a new line. This is a chat box, and
            // people expect Enter to send in one.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          placeholder={`Ask about ${projectName} — progress, costs, delays, documents…`}
          rows={2}
          disabled={pending}
          className="resize-none pr-12"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon-sm"
          disabled={pending || !input.trim()}
          className="absolute right-2 bottom-2"
          aria-label="Send question"
        >
          <ArrowUp />
        </Button>
      </form>

      <p className="text-ink-3 text-[11px] leading-relaxed">
        {aiEnabled
          ? "Answers come from your project's own records and cite the entries they used. The assistant does not have information beyond what is on this platform."
          : "Running without a model key, so answers come from a built-in responder reading the same project records. It handles the common questions and will say when something is outside what it holds."}
      </p>
    </div>
  );
}

function Welcome({
  projectName,
  onPick,
  aiEnabled,
}: {
  projectName: string;
  onPick: (question: string) => void;
  aiEnabled: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-8 text-center">
      <span className="bg-brand-subtle text-brand-subtle-ink grid size-12 place-items-center rounded-[var(--radius-card)]">
        <Bot className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <h2 className="text-ink mt-4 text-lg font-semibold tracking-[-0.02em]">
        Ask anything about {projectName}
      </h2>
      <p className="text-ink-2 mt-2 max-w-md text-[13px] leading-relaxed">
        The assistant reads your milestones, site updates, budget, payments, issues and documents,
        and answers from those. If it does not know something, it says so rather than guessing.
      </p>

      {!aiEnabled ? (
        <p className="text-ink-3 bg-surface-2 mt-4 max-w-md rounded-[var(--radius-card)] px-3 py-2 text-[11px] leading-relaxed">
          <Sparkles className="mr-1 inline size-3" aria-hidden="true" />
          No model key is configured, so the built-in responder is answering. Set{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> for full natural-language answers.
        </p>
      ) : null}

      <ul className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <Button variant="secondary" size="sm" onClick={() => onPick(suggestion)}>
              {suggestion}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Bubble role={message.role} />

      <div className={cn("max-w-[min(42rem,85%)] min-w-0", isUser && "flex flex-col items-end")}>
        <Card
          className={cn(
            "px-4 py-3",
            isUser ? "bg-brand text-brand-ink border-transparent" : "bg-surface",
          )}
        >
          <div
            className={cn(
              "text-[13px] leading-relaxed whitespace-pre-wrap",
              isUser ? "text-brand-ink" : "text-ink-2",
            )}
          >
            {message.content}
          </div>
        </Card>

        {message.citations && message.citations.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-ink-3 text-[10px] font-medium tracking-wide uppercase">
              Based on
            </span>
            {message.citations.map((citation) => (
              <span
                key={`${citation.kind}-${citation.id}`}
                className="bg-surface-3 text-ink-2 rounded px-1.5 py-0.5 text-[11px]"
              >
                {citation.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bubble({ role }: { role: "user" | "assistant" }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full",
        role === "user" ? "bg-surface-3 text-ink-2" : "bg-brand-subtle text-brand-subtle-ink",
      )}
      aria-hidden="true"
    >
      {role === "user" ? (
        <User className="size-3.5" strokeWidth={2} />
      ) : (
        <Bot className="size-3.5" strokeWidth={2} />
      )}
    </span>
  );
}
