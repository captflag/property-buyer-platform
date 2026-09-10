"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  ok: boolean;
  message: string;
  demo?: boolean;
}

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Passwords must be at least 8 characters."),
  next: z.string().startsWith("/").max(300).optional().or(z.literal("")),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Tell us your name.").max(120),
  role: z.enum(["buyer", "builder"]).default("buyer"),
});

const DEMO_NOTICE =
  "This deployment has no database connected, so accounts cannot be created or signed in to. Everything is browsable in demo mode without an account.";

export async function signIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? "",
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, message: first ?? "Check your details and try again." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, demo: true, message: DEMO_NOTICE };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: distinguishing "no such account" from "wrong
    // password" tells an attacker which addresses are registered.
    return { ok: false, message: "That email and password do not match an account." };
  }

  redirect(parsed.data.next || "/dashboard");
}

export async function signUp(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role") ?? "buyer",
    next: "",
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, message: first ?? "Check your details and try again." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, demo: true, message: DEMO_NOTICE };

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      // Consumed by the handle_new_user() trigger to seed the profile row.
      data: { full_name: parsed.data.fullName, role: parsed.data.role },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: "Check your email for a confirmation link to finish setting up your account.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
