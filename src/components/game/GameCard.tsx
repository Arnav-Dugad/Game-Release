"use client";

/**
 * The primary game tile.
 *
 * The poster carries the art and nothing else. Titles, dates and scores used to
 * be printed over the bottom of the cover behind a heavy scrim, which meant
 * every card dimmed its own artwork to stay legible and the text still competed
 * with whatever was underneath. Moving the name below the frame lets the art be
 * art, and makes a wall of covers scan as a shelf rather than a wall of
 * captions.
 *
 * Only two things stay on the poster, because both answer a question you have
 * *before* reading the title: whether you already own it, and what the critics
 * made of it.
 *
 * Desktop and touch get materially different affordances rather than one design
 * scaled down:
 *  - fine pointers: 3D tilt, a glare sweep, and the ownership control fading in
 *    on hover
 *  - coarse pointers: no tilt, the control permanently visible at a 44px
 *    target, and press feedback via `active:scale`
 */

import Link from "next/link";
import { TiltCard } from "@/components/motion/TiltCard";
import { GameCover } from "./GameCover";
import { OwnedBadge } from "./OwnedBadge";
import { OwnershipPicker } from "./OwnershipPicker";
import { ScorePill } from "@/components/ui/ScoreRing";
import { cn } from "@/lib/utils/cn";
import { isUnreleased } from "@/lib/utils/format";
import type { GameSummary } from "@/lib/games/types";

interface GameCardProps {
  game: GameSummary;
  priority?: boolean;
  className?: string;
  /** Poster is the default 3:4 tile; wide is a 16:9 tile for editorial rails. */
  shape?: "poster" | "wide";
  sizes?: string;
  /** Set false where the surrounding UI already offers the control. */
  showOwnership?: boolean;
  /** Larger type for the big-poster layouts in the library and watchlist. */
  size?: "default" | "large";
}

export function GameCard({
  game,
  priority = false,
  className,
  shape = "poster",
  sizes,
  showOwnership = true,
  size = "default",
}: GameCardProps) {
  const upcoming = isUnreleased(game);

  return (
    <div className={cn("group/card", className)}>
      <TiltCard className="rounded-2xl" intensity={7} scale={1.03}>
        <Link
          href={`/game/${game.slug}`}
          aria-label={game.name}
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

          {/* A light top-down wash only — just enough to seat the badges. The
              heavy bottom scrim went away with the caption it existed for. */}
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            <OwnedBadge gameId={game.id} />
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <ScorePill score={game.metacritic} />
              {upcoming && (
                <span className="rounded-md bg-brand/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  Soon
                </span>
              )}
            </div>
          </div>

          {/* Hover-only inner glow ring. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-inset ring-brand/40 transition-opacity duration-500 fine:group-hover:opacity-100"
          />
        </Link>
      </TiltCard>

      <div className="mt-2.5 flex items-start gap-2">
        <Link
          href={`/game/${game.slug}`}
          className={cn(
            "min-w-0 flex-1 font-display font-semibold leading-snug text-text transition-colors",
            "line-clamp-2 fine:group-hover/card:text-brand-soft",
            size === "large" ? "text-[15px] lg:text-base" : "text-[13px] lg:text-sm",
          )}
        >
          {game.name}
        </Link>

        {/*
          Ownership rather than the watchlist.

          "Do I own this?" is the question people are actually answering while
          scrolling a catalogue, and it is the one the site can act on later —
          for the library, planner, and recommendations. The watchlist still
          lives on the game page, where there is room to explain it.
        */}
        {showOwnership && (
          <OwnershipPicker
            game={game}
            variant="icon"
            className="-mt-0.5 shrink-0 opacity-100 transition-opacity duration-300 fine:opacity-0 fine:group-hover/card:opacity-100 fine:group-focus-within/card:opacity-100"
          />
        )}
      </div>
    </div>
  );
}
