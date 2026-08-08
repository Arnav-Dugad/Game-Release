"use client";

/**
 * A trailer playing as a page backdrop, with no player chrome.
 *
 * Shared by the homepage hero and every game page, so "cinematic backdrop"
 * behaves identically wherever it appears.
 *
 * Hiding YouTube's UI takes two things, because the embed parameters alone are
 * not enough:
 *
 *  1. `controls=0&modestbranding=1&iv_load_policy=3&…` removes the control bar,
 *     annotations and most branding.
 *  2. The iframe is then scaled well beyond the frame and centred, so the
 *     residual title bar and the share/watch-later buttons — which live in the
 *     player's top corners and cannot be disabled by any parameter — are pushed
 *     outside the visible area entirely.
 *
 * `pointer-events: none` covers the rest: nothing in the layer is clickable, so
 * no stray click can navigate to YouTube, and the paused-state overlay can
 * never be triggered by the reader.
 *
 * Autoplay is deliberately desktop-only and respects reduced motion. On a phone
 * an autoplaying video costs data and battery for something nobody asked for,
 * so touch devices keep the still artwork.
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRichMotion } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type { Trailer } from "@/lib/games/types";

/** Beat before the trailer replaces the still, so the page never opens blank. */
const DEFAULT_DELAY_MS = 1800;

export function youtubeBackdropSrc(id: string, muted: boolean): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    showinfo: "0",
    iv_load_policy: "3",
    disablekb: "1",
    fs: "0",
    playsinline: "1",
    cc_load_policy: "0",
    // A single-video playlist is what makes `loop` actually loop.
    loop: "1",
    playlist: id,
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function BackdropTrailer({
  trailer,
  muted = true,
  delayMs = DEFAULT_DELAY_MS,
  className,
}: {
  trailer: Trailer | null;
  muted?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const richMotion = useRichMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!richMotion || !trailer) {
      // Deferred a frame so nothing is written during the effect itself.
      const frame = requestAnimationFrame(() => setVisible(false));
      return () => cancelAnimationFrame(frame);
    }
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [richMotion, trailer, delayMs]);

  const playable =
    trailer && ((trailer.kind === "youtube" && trailer.youtubeId) || trailer.url);

  return (
    <AnimatePresence>
      {visible && playable && (
        <motion.div
          key={trailer.kind === "youtube" ? trailer.youtubeId : trailer.url}
          className={cn("absolute inset-0 overflow-hidden", className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          // Nothing inside is interactive, so no click can reach YouTube.
          style={{ pointerEvents: "none" }}
          aria-hidden
        >
          {trailer.kind === "youtube" && trailer.youtubeId ? (
            <iframe
              key={`${trailer.youtubeId}-${muted}`}
              src={youtubeBackdropSrc(trailer.youtubeId, muted)}
              title=""
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden
              /*
               * Oversized and centred: this is what actually removes the
               * player's title bar and corner buttons. `min-w-[177.77vh]`
               * keeps the 16:9 crop correct on short, wide viewports where a
               * percentage width alone would letterbox.
               */
              className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0",
                "h-[300%] w-[300%] sm:h-[180%] sm:w-[180%] lg:h-[145%] lg:w-[145%]",
                "min-h-[100vh] min-w-[177.77vh]",
              )}
            />
          ) : trailer.url ? (
            <video
              key={trailer.url}
              src={trailer.url}
              autoPlay
              muted={muted}
              loop
              playsInline
              poster={trailer.preview ?? undefined}
              className="h-full w-full object-cover"
            />
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
