"use client";

/**
 * Poster density control for the personal collection pages.
 *
 * A library is browsed by *recognising* covers, not by reading titles, so the
 * right size genuinely differs by person and by collection size — twelve games
 * want big art, four hundred want a dense grid. Rather than guess, this is a
 * preference, persisted per device so it survives a reload.
 */

import { useCallback } from "react";
import { LayoutGrid, Rows3, StretchHorizontal } from "lucide-react";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { cn } from "@/lib/utils/cn";

export type PosterSize = "list" | "compact" | "large";

const OPTIONS: { value: PosterSize; label: string; icon: typeof Rows3 }[] = [
  { value: "list", label: "List", icon: Rows3 },
  { value: "compact", label: "Compact posters", icon: LayoutGrid },
  { value: "large", label: "Large posters", icon: StretchHorizontal },
];

const isPosterSize = (value: unknown): value is PosterSize =>
  value === "list" || value === "compact" || value === "large";

/**
 * Reads and persists the choice for one page, keyed so pages differ freely.
 *
 * Backed by the shared preferences store rather than its own `localStorage`
 * key, so density syncs to the account alongside reduced motion —
 * the alternative left one preference stranded on the device while its
 * neighbours followed the reader everywhere.
 */
export function usePosterSize(key: string, fallback: PosterSize = "compact") {
  const { posterSizes, setPosterSize } = usePreferences();

  const stored = posterSizes[key];
  const size: PosterSize = isPosterSize(stored) ? stored : fallback;

  const setSize = useCallback(
    (next: PosterSize) => setPosterSize(key, next),
    [key, setPosterSize],
  );

  return { size, setSize };
}

/** Grid classes for a chosen density. */
export function posterGridClass(size: PosterSize): string {
  switch (size) {
    case "list":
      return "grid-cols-1";
    case "large":
      return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
    default:
      return "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7";
  }
}

export function PosterSizeToggle({
  size,
  onChange,
  className,
}: {
  size: PosterSize;
  onChange: (size: PosterSize) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Poster size"
      className={cn(
        "flex items-center gap-1 rounded-full border border-line bg-white/[0.04] p-1",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.label}
            aria-pressed={size === option.value}
            title={option.label}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full transition-colors",
              size === option.value ? "bg-white/10 text-text" : "text-faint hover:text-text",
            )}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
