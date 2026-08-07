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

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import type { Trailer } from "@/lib/games/types";

export function TrailerPlayer({ trailer }: { trailer: Trailer }) {
  const [playing, setPlaying] = useState(false);

  if (trailer.kind === "mp4" && trailer.url) {
    return (
      <video
        controls
        preload="none"
        poster={trailer.preview ?? undefined}
        className="aspect-video w-full bg-black"
      >
        <source src={trailer.url} type="video/mp4" />
        Your browser can&rsquo;t play this video.
      </video>
    );
  }

  if (trailer.kind !== "youtube" || !trailer.youtubeId) return null;

  if (playing) {
    return (
      <iframe
        // `youtube-nocookie` avoids setting tracking cookies until playback.
        src={`https://www.youtube-nocookie.com/embed/${trailer.youtubeId}?autoplay=1&rel=0`}
        title={trailer.name}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full border-0 bg-black"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${trailer.name}`}
      data-cursor="view"
      data-cursor-label="Play"
      className="group relative block aspect-video w-full overflow-hidden bg-black"
    >
      {trailer.preview && (
        <Image
          src={trailer.preview}
          alt=""
          fill
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
