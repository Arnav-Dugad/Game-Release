import Image from "next/image";
import { sizedImage } from "@/lib/games/image";
import { hueFromString, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Cover art with a designed fallback.
 *
 * When a title has no artwork — true for every entry in the sample catalogue,
 * and for plenty of unannounced games in live data — this renders generated
 * art derived deterministically from the slug rather than a grey box. The hue
 * is stable across server and client, so covers never flicker on hydration.
 */

interface GameCoverProps {
  name: string;
  slug: string;
  image: string | null;
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
  width = 480,
  className,
  priority = false,
  sizes = "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px",
  rounded = "rounded-[inherit]",
}: GameCoverProps) {
  if (image) {
    return (
      <Image
        src={sizedImage(image, width) ?? image}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", rounded, className)}
      />
    );
  }

  return <GeneratedCover name={name} slug={slug} className={cn(rounded, className)} />;
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
