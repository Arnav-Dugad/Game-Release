"use client";

/**
 * The primary game tile.
 *
 * Desktop and touch get materially different affordances rather than one
 * design scaled down:
 *  - fine pointers: 3D tilt, a glare sweep, the watch button fading in on
 *    hover, and a custom-cursor label
 *  - coarse pointers: no tilt at all, watch button permanently visible at a
 *    44px target, and press feedback via `active:scale`
 */

import Link from "next/link";
import { CalendarDays, Star } from "lucide-react";
import { TiltCard } from "@/components/motion/TiltCard";
import { GameCover } from "./GameCover";
import { PlatformIcons } from "./PlatformIcons";
import { WatchButton } from "./WatchButton";
import { ScorePill } from "@/components/ui/ScoreRing";
import { cn } from "@/lib/utils/cn";
import { isUnreleased, releaseLabel, relativeReleaseLabel } from "@/lib/utils/format";
import type { GameSummary } from "@/lib/games/types";

interface GameCardProps {
  game: GameSummary;
  priority?: boolean;
  className?: string;
  /** Poster is the default 3:4 tile; wide is a 16:9 tile for editorial rails. */
  shape?: "poster" | "wide";
  sizes?: string;
  showWatch?: boolean;
}

export function GameCard({
  game,
  priority = false,
  className,
  shape = "poster",
  sizes,
  showWatch = true,
}: GameCardProps) {
  const upcoming = isUnreleased(game);

  return (
    <TiltCard className={cn("rounded-2xl", className)} intensity={7} scale={1.03}>
      <Link
        href={`/game/${game.slug}`}
        data-cursor="view"
        data-cursor-label="View"
        className={cn(
          "group relative block w-full overflow-hidden rounded-2xl border border-line bg-panel",
          "transition-[border-color,box-shadow] duration-500",
          "fine:hover:border-line-strong fine:hover:shadow-[0_24px_60px_-24px_rgba(124,92,255,0.55)]",
          "active:scale-[0.985] coarse:transition-transform",
          shape === "poster" ? "aspect-[3/4]" : "aspect-[16/9]",
        )}
      >
        <GameCover
          name={game.name}
          slug={game.slug}
          image={game.image}
          imageFallback={game.imageFallback}
          width={shape === "poster" ? 480 : 640}
          priority={priority}
          sizes={
            sizes ??
            (shape === "poster"
              ? "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px"
              : "(max-width: 640px) 86vw, (max-width: 1024px) 46vw, 420px")
          }
          className="transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] fine:group-hover:scale-[1.07]"
        />

        {/* Two-stop scrim: a hard base for text contrast, plus a wider soft
            wash so the image doesn't end abruptly. */}
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/25" />

        {/* Top row */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          {showWatch ? (
            <div className="opacity-100 transition-opacity duration-300 fine:opacity-0 fine:group-hover:opacity-100 fine:group-focus-within:opacity-100">
              <WatchButton game={game} />
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-end gap-1.5">
            <ScorePill score={game.metacritic} />
            {upcoming && (
              <span className="rounded-md bg-brand/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                Soon
              </span>
            )}
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 lg:p-4">
          <h3
            className={cn(
              "font-display font-semibold leading-tight text-white",
              "text-[13.5px] sm:text-[15px] lg:text-base",
              "line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
            )}
          >
            {game.name}
          </h3>

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/70">
              <CalendarDays size={11} className="shrink-0" />
              <span className="truncate">{releaseLabel(game)}</span>
            </p>
            {game.rating > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-white/80 tabular-nums">
                <Star size={10} className="fill-gold text-gold" />
                {game.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Platforms slide in on hover; always shown on touch where there's
              no hover state to reveal them. */}
          <div
            className={cn(
              "mt-2 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "fine:max-h-0 fine:opacity-0 fine:group-hover:max-h-8 fine:group-hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <PlatformIcons platforms={game.parentPlatforms} />
              <span className="truncate text-[10px] text-white/45">
                {relativeReleaseLabel(game)}
              </span>
            </div>
          </div>
        </div>

        {/* Hover-only inner glow ring. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-inset ring-brand/40 transition-opacity duration-500 fine:group-hover:opacity-100"
        />
      </Link>
    </TiltCard>
  );
}
