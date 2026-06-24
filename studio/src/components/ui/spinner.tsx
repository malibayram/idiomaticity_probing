import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin", className)} />;
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-[hsl(var(--muted-foreground))]">
      <Spinner className="h-6 w-6" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
