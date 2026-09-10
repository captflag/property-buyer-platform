"use client";

import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Browser Supabase client, used for realtime subscriptions and the handful of
 * reads that happen after hydration. Returns null when Supabase is not
 * configured so callers can fall back to demo mode instead of throwing.
 */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
