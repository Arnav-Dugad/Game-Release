import Link from "next/link";
import { ArrowUpRight, Layers3, PackageOpen, Sparkles } from "lucide-react";
import { GameCover } from "./GameCover";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Badge } from "@/components/ui/Badge";
import { releaseLabel } from "@/lib/utils/format";
import type { GameDetail, GameSummary } from "@/lib/games/types";

export function GameCollectionShowcase({ game }: { game: GameDetail }) {
  const groups = [
    {
      eyebrow: "Add-ons",
      title: "Downloadable content",
      description: "Optional content made to extend the base game.",
      label: "DLC",
      games: dedupeGames(game.dlcs),
    },
    {
      eyebrow: "Add-ons",
      title: "Expansions",
      description: "Substantial new content that still requires the base game.",
      label: "Expansion",
      games: dedupeGames(game.expansions),
    },
    {
      eyebrow: "Standalone",
      title: "Standalone expansions",
      description: "Expansion-sized experiences you can play without owning the base game.",
      label: "Standalone",
      games: dedupeGames(game.standaloneExpansions),
    },
    {
      eyebrow: "Versions",
      title: "Editions",
      description: "Alternate releases of the same game, kept separate from downloadable content.",
      label: "Edition",
      games: dedupeGames(game.editions),
    },
    {
      eyebrow: "Collections",
      title: "Bundles",
      description: "Store packages that include this title alongside other content.",
      label: "Bundle",
      games: dedupeGames(game.bundles),
    },
    {
      eyebrow: "Reimagined",
      title: "Remakes",
      description: "New productions that rebuild the original experience.",
      label: "Remake",
      games: dedupeGames(game.remakes),
    },
    {
      eyebrow: "Reissued",
      title: "Remasters",
      description: "Modernised releases built from the original game.",
      label: "Remaster",
      games: dedupeGames(game.remasters),
    },
    {
      eyebrow: "Platforms",
      title: "Ports",
      description: "Versions adapted for another platform or hardware generation.",
      label: "Port",
      games: dedupeGames(game.ports),
    },
  ].filter((group) => group.games.length > 0);

  if (game.series.length === 0 && groups.length === 0 && !game.parentGame) return null;

  return (
    <section id="collection" className="space-y-8">
      {game.series.length > 0 && (
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-3xl border border-brand/25 bg-[linear-gradient(135deg,rgba(124,92,255,0.18),rgba(16,16,32,0.88)_48%,rgba(34,211,238,0.08))] p-6 sm:p-8">
            <div aria-hidden className="absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 left-1/3 -z-10 h-44 w-44 rounded-full bg-neon/10 blur-3xl" />

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-brand/25 bg-brand/15 text-brand-soft">
                  <Layers3 size={21} />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-soft">
                  Continue the journey
                </p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Explore the {game.series[0].name} series
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">
                  Open the dedicated series page to browse every connected game, search the full catalogue, and follow the release history.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {game.series.map((series, index) => (
                  <Link
                    key={series.id}
                    href={`/series/${series.slug}`}
                    className={
                      index === 0
                        ? "group inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#090910] transition-transform hover:-translate-y-0.5"
                        : "group inline-flex min-h-12 items-center gap-2 rounded-full border border-line-strong bg-white/[0.05] px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-white/[0.09]"
                    }
                  >
                    {index === 0 ? "View complete series" : series.name}
                    <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {game.parentGame && (
        <div>
          <Reveal className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-soft">
                <Sparkles size={13} />
                Relationship
              </p>
              <h2 className="text-2xl font-bold sm:text-3xl">Part of a larger game</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                This release depends on or extends the base title below.
              </p>
            </div>
          </Reveal>

          <Stagger className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" gap={0.04} onMount>
            <StaggerItem>
              <ReferencePoster name={game.parentGame.name} slug={game.parentGame.slug} label="Base game" />
            </StaggerItem>
          </Stagger>
        </div>
      )}

      {groups.map((group) => (
        <RelatedGroup key={`${group.eyebrow}-${group.title}`} {...group} />
      ))}
    </section>
  );
}

function RelatedGroup({
  eyebrow,
  title,
  description,
  label,
  games,
}: {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  games: GameSummary[];
}) {
  return (
    <div>
      <Reveal className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-soft">
            <Sparkles size={13} />
            {eyebrow}
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <span className="hidden rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-faint sm:inline-flex">
          {games.length} {games.length === 1 ? "release" : "releases"}
        </span>
      </Reveal>
      <Stagger className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" gap={0.04} onMount>
        {games.map((entry) => (
          <StaggerItem key={entry.id}>
            <RelatedPoster game={entry} label={label} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function RelatedPoster({ game, label }: { game: GameSummary; label: string }) {
  return (
    <article className="group h-full">
      <Link
        href={`/game/${game.slug}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_60px_-32px_rgba(0,0,0,0.95)] transition-all duration-500 fine:hover:-translate-y-1 fine:hover:border-brand/50 fine:hover:shadow-[0_28px_70px_-28px_rgba(124,92,255,0.65)]"
      >
        <GameCover
          name={game.name}
          slug={game.slug}
          image={game.image}
          imageFallback={game.imageFallback}
          width={560}
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 220px"
          className="transition-transform duration-700 fine:group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/25" />
        <Badge tone="brand" className="absolute left-2.5 top-2.5 backdrop-blur-md">{label}</Badge>
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="line-clamp-2 font-display text-sm font-bold leading-snug text-white">{game.name}</p>
          <p className="mt-1 text-[11px] text-white/60">{releaseLabel(game)}</p>
        </div>
      </Link>
    </article>
  );
}

function ReferencePoster({ name, slug, label }: { name: string; slug: string; label: string }) {
  return (
    <article className="group h-full">
      <Link
        href={`/game/${slug}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-panel transition-all duration-500 fine:hover:-translate-y-1 fine:hover:border-brand/50"
      >
        <GameCover name={name} slug={slug} image={null} width={560} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <Badge tone="neutral" className="absolute left-2.5 top-2.5 backdrop-blur-md">{label}</Badge>
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <PackageOpen size={16} className="mb-2 text-brand-soft" />
          <p className="line-clamp-2 font-display text-sm font-bold leading-snug text-white">{name}</p>
        </div>
      </Link>
    </article>
  );
}

function dedupeGames(games: GameSummary[]): GameSummary[] {
  const seen = new Set<number>();
  return games.filter((game) => {
    if (seen.has(game.id)) return false;
    seen.add(game.id);
    return true;
  });
}
