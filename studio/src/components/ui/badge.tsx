import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        outline: "border border-[hsl(var(--border))]",
        success: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
        warning: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
        destructive:
          "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]",
        primary:
          "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
