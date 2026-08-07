import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Wordmark. The bracket glyphs are separate spans so they can be animated
 * independently — they pull inward on hover, which reads as the mark
 * "focusing" without any layout shift.
 */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="LUDEX — home"
      className={cn("group inline-flex items-center gap-2", className)}
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-brand),var(--color-neon))]">
        <span className="font-display text-[15px] font-black leading-none text-white">L</span>
        <span
          aria-hidden
          className="absolute inset-0 translate-y-full bg-white/25 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
        />
      </span>

      {!compact && (
        <span className="font-display text-[17px] font-black tracking-[-0.02em] text-text">
          <span
            aria-hidden
            className="inline-block text-brand-soft transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1"
          >
            [
          </span>
          LUDEX
          <span
            aria-hidden
            className="inline-block text-brand-soft transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-1"
          >
            ]
          </span>
        </span>
      )}
    </Link>
  );
}
