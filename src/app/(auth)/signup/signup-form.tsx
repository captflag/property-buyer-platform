"use client";

import { Info, UserPlus } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";

import { signUp, type AuthResult } from "../actions";

export function SignupForm({ demo }: { demo: boolean }) {
  const [state, formAction, pending] = React.useActionState<AuthResult | null, FormData>(
    signUp,
    null,
  );
  const [role, setRole] = React.useState("buyer");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />

      <Field label="Full name" htmlFor="fullName" required>
        <Input name="fullName" autoComplete="name" placeholder="Amara Okafor" required />
      </Field>

      <Field label="Email" htmlFor="email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint="At least 8 characters. Longer is better than more complicated."
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role-select" className="text-ink text-[13px] font-medium">
          I am a
        </label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="role-select" aria-label="Account type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer">Property buyer</SelectItem>
            <SelectItem value="builder">Builder or contractor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state ? (
        <Alert
          tone={state.ok ? "good" : state.demo ? "warning" : "critical"}
          icon={state.demo ? Info : undefined}
        >
          {state.message}
        </Alert>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending || demo}>
        <UserPlus />
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-ink-3 text-[11px] leading-relaxed">
        Creating an account does not give you access to a project on its own — your builder adds you
        to it, and that is what decides what you can see.
      </p>
    </form>
  );
}
