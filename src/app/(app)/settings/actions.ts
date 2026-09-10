"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSignedInUserId } from "@/lib/data/workspace";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

export interface SaveResult {
  ok: boolean;
  message: string;
  demo?: boolean;
}

const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  digestFrequency: z.enum(["instant", "daily", "weekly", "never"]),
  // Shape only: the database's `notification_type` enum is the authority on
  // which types exist, and rejects anything else.
  mutedTypes: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(30),
});

/**
 * Save the caller's notification preferences.
 *
 * The row is keyed by the session's user id, never by anything in the input,
 * and RLS only lets a person write their own row.
 */
export async function saveNotificationPreferences(
  input: z.input<typeof preferencesSchema>,
): Promise<SaveResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Those settings could not be saved." };

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, demo: true, message: "Demo mode — your choices are shown but not saved." };
  }

  const userId = await getSignedInUserId();
  if (!userId) return { ok: false, message: "You need to be signed in to save settings." };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      email_enabled: parsed.data.emailEnabled,
      push_enabled: parsed.data.pushEnabled,
      digest_frequency: parsed.data.digestFrequency,
      muted_types: parsed.data.mutedTypes,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    logError("save_preferences_failed", error);
    return { ok: false, message: "Your settings could not be saved. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Saved." };
}
