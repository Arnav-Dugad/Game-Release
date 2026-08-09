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
 * no stray click can navigate to YouTube.
 *
 * ---------------------------------------------------------------------------
 * Proving the video actually plays
 *
 * A large share of game trailers are age-restricted, and those render YouTube's
 * "This video is age-restricted and only available on YouTube" panel *inside*
 * the frame — full-width grey text across the hero, which is worse than having
 * no video at all.
 *
 * None of the cheap server-side checks catch it: oEmbed returns 200 for
 * age-restricted videos (verified against Cyberpunk 2077's trailers), and the
 * embed page resolves its playability client-side, so fetching its HTML reveals
 * nothing either.
 *
 * So the player is asked directly. With `enablejsapi=1` the embed answers a
 * `{"event":"listening"}` handshake over `postMessage` and then reports its own
 * state. The iframe is mounted but held at `opacity: 0` until it confirms it is
 * *playing*; anything else — an error code, a restriction panel, autoplay
 * refused by the browser — simply never reveals it, and the still artwork
 * underneath remains. Proving success rather than guessing failure means every
 * unknown degrades to the artwork, which is the desired fallback anyway.
 */

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRichMotion } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type { Trailer } from "@/lib/games/types";

/** Beat before the trailer replaces the still, so the page never opens blank. */
const DEFAULT_DELAY_MS = 1800;

/**
 * How long the player gets to report that it is playing.
 *
 * Generous enough for a cold embed on a slow connection, short enough that a
 * blocked video doesn't leave the hero waiting on something that will never
 * arrive.
 */
const PLAYBACK_GRACE_MS = 6000;

/** YouTube's player states; 1 is PLAYING. */
const STATE_PLAYING = 1;

export function youtubeBackdropSrc(id: string, muted: boolean, origin?: string): string {
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
    // Opens the postMessage channel the playback check depends on.
    enablejsapi: "1",
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function BackdropTrailer({
  trailer,
  muted = true,
  delayMs = DEFAULT_DELAY_MS,
  className,
  onPlayingChange,
}: {
  trailer: Trailer | null;
  muted?: boolean;
  delayMs?: number;
  className?: string;
  /**
   * Fires when playback is confirmed or lost. The carousel uses this to hold a
   * slide longer once a trailer is genuinely running, rather than guessing.
   */
  onPlayingChange?: (playing: boolean) => void;
}) {
  const richMotion = useRichMotion();
  const [mounted, setMounted] = useState(false);
  /** Flips true only once the player reports it is actually playing. */
  const [confirmed, setConfirmed] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const youtubeId = trailer?.kind === "youtube" ? trailer.youtubeId ?? null : null;
  const videoUrl = trailer?.kind !== "youtube" ? trailer?.url ?? null : null;

  useEffect(() => {
    if (!richMotion || !trailer) {
      // Deferred a frame so nothing is written during the effect itself.
      const frame = requestAnimationFrame(() => setMounted(false));
      return () => cancelAnimationFrame(frame);
    }
    const id = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(id);
  }, [richMotion, trailer, delayMs]);

  // A new video is unproven until it says otherwise.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setConfirmed(false));
    return () => cancelAnimationFrame(frame);
  }, [youtubeId, videoUrl]);

  // Reported as an effect rather than from the message handler so the parent
  // hears every transition, including the reset above.
  useEffect(() => {
    onPlayingChange?.(confirmed);
  }, [confirmed, onPlayingChange]);

  /* --- The postMessage conversation with YouTube's player ---------------- */
  useEffect(() => {
    if (!mounted || !youtubeId) return;

    const win = frameRef.current?.contentWindow;
    if (!win) return;

    const send = (event: string) => {
      try {
        win.postMessage(JSON.stringify({ event, id: youtubeId, channel: "widget" }), "*");
      } catch {
        /* frame torn down mid-handshake */
      }
    };

    // The embed only starts reporting after it hears this, and it can miss the
    // first one if it is still booting — hence the short repeat.
    const handshake = setInterval(() => send("listening"), 400);

    const onMessage = (event: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(event.origin).hostname)) return;
      let payload: { event?: string; info?: unknown };
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (payload?.event === "onError") {
        // 101/150 are "embedding disabled by request"; anything else is just as
        // unplayable for our purposes.
        clearInterval(handshake);
        setConfirmed(false);
        return;
      }

      /*
       * The state arrives under two different shapes, and only one of them is
       * the documented `onStateChange`. In practice the embed reports almost
       * everything through `infoDelivery`, whose `info` is a status object
       * carrying `playerState` — listening only for `onStateChange` means the
       * "it's playing" signal never arrives and every trailer stays hidden.
       */
      const info = payload?.info;
      const state =
        typeof info === "number"
          ? info
          : (info as { playerState?: number } | undefined)?.playerState;

      if (
        state === STATE_PLAYING &&
        (payload?.event === "onStateChange" || payload?.event === "infoDelivery")
      ) {
        clearInterval(handshake);
        setConfirmed(true);
      }
    };

    window.addEventListener("message", onMessage);
    // Nothing confirmed in time means blocked, restricted, or autoplay refused.
    const giveUp = setTimeout(() => clearInterval(handshake), PLAYBACK_GRACE_MS);

    return () => {
      clearInterval(handshake);
      clearTimeout(giveUp);
      window.removeEventListener("message", onMessage);
    };
  }, [mounted, youtubeId]);

  const onVideoPlaying = useCallback(() => setConfirmed(true), []);

  const playable = Boolean(youtubeId || videoUrl);
  if (!mounted || !trailer || !playable) return null;

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      // Nothing inside is interactive, so no click can reach YouTube.
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <AnimatePresence>
        {/*
          Always mounted so it can play and report; only ever *revealed* once it
          confirms. An age-restricted video therefore loads, fails, and is never
          shown — the artwork underneath simply stays.
        */}
        <motion.div
          key={youtubeId ?? videoUrl}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: confirmed ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {youtubeId ? (
            <iframe
              ref={frameRef}
              key={`${youtubeId}-${muted}`}
              src={youtubeBackdropSrc(
                youtubeId,
                muted,
                typeof window !== "undefined" ? window.location.origin : undefined,
              )}
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
          ) : videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              autoPlay
              muted={muted}
              loop
              playsInline
              onPlaying={onVideoPlaying}
              poster={trailer.preview ?? undefined}
              className="h-full w-full object-cover"
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
