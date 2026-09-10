import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Server Supabase client, scoped to the caller's session cookies.
 *
 * Returns null when Supabase is not configured, so every call site is forced to
 * decide what demo mode looks like rather than discovering it as a runtime
 * crash.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session on every request, so dropping the
          // write here is safe rather than a silent auth bug.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely -- use only for trusted background
 * work (seeding, webhooks, scheduled jobs) and never in a path that renders
 * data for a specific user.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) return null;

  return createServerClient(supabaseUrl, key, {
    cookies: {
      getAll: () => [],
      setAll: () => undefined,
    },
  });
}

/** The signed-in user, or null in demo mode / when signed out. */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/** The signed-in user's profile row, joined with their auth identity. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return data;
}

export { supabaseAnonKey, supabaseUrl };
