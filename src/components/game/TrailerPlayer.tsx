"use client";

/**
 * Trailer playback across two very different sources.
 *
 * Steam hosts real MP4s, which a native `<video>` plays with no third party
 * involved. IGDB stores only YouTube ids, so those need an embed — but the
 * embed is created *on click*, not on page load. That keeps YouTube's player
 * scripts and cookies off the page for everyone who never presses play, which
 * matters both for performance and for not silently handing every visitor to a
 * third-party tracker.
 */

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import type { Trailer } from "@/lib/games/types";
import { ResilientMediaImage } from "./ResilientMediaImage";

export function TrailerPlayer({
  trailer,
  /**
   * Starts immediately. Only ever set from the lightbox, which is opened by a
   * deliberate click — so this never autoplays unprompted.
   */
  autoPlay = false,
}: {
  trailer: Trailer;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);

  if (trailer.kind === "mp4" && trailer.url) {
    return (
      <video
        controls
        autoPlay={autoPlay}
        preload={autoPlay ? "auto" : "none"}
        poster={trailer.preview ?? undefined}
        className="h-full w-full bg-black"
      >
        <source src={trailer.url} type="video/mp4" />
        Your browser can&rsquo;t play this video.
      </video>
    );
  }

  if (trailer.kind !== "youtube" || !trailer.youtubeId) return null;

  if (playing) {
    return (
      <div className="relative h-full w-full bg-black">
        <iframe
          // `youtube-nocookie` avoids setting tracking cookies until playback.
          src={`https://www.youtube-nocookie.com/embed/${trailer.youtubeId}?autoplay=1&rel=0`}
          title={trailer.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0 bg-black"
        />
        <a href={trailer.url ?? `https://www.youtube.com/watch?v=${trailer.youtubeId}`} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 text-[11px] font-semibold text-white/80 backdrop-blur-md transition-colors hover:bg-black hover:text-white">Open on YouTube <ExternalLink size={12} /></a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${trailer.name}`}
      className="group relative block h-full w-full overflow-hidden bg-black"
    >
      {trailer.preview && (
        <ResilientMediaImage
          src={trailer.preview}
          alt=""
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
        />
      )}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-black/60 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <Play size={22} className="ml-0.5 fill-white text-white" />
        </span>
      </span>
    </button>
  );
}
