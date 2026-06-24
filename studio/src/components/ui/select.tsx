import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Lightweight native select styled to match the design system. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
