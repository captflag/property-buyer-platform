"use client";

import { Info, LogIn } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";

import { signIn, type AuthResult } from "../actions";

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [state, formAction, pending] = React.useActionState<AuthResult | null, FormData>(
    signIn,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Email" htmlFor="email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </Field>

      {state && !state.ok ? (
        <Alert tone={state.demo ? "warning" : "critical"} icon={state.demo ? Info : undefined}>
          {state.message}
        </Alert>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending || demo}>
        <LogIn />
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
