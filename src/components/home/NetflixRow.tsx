"use client";

/**
 * Netflix-style content row.
 *
 * On a precise pointer, hovering a card lifts it, scales it, and slides a
 * detail panel out beneath the artwork after a short dwell. The dwell matters:
 * expanding the instant the cursor crosses a card makes the whole row twitch
 * while you're just moving across it.
 *
 * Cards at the ends anchor their transform to the nearest edge so an expanded
 * card never grows off-screen — the detail Netflix gets right and most clones
 * miss.
 *
 * Touch gets none of this. There is no hover to dwell on, so cards stay a plain
 * scroll-snap rail with everything already visible.
 */

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { PlatformIcons } from "@/components/game/PlatformIcons";
import { WatchButton } from "@/components/game/WatchButton";
import { ScorePill } from "@/components/ui/ScoreRing";
import { useRichMotion } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import { releaseLabel } from "@/lib/utils/format";
import type { GameSummary } from "@/lib/games/types";

const HOVER_DELAY_MS = 420;

export function NetflixRow({
  games,
  priorityCount = 0,
}: {
  games: GameSummary[];
  priorityCount?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandable = useRichMotion();

  const syncEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdges();
    const el = railRef.current;
    if (!el) return;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncEdges, games.length]);

  useEffect(() => () => {
    if (dwell.current) clearTimeout(dwell.current);
  }, []);

  const enter = (index: number) => {
    if (!expandable) return;
    if (dwell.current) clearTimeout(dwell.current);
    dwell.current = setTimeout(() => setHovered(index), HOVER_DELAY_MS);
  };

  const leave = () => {
    if (dwell.current) clearTimeout(dwell.current);
    setHovered(null);
  };

  const scrollByPage = (direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (games.length === 0) return null;

  return (
    <div className="group/row relative" onMouseLeave={leave}>
      <div
        ref={railRef}
        onScroll={syncEdges}
        className={cn(
          "snap-rail rail-gutter gap-3 pb-3 sm:gap-4",
          // Expanded cards scale beyond their box, so the rail needs vertical
          // room to show them without clipping.
          expandable && "fine:overflow-y-visible fine:pt-6 fine:pb-24",
        )}
      >
        {games.map((game, i) => {
          const isHovered = hovered === i;
          // Anchor the growth inward at the ends so nothing escapes the viewport.
          const origin = i === 0 ? "left center" : i === games.length - 1 ? "right center" : "center";

          return (
            <div
              key={game.id}
              className="relative w-[42vw] max-w-[220px] sm:w-52 lg:w-56 xl:w-60"
              onMouseEnter={() => enter(i)}
              style={{ zIndex: isHovered ? 30 : 1 }}
            >
              <motion.div
                animate={
                  expandable
                    ? { scale: isHovered ? 1.18 : 1, y: isHovered ? -8 : 0 }
                    : { scale: 1, y: 0 }
                }
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: origin }}
                className={cn(
                  "relative rounded-2xl",
                  isHovered && "shadow-[0_32px_70px_-24px_rgba(0,0,0,0.85)]",
                )}
              >
                <Link
                  href={`/game/${game.slug}`}
                  className={cn(
                    "group/card relative block overflow-hidden rounded-2xl border border-line bg-panel",
                    "aspect-[3/4] transition-colors duration-300",
                    isHovered ? "border-line-strong" : "fine:hover:border-line-strong",
                  )}
                >
                  <GameCover
                    name={game.name}
                    slug={game.slug}
                    image={game.image}
                    imageFallback={game.imageFallback}
                    width={480}
                    priority={i < priorityCount}
                    sizes="(max-width: 640px) 42vw, 240px"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black via-black/65 to-transparent" />

                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
                    <div className="opacity-100 transition-opacity duration-300 fine:opacity-0 fine:group-hover/card:opacity-100">
                      <WatchButton game={game} />
                    </div>
                    <ScorePill score={game.metacritic} />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <h3 className="line-clamp-2 font-display text-[13.5px] font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-[15px]">
                      {game.name}
                    </h3>
                    <p className="mt-1.5 truncate text-[11px] text-white/70">
                      {releaseLabel(game)}
                    </p>
                  </div>
                </Link>

                {/* Detail shelf — desktop only, and only after the dwell. */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-x-0 top-full overflow-hidden rounded-b-2xl border border-t-0 border-line-strong bg-panel/95 backdrop-blur-xl"
                    >
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/game/${game.slug}`}
                            className="grid h-8 w-8 place-items-center rounded-full bg-white text-black transition-transform hover:scale-110"
                            aria-label={`Open ${game.name}`}
                          >
                            <Plus size={15} />
                          </Link>
                          {game.rating > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-mint">
                              <Star size={10} className="fill-mint" />
                              {game.rating.toFixed(1)}
                            </span>
                          )}
                          <PlatformIcons
                            platforms={game.parentPlatforms}
                            size={12}
                            max={4}
                            className="ml-auto"
                          />
                        </div>
                        {game.genres.length > 0 && (
                          <p className="mt-2 truncate text-[11px] text-muted">
                            {game.genres.slice(0, 3).map((genre) => genre.name).join(" · ")}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          );
        })}
      </div>

      <RowArrow direction="left" disabled={atStart} onClick={() => scrollByPage(-1)} />
      <RowArrow direction="right" disabled={atEnd} onClick={() => scrollByPage(1)} />
    </div>
  );
}

function RowArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-1/2 z-40 hidden -translate-y-1/2 fine:grid",
        "h-14 w-11 place-items-center rounded-xl bg-bg/80 text-text backdrop-blur-md",
        "opacity-0 transition-all duration-300 group-hover/row:opacity-100 focus-visible:opacity-100",
        "hover:bg-bg hover:scale-105 active:scale-95",
        "disabled:pointer-events-none disabled:opacity-0",
        direction === "left" ? "left-1" : "right-1",
      )}
    >
      <Icon size={22} />
    </button>
  );
}
