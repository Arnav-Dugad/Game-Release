"use client";

/**
 * Horizontally-scrolling media rail with a full-screen lightbox.
 *
 * Used for both screenshots and trailers so the two behave identically —
 * previously they were a grid and a stacked list, which meant two different
 * interaction models for the same kind of content on the same page.
 *
 * The rail is a native scroll-snap container at every breakpoint. An earlier
 * version switched to a CSS grid on desktop via a `fine:` variant, which
 * collided with the `display: flex` on the rail utility (same cascade layer,
 * equal specificity — so the winner depended on stylesheet order) and could
 * leave the whole section invisible. One layout, no conflict.
 */

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Play, X } from "lucide-react";
import { TrailerPlayer } from "./TrailerPlayer";
import { sizedImage } from "@/lib/games/image";
import { useEscapeKey, useIsMobile, useLockBodyScroll } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type { Trailer } from "@/lib/games/types";

export type MediaItem =
  | { kind: "image"; src: string; caption?: string }
  | { kind: "trailer"; trailer: Trailer };

const posterOf = (item: MediaItem): string | null =>
  item.kind === "image" ? item.src : item.trailer.preview;

const captionOf = (item: MediaItem, index: number): string =>
  item.kind === "image" ? (item.caption ?? `Screenshot ${index + 1}`) : item.trailer.name;

export function MediaGallery({
  items,
  gameName,
  /** Wider tiles suit trailers, which carry a caption under them. */
  size = "wide",
}: {
  items: MediaItem[];
  gameName: string;
  size?: "wide" | "standard";
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const isMobile = useIsMobile();

  const close = useCallback(() => setOpenAt(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenAt((current) =>
        current === null ? null : (current + delta + items.length) % items.length,
      ),
    [items.length],
  );

  useEscapeKey(close, openAt !== null);
  useLockBodyScroll(openAt !== null);

  useEffect(() => {
    if (openAt === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAt, step]);

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
  }, [syncEdges, items.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const tileWidth =
    size === "wide"
      ? "w-[78vw] max-w-[560px] sm:w-[440px] lg:w-[520px]"
      : "w-[72vw] max-w-[420px] sm:w-[340px] lg:w-[400px]";

  const active = openAt !== null ? items[openAt] : null;

  return (
    <div className="group/media relative">
      <div
        ref={railRef}
        onScroll={syncEdges}
        className="snap-rail gap-3 pb-2 sm:gap-4"
      >
        {items.map((item, i) => {
          const poster = posterOf(item);
          return (
            <div key={`${item.kind}-${i}`} className={tileWidth}>
              <button
                type="button"
                onClick={() => setOpenAt(i)}
                aria-label={
                  item.kind === "trailer"
                    ? `Play ${item.trailer.name}`
                    : `View screenshot ${i + 1} of ${items.length}`
                }
                className="group/tile relative block aspect-video w-full overflow-hidden rounded-xl border border-line bg-panel transition-colors duration-300 fine:hover:border-line-strong"
              >
                {poster ? (
                  <Image
                    src={sizedImage(poster, 720) ?? poster}
                    alt={`${gameName} — ${captionOf(item, i)}`}
                    fill
                    sizes="(max-width: 640px) 78vw, 520px"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] fine:group-hover/tile:scale-105"
                  />
                ) : (
                  <span className="absolute inset-0 bg-panel-2" />
                )}

                <span className="absolute inset-0 bg-black/25 opacity-0 transition-opacity duration-300 fine:group-hover/tile:opacity-100" />

                {item.kind === "trailer" ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 backdrop-blur-sm transition-transform duration-300 fine:group-hover/tile:scale-110">
                      <Play size={20} className="ml-0.5 fill-white text-white" />
                    </span>
                  </span>
                ) : (
                  <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 fine:group-hover/tile:opacity-100">
                    <Expand size={14} />
                  </span>
                )}
              </button>

              {item.kind === "trailer" && (
                <p className="mt-2 truncate px-0.5 text-sm text-muted">{item.trailer.name}</p>
              )}
            </div>
          );
        })}
      </div>

      <RailArrow direction="left" disabled={atStart} onClick={() => scrollByPage(-1)} />
      <RailArrow direction="right" disabled={atEnd} onClick={() => scrollByPage(1)} />

      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/93 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            <motion.div
              key={openAt}
              className="relative z-10 w-full max-w-6xl px-3 sm:px-8"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              drag={isMobile && active.kind === "image" ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) step(1);
                else if (info.offset.x > 80) step(-1);
              }}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                {active.kind === "image" ? (
                  <Image
                    src={sizedImage(active.src, 1920) ?? active.src}
                    alt={`${gameName} screenshot`}
                    fill
                    sizes="100vw"
                    priority
                    className="object-contain"
                  />
                ) : (
                  // `autoPlay` only ever fires from an explicit click here, so
                  // it can't surprise anyone with unexpected sound.
                  <TrailerPlayer trailer={active.trailer} autoPlay />
                )}
              </div>

              <p className="mt-3 text-center text-xs text-faint">
                <span className="tabular-nums">
                  {openAt! + 1} / {items.length}
                </span>
                {items.length > 1 && (
                  <>
                    <span className="ml-2 hidden fine:inline">· Use ← → to navigate</span>
                    <span className="ml-2 fine:hidden">· Swipe to navigate</span>
                  </>
                )}
              </p>
            </motion.div>

            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
            >
              <X size={18} />
            </button>

            {items.length > 1 && (
              <>
                <LightboxArrow direction="left" onClick={() => step(-1)} />
                <LightboxArrow direction="right" onClick={() => step(1)} />
              </>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RailArrow({
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
        "absolute top-1/2 hidden -translate-y-1/2 fine:grid",
        "h-11 w-11 place-items-center rounded-full glass glass-blur text-text",
        "opacity-0 transition-all duration-300 group-hover/media:opacity-100 focus-visible:opacity-100",
        "hover:scale-110 hover:border-line-strong active:scale-95",
        "disabled:pointer-events-none disabled:opacity-0",
        direction === "left" ? "-left-4" : "-right-4",
      )}
    >
      <Icon size={18} />
    </button>
  );
}

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 fine:grid",
        direction === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon size={20} />
    </button>
  );
}
