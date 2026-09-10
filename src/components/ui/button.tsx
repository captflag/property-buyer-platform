import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    // Glass capsules: tracked uppercase labels on frosted pills, with the
    // primary action in liquid gold.
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold uppercase tracking-[0.12em]",
    "rounded-full",
    "transition-[background-color,background-position,border-color,color,box-shadow,transform] duration-200",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-px",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Metallic gold is reserved for the one action that matters on a screen.
        primary: "ui-gold",
        secondary: "ui-glass-button text-ink",
        ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
        subtle: "bg-brand-subtle text-brand-subtle-ink hover:bg-surface-3",
        danger: "bg-critical text-white hover:brightness-110",
        link: "text-ink underline decoration-accent underline-offset-4 hover:decoration-2 p-0 h-auto normal-case tracking-normal",
      },
      size: {
        sm: "h-8 px-3 text-[11px] [&_svg]:size-3.5",
        md: "h-10 px-4 text-[12px] [&_svg]:size-4",
        lg: "h-12 px-6 text-[13px] [&_svg]:size-[18px]",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export { buttonVariants };
