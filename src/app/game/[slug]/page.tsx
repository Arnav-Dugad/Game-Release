import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Cpu,
  Eye,
  ExternalLink,
  Flame,
  Gamepad2,
  Gauge,
  Globe,
  Languages,
  Layers,
  MonitorCog,
  ShieldCheck,
  Star,
  Tag,
  Timer,
  Users,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { Countdown } from "@/components/game/Countdown";
import { GameRail } from "@/components/game/GameRail";
import { PlatformIcons, PlatformList } from "@/components/game/PlatformIcons";
import { BackdropTrailer } from "@/components/game/BackdropTrailer";
import {
  AgeRatingPanel,
  CharacterRail,
  CompanyGrid,
  EngineRow,
  PlatformGrid,
  ReleaseTable,
  StudioCredit,
} from "@/components/game/GameEntities";
import { MediaGallery } from "@/components/game/MediaGallery";
import { CommunityLinks, StoreLinks } from "@/components/game/StoreLinks";
import { ReviewSection } from "@/components/game/ReviewSection";
import { OwnershipPicker } from "@/components/game/OwnershipPicker";
import { StatusPicker } from "@/components/game/StatusPicker";
import { ScorePill, ScoreRing } from "@/components/ui/ScoreRing";
import { Badge, Chip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/SectionHeading";
import { DataSourceNotice, SourceAttribution } from "@/components/ui/DataSourceNotice";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { Collapsible } from "@/components/ui/Collapsible";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/text";
import { Parallax } from "@/components/motion/effects";
import { getGame, getRelated, popularSlugs, isDegraded } from "@/lib/games/source";
import { sizedImage } from "@/lib/games/image";
import { PriceCard } from "@/components/game/PriceCard";
import {
  compactNumber,
  isUnreleased,
  playtimeLabel,
  releaseLabelLong,
  relativeRelease,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { GameDetail } from "@/lib/games/types";

export const revalidate = 86400;
/** Unknown slugs are rendered on demand and cached, rather than 404'd. */
export const dynamicParams = true;

type Params = Promise<{ slug: string }>;

/**
 * Pre-renders whatever's currently trending, top rated and upcoming at build
 * time; everything else is rendered on first request and cached by ISR.
 */
export async function generateStaticParams() {
  return (await popularSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getGame(slug);
  if (!result) return { title: "Game not found" };

  const game = result.data;
  const released = releaseLabelLong(game, "Release date to be announced");
  const description =
    game.description?.slice(0, 155).trim() ||
    `${game.name} — ${released}. Platforms, critic scores, screenshots and release countdown.`;
  const image = sizedImage(game.image, 1200);

  return {
    title: game.name,
    description,
    openGraph: {
      title: game.name,
      description,
      type: "article",
      images: image ? [{ url: image, width: 1200, height: 630, alt: game.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: game.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function GamePage({ params }: { params: Params }) {
  const { slug } = await params;
  // No region here on purpose: everything this page renders is identical for
  // every reader, which is what lets it stay prerendered. The one personalised
  // part, the Steam price, is fetched client-side by `PriceCard`.
  const result = await getGame(slug);
  if (!result) notFound();

  const { data: game, source } = result;
  // Pass the source so the rail comes from the same catalogue as the page.
  const related = await getRelated(game, source, 12);

  // Screenshots first (they show the game running), then key art. Deduped
  // because some providers list the same asset in both collections.
  const media = [...new Set([...game.screenshots, ...game.artworks])];

  return (
    <>
      <GameHero game={game} />

      <Container className="relative z-10 space-y-3 pb-2 pt-4">
        <DataSourceNotice source={source} degraded={isDegraded(source)} />
        <SourceAttribution source={source} />
      </Container>

      <Container className="grid gap-10 pb-8 pt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14 lg:pb-12 lg:pt-10">
        <div className="min-w-0 space-y-14">
          {game.description && (
            <Reveal>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl">About this game</h2>
              <ExpandableText
                text={game.description}
                className="max-w-2xl"
                paragraphClassName="text-[15px] leading-[1.75] text-muted"
              />
            </Reveal>
          )}

          {game.trailers.length > 0 && (
            <section>
              <Reveal>
                <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Trailers</h2>
              </Reveal>
              <MediaGallery
                items={game.trailers.map((trailer) => ({ kind: "trailer" as const, trailer }))}
                gameName={game.name}
              />
            </section>
          )}

          {media.length > 0 && (
            <section>
              <Reveal>
                <h2 className="mb-5 text-2xl font-bold sm:text-3xl">
                  {game.artworks.length > 0 ? "Screenshots & art" : "Screenshots"}
                </h2>
              </Reveal>
              <MediaGallery
                items={media.map((src) => ({ kind: "image" as const, src }))}
                gameName={game.name}
              />
            </section>
          )}

          {game.characters.length > 0 && (
            <section>
              <Reveal>
                <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Characters</h2>
              </Reveal>
              <CharacterRail characters={game.characters} />
            </section>
          )}

          {game.companies.length > 0 && (
            <Reveal>
              <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Who made it</h2>
              <CompanyGrid companies={game.companies} />
              {game.engines.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Built with
                  </h3>
                  <EngineRow engines={game.engines} />
                </div>
              )}
            </Reveal>
          )}

          {game.platformDetails.length > 0 && (
            <Reveal>
              <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Platforms</h2>
              <PlatformGrid platforms={game.platformDetails} />
            </Reveal>
          )}

          {game.releases.length > 1 && (
            <Reveal>
              <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Release history</h2>
              <ReleaseTable releases={game.releases} />
            </Reveal>
          )}

          {(game.expansions.length > 0 || game.editions.length > 0 || game.parentGame) && (
            <Reveal>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl">In this series</h2>
              <ul className="flex flex-wrap gap-2">
                {game.parentGame && (
                  <li>
                    <Chip href={`/game/${game.parentGame.slug}`}>
                      Base game: {game.parentGame.name}
                    </Chip>
                  </li>
                )}
                {[...game.expansions, ...game.editions].map((item) => (
                  <li key={`${item.id}-${item.slug}`}>
                    <Chip href={`/game/${item.slug}`}>{item.name}</Chip>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {(game.tags.length > 0 || game.keywords.length > 0) && (
            <Reveal>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Themes & modes</h2>
              <div className="flex flex-wrap gap-2">
                {game.themes.map((theme) => (
                  <Badge key={`theme-${theme.id}`} tone="brand">
                    {theme.name}
                  </Badge>
                ))}
                {game.gameModes.map((mode) => (
                  <Badge key={`mode-${mode.id}`}>{mode.name}</Badge>
                ))}
                {game.themes.length === 0 &&
                  game.gameModes.length === 0 &&
                  game.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}
              </div>

              {game.keywords.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Tags
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {game.keywords.map((keyword) => (
                      <li key={keyword.id}>
                        <Chip href={`/browse?search=${encodeURIComponent(keyword.name)}`}>
                          {keyword.name}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Reveal>
          )}

          {/* Bulky, and relevant to a minority of readers — so it sits at the
              end of the article, closed, rather than between the media and the
              conversation about the game. */}
          {game.requirements.length > 0 && <Requirements game={game} />}

          <section id="reviews">
            <ReviewSection game={game} />
          </section>
        </div>

        <GameSidebar game={game} />
      </Container>

      {related.length > 0 && (
        <Section className="border-t border-line pt-12">
          <Container>
            <SectionHeading
              eyebrow="More like this"
              title="Related games"
              href={`/browse?genres=${game.genres.map((g) => g.slug).join(",")}`}
              linkLabel="Browse genre"
            />
          </Container>
          <div className="mt-7">
            <GameRail games={related} />
          </div>
        </Section>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function GameHero({ game }: { game: GameDetail }) {
  const backdrop = game.artworks[0] ?? game.screenshots[0] ?? game.image;

  return (
    <header className="noise relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Parallax distance={40} scale className="h-full w-full">
          <GameCover
            name={game.name}
            slug={game.slug}
            image={backdrop}
            imageFallback={game.imageFallback}
            width={1920}
            priority
            sizes="100vw"
            rounded="rounded-none"
          />
        </Parallax>

        {/* The trailer dissolves in over the key art, muted and chrome-free.
            Sits under the scrims so the title never loses contrast. */}
        <BackdropTrailer trailer={game.trailers[0] ?? game.heroTrailer} />

        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/90 to-transparent" />
      </div>

      <Container className="pb-8 pt-24 lg:pb-12 lg:pt-32">
        {/*
          Stacks on a phone and goes side-by-side from `sm` up.
          The poster and platform marks together answer "what is this, and can
          I play it?" before any text is read, so they lead on both layouts.
        */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
          <div className="flex items-end gap-4 sm:gap-8">
            <Reveal
              direction="right"
              className={cn(
                "relative aspect-[3/4] shrink-0 overflow-hidden rounded-2xl border border-line-strong",
                "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]",
                // Shown at every size — the poster is the strongest identifying
                // element on the page, and hiding it on phones wasted that.
                "w-28 sm:w-44 lg:w-60",
              )}
            >
              <GameCover
                name={game.name}
                slug={game.slug}
                image={game.image}
                imageFallback={game.imageFallback}
                width={720}
                sizes="(max-width: 640px) 112px, (max-width: 1024px) 176px, 240px"
                priority
              />
            </Reveal>

            {/* Platform marks sit directly beside the poster, on every size —
                a column on desktop, a compact stack on a phone. */}
            {game.parentPlatforms.length > 0 && (
              <Reveal delay={0.08} className="shrink-0 self-end pb-1">
                <ul className="flex flex-col gap-2 sm:gap-2.5">
                  {game.parentPlatforms.slice(0, 5).map((platform) => (
                    <li
                      key={platform.id}
                      title={platform.name}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/[0.04] transition-colors hover:border-line-strong sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                    >
                      <PlatformIcons platforms={[platform]} size={17} max={1} tinted />
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <Reveal className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
              {game.genres.slice(0, 3).map((genre) => (
                <Chip key={genre.id} href={`/browse?genres=${genre.slug}`}>
                  {genre.name}
                </Chip>
              ))}
              {game.esrb && <Badge tone="neutral">{game.esrb}</Badge>}
            </Reveal>

            <TextReveal
              as="h1"
              text={game.name}
              className="font-display text-[clamp(1.75rem,6.5vw,4rem)] font-black leading-[1.02] tracking-[-0.04em]"
            />

            <Reveal delay={0.1} className="mt-3">
              <StudioCredit developers={game.developers} publishers={game.publishers} />
            </Reveal>

            {/* Score, release and popularity in one scannable row — the three
                things that decide whether someone reads any further. */}
            <Reveal delay={0.14} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {game.metacritic !== null && (
                <span className="flex items-center gap-2">
                  <ScorePill score={game.metacritic} />
                  <span className="text-xs text-faint">Critics</span>
                </span>
              )}
              {game.rating > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Star size={14} className="fill-gold text-gold" />
                  <span className="font-semibold text-text tabular-nums">
                    {game.rating.toFixed(1)}
                  </span>
                  <span className="text-faint">/5</span>
                </span>
              )}
              <span className="flex items-center gap-2 text-sm text-muted">
                <CalendarDays size={15} className="text-faint" />
                {releaseLabelLong(game)}
              </span>
              {/* Only an exact date yields a meaningful "in N months". */}
              {game.released && <Badge tone="brand">{relativeRelease(game.released)}</Badge>}
            </Reveal>

            {/* Only worth showing while a dated release is still ahead. */}
            {game.released && isUnreleased(game) && (
              <Reveal delay={0.18}>
                <Countdown date={game.released} className="mt-5" />
              </Reveal>
            )}
          </div>
        </div>

        {/* Actions span the full width rather than sharing the narrow title
            column, which on a phone left no room for two buttons side by side. */}
        <Reveal delay={0.24} className="mt-7 flex flex-wrap items-center gap-3">
          {/* Where you are with this game, and where you own it — the two
              things worth recording, side by side. The segmented control also
              starts tracking the game, so no separate watchlist button is
              needed here. */}
          <StatusPicker game={game} />
          <OwnershipPicker game={game} />
          {game.website && (
            <Button
              href={game.website}
              external
              variant="secondary"
              icon={<Globe size={16} />}
              iconRight={<ExternalLink size={13} />}
            >
              Official site
            </Button>
          )}
          <Button href="#reviews" variant="ghost" icon={<Star size={16} />}>
            Rate this game
          </Button>
        </Reveal>
      </Container>
    </header>
  );
}

/** Turns IGDB's multiplayer booleans into a phrase worth reading. */
function multiplayerSummary(modes: NonNullable<GameDetail["multiplayerModes"]>): string {
  const parts: string[] = [];
  if (modes.onlineCoop) parts.push("Online co-op");
  if (modes.offlineCoop) parts.push("Local co-op");
  if (modes.lanCoop) parts.push("LAN");
  if (modes.splitScreen) parts.push("Split screen");
  if (modes.campaignCoop) parts.push("Co-op campaign");
  if (modes.dropIn) parts.push("Drop-in");
  if (modes.onlineMax && modes.onlineMax > 1) parts.push(`Up to ${modes.onlineMax} online`);
  return parts.length > 0 ? parts.join(" · ") : "Single player";
}

function GameSidebar({ game }: { game: GameDetail }) {
  const facts: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [
    {
      label: "Released",
      value: releaseLabelLong(game, "To be announced"),
      icon: <CalendarDays size={14} />,
    },
    ...(game.developers.length
      ? [
          {
            label: game.developers.length > 1 ? "Developers" : "Developer",
            value: game.developers.map((d) => d.name).join(", "),
            icon: <Building2 size={14} />,
          },
        ]
      : []),
    ...(game.publishers.length
      ? [
          {
            label: game.publishers.length > 1 ? "Publishers" : "Publisher",
            value: game.publishers.map((p) => p.name).join(", "),
            icon: <Users size={14} />,
          },
        ]
      : []),
    ...(game.playtime
      ? [
          {
            label: "Typical playtime",
            value: playtimeLabel(game.playtime),
            icon: <Timer size={14} />,
          },
        ]
      : []),
    ...(game.supportingStudios.length
      ? [
          {
            label: "Additional work",
            value: game.supportingStudios.map((s) => s.name).join(", "),
            icon: <Building2 size={14} />,
          },
        ]
      : []),
    ...(game.franchises.length
      ? [
          {
            label: game.franchises.length > 1 ? "Series" : "Part of",
            // Linked, because "what else is in this series?" is the most
            // common next question a series line provokes.
            value: (
              <span className="flex flex-wrap gap-x-1.5">
                {game.franchises.map((franchise, i) => (
                  <span key={franchise.id}>
                    <Link
                      href={`/franchise/${franchise.slug}`}
                      className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-brand-soft"
                    >
                      {franchise.name}
                    </Link>
                    {i < game.franchises.length - 1 && ","}
                  </span>
                ))}
              </span>
            ),
            icon: <Layers size={14} />,
          },
        ]
      : []),
    ...(game.engines.length
      ? [
          {
            label: game.engines.length > 1 ? "Engines" : "Engine",
            value: game.engines.map((e) => e.name).join(", "),
            icon: <Cpu size={14} />,
          },
        ]
      : []),
    ...(game.playerPerspectives.length
      ? [
          {
            label: "Perspective",
            value: game.playerPerspectives.map((p) => p.name).join(", "),
            icon: <Eye size={14} />,
          },
        ]
      : []),
    ...(game.gameModes.length
      ? [
          {
            label: "Modes",
            value: game.gameModes.map((m) => m.name).join(", "),
            icon: <Gamepad2 size={14} />,
          },
        ]
      : []),
    ...(game.multiplayerModes
      ? [
          {
            label: "Multiplayer",
            value: multiplayerSummary(game.multiplayerModes),
            icon: <Users size={14} />,
          },
        ]
      : []),
    ...(game.playtime
      ? [
          {
            label: "Typical playtime",
            value: playtimeLabel(game.playtime),
            icon: <Timer size={14} />,
          },
        ]
      : []),
    // Ratings get their own panel below when IGDB has content descriptors,
    // since the descriptors are the half people actually want. This row is the
    // fallback for records that only carry the bare rating.
    ...(game.ageRatings.length === 0 && game.esrb
      ? [{ label: "Age rating", value: game.esrb, icon: <ShieldCheck size={14} /> }]
      : []),
    ...(game.languages.length
      ? [
          {
            label: "Languages",
            value: `${game.languages.slice(0, 6).join(", ")}${
              game.languages.length > 6 ? ` +${game.languages.length - 6} more` : ""
            }`,
            icon: <Languages size={14} />,
          },
        ]
      : []),
    ...(game.alternativeNames.length
      ? [
          {
            label: "Also known as",
            value: game.alternativeNames.slice(0, 4).join(", "),
            icon: <Tag size={14} />,
          },
        ]
      : []),
    // `popScore` is deliberately not shown: IGDB returns it as a normalised
    // float far below 1, which is meaningful for ordering shelves and search
    // but answers no question a reader would ask. It ranks, it doesn't display.
    ...(game.added
      ? [
          {
            label: "In player libraries",
            value: compactNumber(game.added),
            icon: <Gauge size={14} />,
          },
        ]
      : []),
    ...(game.hypes > 0
      ? [
          {
            label: "Anticipating this",
            value: compactNumber(game.hypes),
            icon: <Flame size={14} />,
          },
        ]
      : []),
  ];

  return (
    <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
      <PriceCard steamAppId={game.steamAppId} />
      {(game.metacritic !== null || game.rating > 0) && (
        <Reveal className="glass flex items-center gap-5 rounded-2xl p-5">
          {game.metacritic !== null && <ScoreRing score={game.metacritic} />}
          <div className="min-w-0">
            {game.metacritic !== null && (
              <>
                <p className="text-sm font-semibold">Metascore</p>
                <p className="text-xs text-muted">Critic aggregate</p>
              </>
            )}
            {game.rating > 0 && (
              <p
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap text-sm text-muted",
                  game.metacritic !== null && "mt-3",
                )}
              >
                <Star size={13} className="shrink-0 fill-gold text-gold" />
                <span className="font-semibold text-text tabular-nums">
                  {game.rating.toFixed(1)}/5
                </span>
                {game.ratingsCount > 0 && (
                  <span className="text-faint">· {compactNumber(game.ratingsCount)} ratings</span>
                )}
              </p>
            )}
          </div>
        </Reveal>
      )}

      <Reveal delay={0.06} className="glass rounded-2xl p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Details
        </h2>
        <dl className="space-y-3.5">
          {facts.map((fact) => (
            <div key={fact.label} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-faint">{fact.icon}</span>
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-faint">{fact.label}</dt>
                <dd className="mt-0.5 text-sm leading-snug">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Reveal>

      {game.ageRatings.length > 0 && (
        <Reveal delay={0.09} className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            {game.ageRatings.length > 1 ? "Age ratings" : "Age rating"}
          </h2>
          <AgeRatingPanel ratings={game.ageRatings} />
        </Reveal>
      )}

      {game.parentPlatforms.length > 0 && (
        <Reveal delay={0.12} className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Platforms
          </h2>
          <PlatformList platforms={game.parentPlatforms} />
        </Reveal>
      )}

      {game.stores.length > 0 && (
        <Reveal delay={0.18} className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Where to buy
          </h2>
          <StoreLinks stores={game.stores} />
        </Reveal>
      )}

      {game.websites.some((site) => site.kind !== "official") && (
        <Reveal delay={0.21} className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Links
          </h2>
          <CommunityLinks websites={game.websites} />
        </Reveal>
      )}

      {game.genres.length > 0 && (
        <Reveal delay={0.24} className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Genres
          </h2>
          <div className="flex flex-wrap gap-2">
            {game.genres.map((genre) => (
              <Chip key={genre.id} href={`/browse?genres=${genre.slug}`}>
                {genre.name}
              </Chip>
            ))}
          </div>
        </Reveal>
      )}
    </aside>
  );
}

function Requirements({ game }: { game: GameDetail }) {
  const platforms = game.requirements.map((req) => req.platform).join(", ");

  return (
    <Reveal>
      <Collapsible
        title="System requirements"
        subtitle={platforms}
        icon={<MonitorCog size={17} />}
      >
        <div className="space-y-4">
          {game.requirements.map((req) => (
            <div key={req.platform} className="overflow-hidden rounded-xl border border-line">
              <h3 className="border-b border-line bg-white/[0.03] px-4 py-3 text-sm font-semibold">
                {req.platform}
              </h3>
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {req.minimum && (
                  <div className="bg-bg p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                      Minimum
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                      {req.minimum}
                    </p>
                  </div>
                )}
                {req.recommended && (
                  <div className="bg-bg p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                      Recommended
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                      {req.recommended}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Collapsible>
    </Reveal>
  );
}
