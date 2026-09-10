"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      // Noir is a night scene first: dark by default, with crisp white one
      // click away for anyone who prefers it (or whose OS asks for it).
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

/**
 * Reports false during server rendering and the first client render, then true.
 *
 * `useSyncExternalStore` is the right tool rather than a setState-in-effect
 * flag: it has separate server and client snapshots by design, so it expresses
 * "are we hydrated yet" without scheduling an extra render pass.
 */
const noopSubscribe = () => () => {};
function useMounted(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Theme switcher.
 *
 * Renders a stable placeholder until mounted. `useTheme` cannot know the
 * resolved theme during SSR, so rendering the real icon immediately guarantees
 * a hydration mismatch -- and a console error on every single page load is not
 * something to ship.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  const active = options.find((o) => o.value === theme) ?? options[2];
  const Icon = mounted ? active.icon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change colour theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            className={mounted && theme === option.value ? "text-ink font-medium" : undefined}
          >
            <option.icon />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
