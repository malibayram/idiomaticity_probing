import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Renders a sentence with the target multiword expression highlighted.
 * `span` is a [start, end) token index range (whitespace tokenization),
 * matching the NCIMP context schema. When span is null we fall back to a
 * substring match on `surface`.
 */
export function SpanText({
  sentence,
  span,
  surface,
  className,
  highlightSuffix,
}: {
  sentence: string;
  span: [number, number] | null;
  surface?: string;
  className?: string;
  highlightSuffix?: ReactNode;
}) {
  const tokens = sentence.split(/(\s+)/); // keep whitespace tokens for round-trip

  if (span) {
    // Map word index range to the whitespace-aware token array.
    const [start, end] = span;
    let wordIdx = -1;
    return (
      <span className={className}>
        {tokens.map((tok, i) => {
          const isWord = tok.trim().length > 0;
          if (isWord) wordIdx += 1;
          const inSpan = isWord && wordIdx >= start && wordIdx < end;
          const isSpanEnd = inSpan && wordIdx === end - 1;
          return inSpan ? (
            <span key={i}>
              <mark className="rounded bg-[hsl(var(--warning))]/30 px-0.5 font-medium text-[hsl(var(--foreground))]">
                {tok}
              </mark>
              {isSpanEnd ? highlightSuffix : null}
            </span>
          ) : (
            <span key={i}>{tok}</span>
          );
        })}
      </span>
    );
  }

  if (surface && sentence.includes(surface)) {
    const idx = sentence.indexOf(surface);
    return (
      <span className={className}>
        {sentence.slice(0, idx)}
        <mark className="rounded bg-[hsl(var(--warning))]/30 px-0.5 font-medium text-[hsl(var(--foreground))]">
          {surface}
        </mark>
        {highlightSuffix}
        {sentence.slice(idx + surface.length)}
      </span>
    );
  }

  return <span className={cn(className)}>{sentence}</span>;
}
