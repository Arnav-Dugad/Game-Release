import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Gauge,
  Globe,
  ShieldCheck,
  Star,
  Timer,
  Users,
} from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { Countdown } from "@/components/game/Countdown";
import { GameRail } from "@/components/game/GameRail";
import { PlatformList } from "@/components/game/PlatformIcons";
import { ScreenshotGallery } from "@/components/game/ScreenshotGallery";
import { ReviewSection } from "@/components/game/ReviewSection";
import { TrailerPlayer } from "@/components/game/TrailerPlayer";
import { WatchButton } from "@/components/game/WatchButton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Badge, Chip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/SectionHeading";
import { DataSourceNotice, SourceAttribution } from "@/components/ui/DataSourceNotice";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/text";
import { Parallax } from "@/components/motion/effects";
import { getGame, getRelated, sampleSlugs } from "@/lib/games/source";
import { sizedImage } from "@/lib/games/image";
import {
  compactNumber,
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

/** Pre-renders the bundled catalogue at build time; live titles stream in. */
export function generateStaticParams() {
  return sampleSlugs().map((slug) => ({ slug }));
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
  const result = await getGame(slug);
  if (!result) notFound();

  const { data: game, source } = result;
  // Pass the source so the rail comes from the same catalogue as the page.
  const related = await getRelated(game, source, 12);

  return (
    <>
      <GameHero game={game} />

      <Container className="relative z-10 -mt-2 space-y-3 pb-6">
        <DataSourceNotice source={source} />
        <SourceAttribution source={source} />
      </Container>

      <Container className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14 lg:py-12">
        <div className="min-w-0 space-y-14">
          {game.description && (
            <Reveal>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl">About this game</h2>
              <div className="max-w-2xl space-y-4 text-[15px] leading-[1.75] text-muted">
                {game.description
                  .split(/\n{2,}/)
                  .slice(0, 8)
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            </Reveal>
          )}

          {game.screenshots.length > 0 && (
            <section>
              <Reveal>
                <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Screenshots</h2>
              </Reveal>
              <ScreenshotGallery screenshots={game.screenshots} gameName={game.name} />
            </section>
          )}

          {game.trailers.length > 0 && (
            <section>
              <Reveal>
                <h2 className="mb-5 text-2xl font-bold sm:text-3xl">Trailers</h2>
              </Reveal>
              <div className="grid gap-4 sm:grid-cols-2">
                {game.trailers.slice(0, 4).map((trailer) => (
                  <Reveal key={trailer.id} blur={false}>
                    <figure className="overflow-hidden rounded-2xl border border-line bg-panel">
                      <TrailerPlayer trailer={trailer} />
                      <figcaption className="px-4 py-3 text-sm text-muted">
                        {trailer.name}
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {game.requirements.length > 0 && <Requirements game={game} />}

          {game.tags.length > 0 && (
            <Reveal>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag) => (
                  <Badge key={tag.id}>{tag.name}</Badge>
                ))}
              </div>
            </Reveal>
          )}

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
  const backdrop = game.screenshots[0] ?? game.image;

  return (
    <header className="noise relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Parallax distance={40} scale className="h-full w-full">
          <GameCover
            name={game.name}
            slug={game.slug}
            image={backdrop}
            width={1920}
            priority
            sizes="100vw"
            rounded="rounded-none"
          />
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/90 to-transparent" />
      </div>

      <Container className="pb-10 pt-28 lg:pb-14 lg:pt-40">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
          {/* Poster — hidden on the narrowest screens where it would crowd the title. */}
          <Reveal
            direction="right"
            className="relative hidden aspect-[3/4] w-40 shrink-0 overflow-hidden rounded-2xl border border-line-strong shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] sm:block lg:w-52"
          >
            <GameCover
              name={game.name}
              slug={game.slug}
              image={game.image}
              width={480}
              sizes="(max-width: 1024px) 160px, 208px"
              priority
            />
          </Reveal>

          <div className="min-w-0 flex-1">
            <Reveal className="mb-4 flex flex-wrap items-center gap-2">
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
              className="font-display text-[clamp(2rem,6.5vw,4rem)] font-black leading-[1.02] tracking-[-0.04em]"
            />

            <Reveal delay={0.12} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="flex items-center gap-2 text-sm text-muted">
                <CalendarDays size={15} className="text-faint" />
                {releaseLabelLong(game)}
              </span>
              {/* Only an exact date yields a meaningful "in N months". */}
              {game.released && <Badge tone="brand">{relativeRelease(game.released)}</Badge>}
            </Reveal>

            {game.released && (
              <Reveal delay={0.18}>
                <Countdown date={game.released} className="mt-6" />
              </Reveal>
            )}

            <Reveal delay={0.24} className="mt-7 flex flex-wrap items-center gap-3">
              <WatchButton game={game} variant="full" />
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
          </div>
        </div>
      </Container>
    </header>
  );
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
    ...(game.esrb
      ? [{ label: "Age rating", value: game.esrb, icon: <ShieldCheck size={14} /> }]
      : []),
    ...(game.added
      ? [
          {
            label: "In player libraries",
            value: compactNumber(game.added),
            icon: <Gauge size={14} />,
          },
        ]
      : []),
  ];

  return (
    <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
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
              <p className={cn("flex items-center gap-1.5 text-sm text-muted", game.metacritic !== null && "mt-3")}>
                <Star size={13} className="fill-gold text-gold" />
                <span className="font-semibold text-text tabular-nums">
                  {game.rating.toFixed(1)}
                </span>
                / 5 from {compactNumber(game.ratingsCount)} players
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
          <ul className="space-y-2">
            {game.stores.map((store) => (
              <li key={store.id}>
                <a
                  href={store.url ?? `https://${store.domain ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 text-sm transition-colors hover:border-line-strong hover:bg-white/[0.04]"
                >
                  <span className="truncate">{store.name}</span>
                  <ExternalLink size={13} className="shrink-0 text-faint" />
                </a>
              </li>
            ))}
          </ul>
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
  return (
    <Reveal>
      <h2 className="mb-5 text-2xl font-bold sm:text-3xl">System requirements</h2>
      <div className="space-y-4">
        {game.requirements.map((req) => (
          <div key={req.platform} className="overflow-hidden rounded-2xl border border-line">
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
    </Reveal>
  );
}
