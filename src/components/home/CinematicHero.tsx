"use client";

/**
 * Full-bleed hero that autoplays the featured game's trailer.
 *
 * Sequence per slide: the key art loads instantly, then after a short beat the
 * trailer fades in over it and plays muted on a loop. Art-first is deliberate —
 * a video that has to buffer before anything appears reads as a slow page,
 * whereas a still that dissolves into motion reads as intentional.
 *
 * Hiding YouTube's chrome takes two things, because the player parameters alone
 * are not enough:
 *
 *  1. `controls=0&modestbranding=1&iv_load_policy=3&…` removes the controls,
 *     annotations and most branding.
 *  2. The iframe is then scaled well beyond the frame and centred, so the
 *     residual title bar and the share/watch-later buttons — which sit in the
 *     player's top corners and cannot be disabled — are pushed outside the
 *     visible area entirely.
 *
 * `pointer-events: none` on the video layer means nothing in it is clickable,
 * so no stray click can ever navigate to YouTube.
 *
 * Autoplay is desktop-only and respects reduced motion: on a phone it costs
 * data and battery for something the reader didn't ask for, so touch devices
 * get the artwork and an explicit play control instead.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Info, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { BackdropTrailer } from "@/components/game/BackdropTrailer";
import { GameCover } from "@/components/game/GameCover";
import { PlatformIcons } from "@/components/game/PlatformIcons";
import { WatchButton } from "@/components/game/WatchButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/SectionHeading";
import { useIsMobile, useRichMotion } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import { releaseLabelLong, relativeReleaseLabel, truncate } from "@/lib/utils/format";
import type { GameSummary } from "@/lib/games/types";

/** How long each slide holds before advancing. */
const SLIDE_MS = 15_000;
/** Beat before the trailer replaces the still. */
const TRAILER_DELAY_MS = 1800;

export function CinematicHero({ games }: { games: GameSummary[] }) {
  const featured = games.filter((game) => game.image || game.heroTrailer).slice(0, 6);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  /**
   * Which slide the trailer is cleared to play on, rather than a bare boolean.
   * Comparing against the current index means changing slides resets playback
   * implicitly — no state has to be written to undo the previous slide.
   */
  const [trailerReadyFor, setTrailerReadyFor] = useState<number | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduced = useReducedMotion();
  const richMotion = useRichMotion();
  const isMobile = useIsMobile();

  const active = featured[index];
  const trailer = active?.heroTrailer ?? null;
  // Autoplay is a desktop affordance; phones get artwork until asked.
  const canAutoplay = richMotion && !isMobile && !reduced && Boolean(trailer);

  const goTo = useCallback((next: number) => setIndex(next), []);

  // Advance the carousel.
  useEffect(() => {
    if (paused || featured.length <= 1) return;
    advanceTimer.current = setTimeout(
      () => setIndex((i) => (i + 1) % featured.length),
      SLIDE_MS,
    );
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [index, paused, featured.length]);

  // Bring the trailer in a beat after the art.
  useEffect(() => {
    if (!canAutoplay || paused) return;
    trailerTimer.current = setTimeout(() => setTrailerReadyFor(index), TRAILER_DELAY_MS);
    return () => {
      if (trailerTimer.current) clearTimeout(trailerTimer.current);
    };
  }, [index, canAutoplay, paused]);

  // Derived, so switching slides cancels the previous trailer for free.
  const showTrailer = trailerReadyFor === index && canAutoplay && !paused;

  // A carousel that ran while the tab was hidden is disorienting on return.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!active) return null;

  return (
    <section
      className="relative isolate flex min-h-[88svh] flex-col justify-end overflow-hidden lg:min-h-[92vh]"
      aria-roledescription="carousel"
      aria-label="Featured games"
    >
      {/* Stage */}
      <div className="absolute inset-0 -z-10 bg-bg">
        <AnimatePresence mode="sync">
          <motion.div
            key={`art-${active.id}`}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduced ? 1 : 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: SLIDE_MS / 1000, ease: "linear" },
            }}
          >
            <GameCover
              name={active.name}
              slug={active.slug}
              image={active.screenshots[0] ?? active.image}
              imageFallback={active.imageFallback}
              width={1920}
              priority
              sizes="100vw"
              rounded="rounded-none"
            />
          </motion.div>
        </AnimatePresence>

        {/* Keyed on the slide so switching games tears down the old player
            rather than leaving two iframes stacked. */}
        <BackdropTrailer
          key={`trailer-${active.id}`}
          trailer={showTrailer ? trailer : null}
          muted={muted}
          delayMs={0}
        />

        {/* Legibility stack. Two gradients: one anchors the copy, one keeps the
            whole frame from competing with it. */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/55 to-transparent lg:via-bg/25" />
      </div>

      <Container className="relative z-10 pb-6 pt-28 sm:pb-8 lg:pb-10 lg:pt-36">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{relativeReleaseLabel(active)}</Badge>
                {active.genres.slice(0, 2).map((genre) => (
                  <Badge key={genre.id}>{genre.name}</Badge>
                ))}
              </div>

              <h1 className="font-display text-[clamp(2.2rem,7.5vw,5rem)] font-black leading-[0.94] tracking-[-0.045em] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
                {active.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <span>{releaseLabelLong(active)}</span>
                <span aria-hidden className="h-1 w-1 rounded-full bg-faint" />
                <PlatformIcons platforms={active.parentPlatforms} size={15} max={5} tinted />
                {active.metacritic !== null && (
                  <>
                    <span aria-hidden className="h-1 w-1 rounded-full bg-faint" />
                    <span className="font-semibold text-mint">{active.metacritic}</span>
                  </>
                )}
              </div>

              {active.genres.length > 0 && (
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted sm:text-base">
                  {truncate(active.genres.map((g) => g.name).join(" · "), 120)}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button href={`/game/${active.slug}`} size="lg" iconRight={<ArrowRight size={17} />}>
                  View details
                </Button>
                <WatchButton game={active} variant="full" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>

      {/* Controls */}
      <Container className="relative z-10 pb-8 lg:pb-12">
        <div className="flex items-end justify-between gap-4">
          <div className="snap-rail min-w-0 flex-1 gap-2.5 pb-1 sm:gap-3">
            {featured.map((game, i) => (
              <button
                key={game.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${game.name}`}
                aria-current={i === index}
                className={cn(
                  "group relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition-all duration-500 sm:h-[72px] sm:w-32",
                  i === index
                    ? "border-brand/70 opacity-100 ring-2 ring-brand/25"
                    : "border-line opacity-45 fine:hover:scale-105 fine:hover:opacity-90",
                )}
              >
                <GameCover
                  name={game.name}
                  slug={game.slug}
                  image={game.screenshots[0] ?? game.image}
                  imageFallback={game.imageFallback}
                  width={320}
                  sizes="128px"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                {i === index && !paused && featured.length > 1 && (
                  <motion.span
                    key={`${game.id}-progress`}
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-brand"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canAutoplay && trailer && (
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute trailer" : "Mute trailer"}
                className="grid h-11 w-11 place-items-center rounded-full glass text-muted transition-colors hover:text-text"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Resume" : "Pause"}
              className="hidden h-11 w-11 place-items-center rounded-full glass text-muted transition-colors hover:text-text sm:grid"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <Link
              href="/upcoming"
              className="hidden items-center gap-2 rounded-full glass px-4 py-3 text-sm text-muted transition-colors hover:text-text lg:inline-flex"
            >
              <Info size={15} />
              Full calendar
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
