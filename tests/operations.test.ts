import { describe, expect, it } from "vitest";

import {
  digestEmailBody,
  digestIdempotencyKey,
  digestRecipients,
} from "@/lib/domain/digest-delivery";
import { createMemoryLimiter, retryMessage, type RateLimit } from "@/lib/rate-limit";

describe("createMemoryLimiter", () => {
  const LIMIT: RateLimit = { bucket: "question", max: 3, windowSeconds: 60 };
  // Ten seconds into a window.
  const WINDOW_START = 60_000 * 1_000;

  it("allows up to the limit in a window, then refuses with the time left", () => {
    let now = WINDOW_START + 10_000;
    const take = createMemoryLimiter({ now: () => now });

    expect([take(LIMIT, "a"), take(LIMIT, "a"), take(LIMIT, "a")].every((r) => r.allowed)).toBe(
      true,
    );
    expect(take(LIMIT, "a")).toEqual({ allowed: false, retryAfterSeconds: 50 });

    // Someone else has their own allowance.
    expect(take(LIMIT, "b").allowed).toBe(true);

    // The next window starts clean.
    now = WINDOW_START + 60_000;
    expect(take(LIMIT, "a").allowed).toBe(true);
  });

  it("forgets the oldest caller rather than growing without bound", () => {
    const take = createMemoryLimiter({ now: () => WINDOW_START, maxKeys: 2 });
    const once: RateLimit = { ...LIMIT, max: 1 };

    take(once, "a");
    expect(take(once, "a").allowed).toBe(false);
    take(once, "b");
    take(once, "c"); // evicts "a"
    expect(take(once, "a").allowed).toBe(true);
  });

  it("says when to try again in words", () => {
    expect(retryMessage(30)).toBe("Try again in 30 seconds.");
    expect(retryMessage(240)).toBe("Try again in 4 minutes.");
  });
});

describe("digestRecipients", () => {
  const members = [
    { project_id: "p1", user_id: "weekly" },
    { project_id: "p1", user_id: "daily" },
    { project_id: "p1", user_id: "no-email" },
    { project_id: "p1", user_id: "no-preferences" },
    { project_id: "p1", user_id: "no-address" },
    { project_id: "p2", user_id: "other-project" },
    { project_id: "p1", user_id: "weekly" },
  ];
  const preferences = [
    { user_id: "weekly", email_enabled: true, digest_frequency: "weekly" },
    { user_id: "daily", email_enabled: true, digest_frequency: "daily" },
    { user_id: "no-email", email_enabled: false, digest_frequency: "weekly" },
    { user_id: "no-address", email_enabled: true, digest_frequency: "weekly" },
    { user_id: "other-project", email_enabled: true, digest_frequency: "weekly" },
  ];
  const profiles = [
    { id: "weekly", email: "weekly@example.com", full_name: "Weekly Reader" },
    { id: "daily", email: "daily@example.com", full_name: null },
    { id: "no-email", email: "off@example.com", full_name: null },
    { id: "no-preferences", email: "defaults@example.com", full_name: null },
    { id: "no-address", email: "  ", full_name: null },
    { id: "other-project", email: "elsewhere@example.com", full_name: null },
  ];

  it("emails only members of this project who chose the weekly email, once each", () => {
    expect(digestRecipients({ projectId: "p1", members, preferences, profiles })).toEqual([
      { userId: "weekly", email: "weekly@example.com", name: "Weekly Reader" },
    ]);
  });

  it("keys a send by person, project and week", () => {
    expect(digestIdempotencyKey("p1", "u1", "2026-09-14")).toBe("digest:p1:u1:2026-09-14");
    expect(digestIdempotencyKey("p1", "u1", "2026-09-14")).not.toBe(
      digestIdempotencyKey("p1", "u1", "2026-09-21"),
    );
  });

  it("says how to change or stop it at the foot of every email", () => {
    expect(digestEmailBody("Body", "https://kestrel.example")).toContain(
      "https://kestrel.example/settings",
    );
  });
});
