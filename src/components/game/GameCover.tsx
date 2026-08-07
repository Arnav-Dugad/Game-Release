"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { sizedImage } from "@/lib/games/image";
import { hueFromString, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Cover art with a two-stage fallback.
 *
 * Providers hand back the best-looking asset they have, which is not always the
 * one that exists. Steam's portrait library capsule is a proper 600x900 poster
 * and looks far better in a 3:4 card than the 16:9 header — but it is missing
 * for a minority of apps and 404s. Rather than settle for the worse asset
 * everywhere, this tries the poster first and swaps to the guaranteed header on
 * a load error.
 *
 * When every source is exhausted (or a title genuinely has no art, which is
 * common for unannounced games), it renders generated art derived
 * deterministically from the slug — never a broken image or a grey box.
 *
 * Failed URLs are tracked by value rather than by index, so changing the `image`
 * prop — as the hero carousel does on every rotation — naturally re-tries the
 * new source without needing a reset.
 */

interface GameCoverProps {
  name: string;
  slug: string;
  image: string | null;
  /** Tried only if `image` fails to load. */
  imageFallback?: string | null;
  /** Rendered CSS width, used to request a correctly-sized source asset. */
  width?: number;
  className?: string;
  priority?: boolean;
  /** Passed straight to next/image; must describe the real rendered width. */
  sizes?: string;
  rounded?: string;
}

export function GameCover({
  name,
  slug,
  image,
  imageFallback = null,
  width = 480,
  className,
  priority = false,
  sizes = "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px",
  rounded = "rounded-[inherit]",
}: GameCoverProps) {
  const [failed, setFailed] = useState<string[]>([]);

  const sources = useMemo(
    () =>
      [image, imageFallback]
        .filter((src): src is string => Boolean(src))
        .map((src) => sizedImage(src, width) ?? src),
    [image, imageFallback, width],
  );

  const src = sources.find((candidate) => !failed.includes(candidate)) ?? null;

  if (!src) {
    return <GeneratedCover name={name} slug={slug} className={cn(rounded, className)} />;
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed((prev) => (prev.includes(src) ? prev : [...prev, src]))}
      className={cn("object-cover", rounded, className)}
    />
  );
}

export function GeneratedCover({
  name,
  slug,
  className,
}: {
  name: string;
  slug: string;
  className?: string;
}) {
  const hue = hueFromString(slug);
  const hue2 = (hue + 48) % 360;

  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        background: `linear-gradient(155deg, hsl(${hue} 62% 24%) 0%, hsl(${hue2} 58% 12%) 55%, hsl(${hue} 45% 7%) 100%)`,
      }}
    >
      {/* Soft key light, offset so the composition isn't centred. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 22% 12%, hsl(${hue2} 85% 62% / 0.42), transparent 62%)`,
        }}
      />
      {/* Diagonal rules add texture without reading as a placeholder pattern. */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.9) 0 1px, transparent 1px 13px)",
        }}
      />
      {/* The container establishes the query context so the initials scale with
          the card's own width, not the viewport. */}
      <div className="absolute inset-0 flex items-center justify-center [container-type:inline-size]">
        <span className="font-display text-[26cqw] font-black leading-none tracking-tighter text-white/[0.13] select-none">
          {initials(name)}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
    </div>
  );
}
