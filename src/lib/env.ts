import { z } from "zod";

/**
 * Environment access.
 *
 * The app is designed to boot with nothing configured. Supabase and the AI
 * assistant are each detected independently, and the UI degrades to a clearly
 * labelled demonstration mode rather than crashing on a missing key. That
 * property is what makes the project cloneable and runnable in one command,
 * and it is enforced by `isSupabaseConfigured()` being the only way anything
 * reaches for the database.
 *
 * `NEXT_PUBLIC_*` values must be referenced as full literal property accesses
 * on `process.env` -- Next inlines them at build time by textual substitution,
 * so a computed lookup like `process.env[name]` silently yields undefined in
 * the browser.
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5"),
  // Scheduled jobs (`/api/cron/*`) refuse to run without it.
  CRON_SECRET: z.string().min(16).optional(),
  // Outgoing email. Without both, the digest scheduler does a dry run.
  RESEND_API_KEY: z.string().min(1).optional(),
  DIGEST_FROM_EMAIL: z.string().min(3).optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

export const env = {
  ...publicEnv,
  get server() {
    if (typeof window !== "undefined") {
      throw new Error("env.server was read in the browser. Server secrets stay on the server.");
    }
    return serverSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
      CRON_SECRET: process.env.CRON_SECRET || undefined,
      RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
      DIGEST_FROM_EMAIL: process.env.DIGEST_FROM_EMAIL || undefined,
    });
  },
};

/** True when both Supabase public values are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when the assistant can call a real model rather than the local fallback. */
export function isAiConfigured(): boolean {
  if (typeof window !== "undefined") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
