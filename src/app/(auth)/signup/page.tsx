import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-ink text-2xl font-semibold tracking-[-0.02em]">Create an account</h1>
      <p className="text-ink-2 mt-1.5 text-[13px]">
        Your builder will add you to your project once you have signed up.
      </p>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <SignupForm demo={!isSupabaseConfigured()} />
        </CardContent>
      </Card>

      <p className="text-ink-3 mt-5 text-center text-[13px]">
        Already have an account?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
