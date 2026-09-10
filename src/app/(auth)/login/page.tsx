import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-ink text-2xl font-semibold tracking-[-0.02em]">Sign in</h1>
      <p className="text-ink-2 mt-1.5 text-[13px]">
        Access your project&apos;s progress, documents and payments.
      </p>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <LoginForm next={next} demo={!isSupabaseConfigured()} />
        </CardContent>
      </Card>

      <p className="text-ink-3 mt-5 text-center text-[13px]">
        No account yet?{" "}
        <Link href="/signup" className="text-brand font-medium hover:underline">
          Create one
        </Link>
      </p>

      {!isSupabaseConfigured() ? (
        <div className="border-line mt-6 rounded-[var(--radius-card)] border border-dashed p-4 text-center">
          <p className="text-ink-2 text-[12px] leading-relaxed">
            This deployment is running without a database, so sign-in is unavailable. The whole
            platform is browsable with a fully populated example project.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href="/dashboard">Open the demo</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
