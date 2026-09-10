import Link from "next/link";

import { ThemeToggle } from "@/components/layout/theme-provider";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-3 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="bg-brand text-brand-ink grid size-7 place-items-center rounded-[var(--radius-card)] text-[13px] font-bold"
          >
            K
          </span>
          <span className="text-ink text-[14px] font-semibold tracking-[-0.01em]">Kestrel</span>
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">{children}</main>

      <footer className="text-ink-3 px-5 py-6 text-center text-[12px]">
        Property Buyer Platform — transparent construction reporting.
      </footer>
    </div>
  );
}
