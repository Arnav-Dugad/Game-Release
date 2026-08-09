"use client";

/**
 * A saved game as a poster tile, for the personal collection pages.
 *
 * Deliberately built from `WatchlistEntry` rather than `GameSummary`: the
 * library and watchlist render entirely from the Firestore snapshot they
 * already hold, so a tile must not require a catalogue lookup to draw itself.
 *
 * Kept separate from `GameCard` for the same reason — that component takes a
 * full game record and carries the ownership control, neither of which applies
 * to a list where every entry is already owned or tracked.
 */

import Link from "next/link";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { GameCover } from "./GameCover";
import { ScorePill } from "@/components/ui/ScoreRing";
import { OWNERSHIP_PLATFORMS } from "@/lib/games/stores-catalog";
import { cn } from "@/lib/utils/cn";
import type { WatchlistEntry } from "@/lib/firebase/db";

export function PosterTile({
  entry,
  size = "compact",
  badge,
}: {
  entry: WatchlistEntry;
  size?: "compact" | "large";
  /** Small caption under the title — status, date, whatever the page cares about. */
  badge?: string;
}) {
  const owned = entry.ownedOn ?? [];

  return (
    <Link href={`/game/${entry.slug}`} className="group/tile block">
      <div
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-panel",
          "transition-[border-color,box-shadow,transform] duration-500",
          "fine:group-hover/tile:border-line-strong fine:group-hover/tile:-translate-y-1",
          "fine:group-hover/tile:shadow-[0_20px_50px_-20px_rgba(124,92,255,0.5)]",
        )}
      >
        <GameCover
          name={entry.name}
          slug={entry.slug}
          image={entry.image}
          imageFallback={entry.imageFallback}
          width={size === "large" ? 480 : 320}
          sizes={size === "large" ? "(max-width: 640px) 46vw, 240px" : "(max-width: 640px) 30vw, 180px"}
          className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] fine:group-hover/tile:scale-105"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1.5 p-2">
          {owned.length > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-mint/90 px-1.5 py-1 text-black shadow-lg">
              {owned.slice(0, 2).map((slug) => {
                const platform = OWNERSHIP_PLATFORMS.find((p) => p.slug === slug);
                return platform?.icon ? (
                  <BrandIcon key={slug} name={platform.icon} size={11} title={platform.name} />
                ) : null;
              })}
              {owned.length > 2 && (
                <span className="text-[9px] font-bold tabular-nums">+{owned.length - 2}</span>
              )}
            </span>
          ) : (
            <span />
          )}
          <ScorePill score={entry.metacritic} />
        </div>
      </div>

      <p
        className={cn(
          "mt-2 line-clamp-2 font-display font-semibold leading-snug transition-colors fine:group-hover/tile:text-brand-soft",
          size === "large" ? "text-sm" : "text-[12px]",
        )}
      >
        {entry.name}
      </p>
      {badge && <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-faint">{badge}</p>}
    </Link>
  );
}
