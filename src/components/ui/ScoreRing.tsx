"use client";

/**
 * Circular critic-score meter.
 *
 * The arc is drawn with `stroke-dasharray` on an SVG circle and animated by
 * transitioning `stroke-dashoffset` from empty to its final value when the ring
 * scrolls into view. Colour follows Metacritic's own banding via `scoreColor`.
 */

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { scoreColor } from "@/lib/utils/format";

interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function ScoreRing({
  score,
  size = 76,
  strokeWidth = 5,
  className,
  label = "Metascore",
}: ScoreRingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
  const colour = scoreColor(score);

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? `${label}: not rated` : `${label}: ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: inView ? circumference * (1 - pct) : circumference,
          }}
          transition={
            reduced ? { duration: 0 } : { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }
          }
          style={{ filter: `drop-shadow(0 0 6px ${colour}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold leading-none tabular-nums"
          style={{ color: colour, fontSize: size * 0.3 }}
        >
          {score === null ? "—" : score}
        </span>
      </div>
    </div>
  );
}

/** Compact score chip for dense card corners, where a ring would be illegible. */
export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return null;
  const colour = scoreColor(score);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none",
        className,
      )}
      style={{
        color: colour,
        backgroundColor: `color-mix(in oklab, ${colour} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${colour} 32%, transparent)`,
      }}
      aria-label={`Metascore ${score}`}
    >
      {score}
    </span>
  );
}
