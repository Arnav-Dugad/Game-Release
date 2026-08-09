import {
  Building2,
  Gamepad2,
  LibraryBig,
  Shapes,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { cn } from "@/lib/utils/cn";
import type { SearchHit, SearchKind } from "@/lib/games/search";
import { ResilientMediaImage } from "@/components/game/ResilientMediaImage";

const ICONS: Record<SearchKind, typeof Gamepad2> = {
  game: Gamepad2,
  series: LibraryBig,
  franchise: Sparkles,
  company: Building2,
  character: User,
  genre: Tag,
  platform: Shapes,
};

const TONES: Record<SearchKind, string> = {
  game: "from-brand/35 to-brand/5 text-brand-soft",
  series: "from-neon/25 to-neon/5 text-neon",
  franchise: "from-flare/25 to-flare/5 text-flare",
  company: "from-gold/25 to-gold/5 text-gold",
  character: "from-mint/25 to-mint/5 text-mint",
  genre: "from-brand/30 to-neon/5 text-brand-soft",
  platform: "from-neon/25 to-brand/5 text-neon",
};

export function SearchHitVisual({
  hit,
  size = "compact",
}: {
  hit: SearchHit;
  size?: "compact" | "card";
}) {
  const Icon = ICONS[hit.kind];
  const dimensions = size === "card" ? "h-24 w-20 rounded-2xl" : "h-14 w-11 rounded-xl";

  if (hit.kind === "game") {
    return (
      <span className={cn("relative shrink-0 overflow-hidden border border-white/10", dimensions)}>
        <GameCover
          name={hit.name}
          slug={hit.slug}
          image={hit.image}
          imageFallback={null}
          width={size === "card" ? 200 : 96}
          sizes={size === "card" ? "80px" : "44px"}
        />
      </span>
    );
  }

  if (hit.image) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden border border-white/10 bg-white/[0.05]", dimensions, hit.kind === "company" || hit.kind === "platform" ? "p-2" : "")}>
        <ResilientMediaImage
          src={hit.image}
          alt=""
          sizes={size === "card" ? "80px" : "44px"}
          className={hit.kind === "company" || hit.kind === "platform" ? "object-contain p-2" : "object-cover"}
        />
      </span>
    );
  }

  return (
    <span className={cn("grid shrink-0 place-items-center border border-white/10 bg-gradient-to-br", dimensions, TONES[hit.kind])}>
      <Icon size={size === "card" ? 25 : 17} />
    </span>
  );
}

export function SearchKindIcon({ kind, size = 15 }: { kind: SearchKind; size?: number }) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden size={size} />;
}
