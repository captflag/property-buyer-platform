import "server-only";

import { cache } from "react";

import { getSignedInUserId } from "@/lib/data/workspace";
import type { DigestFrequency } from "@/lib/domain/digest-delivery";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/database";

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestFrequency: DigestFrequency;
  mutedTypes: NotificationType[];
}

/** The table's defaults, shown until someone saves their own. */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  pushEnabled: true,
  digestFrequency: "daily",
  mutedTypes: [],
};

/** The signed-in person's notification preferences, or the defaults. */
export const getNotificationPreferences = cache(async (): Promise<NotificationPreferences> => {
  if (!isSupabaseConfigured()) return DEFAULT_PREFERENCES;

  const [supabase, userId] = await Promise.all([createClient(), getSignedInUserId()]);
  if (!supabase || !userId) return DEFAULT_PREFERENCES;

  // RLS limits this to the caller's own row.
  const { data } = await supabase
    .from("notification_preferences")
    .select("email_enabled, push_enabled, digest_frequency, muted_types")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFERENCES;

  return {
    emailEnabled: data.email_enabled,
    pushEnabled: data.push_enabled,
    digestFrequency: data.digest_frequency,
    mutedTypes: data.muted_types ?? [],
  };
});
