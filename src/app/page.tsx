import Link from "next/link";
import { ArrowRight, CalendarClock, Flame, Sparkles, Trophy } from "lucide-react";
import { HeroShowcase } from "@/components/game/HeroShowcase";
import { GameRail } from "@/components/game/GameRail";
import { GameGrid } from "@/components/game/GameGrid";
import { Container, Section, SectionHeading } from "@/components/ui/SectionHeading";
import { DataSourceNotice } from "@/components/ui/DataSourceNotice";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/text";
import { Marquee, Spotlight } from "@/components/motion/effects";
import { Aurora, GridLines } from "@/components/motion/Aurora";
import {
  getGenres,
  getNewReleases,
  getTopRated,
  getTrending,
  getUpcoming,
} from "@/lib/games/source";
import { hueFromString } from "@/lib/utils/format";

/** Revalidate hourly — release data changes on the order of days, not minutes. */
export const revalidate = 3600;

export default async function HomePage() {
  // One await point: these four queries are independent and must not waterfall.
  const [upcoming, trending, topRated, newReleases, genres] = await Promise.all([
    getUpcoming(18),
    getTrending(14),
    getTopRated(10),
    getNewReleases(14),
    getGenres(),
  ]);

  const source = upcoming.source;
  const featured = upcoming.data.results;

  return (
    <>
      <HeroShowcase games={featured} />

      {source === "sample" && (
        <Container className="pt-8">
          <DataSourceNotice source={source} />
        </Container>
      )}

      <StatsStrip
        upcomingCount={upcoming.data.count}
        trendingCount={trending.data.length}
        genreCount={genres.data.length}
      />

      <Section className="pt-4">
        <Container>
          <SectionHeading
            eyebrow="Release calendar"
            title="Landing soon"
            description="Everything on the horizon, ordered by release date."
            href="/upcoming"
          />
        </Container>
        <div className="mt-7">
          <GameRail games={featured} priorityCount={3} />
        </div>
      </Section>

      <Section className="py-8 sm:py-11">
        <Container>
          <SectionHeading
            eyebrow="Momentum"
            title="Trending right now"
            description="The titles players are adding to their libraries fastest."
            href="/browse?ordering=-added"
          />
        </Container>
        <div className="mt-7">
          <GameRail games={trending.data} />
        </div>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Critic scores"
            title="Critically acclaimed"
            description="The highest-scoring games in the database."
            href="/browse?ordering=-metacritic"
          />
          <div className="mt-8">
            <GameGrid games={topRated.data} priorityCount={0} />
          </div>
        </Container>
      </Section>

      <GenreShowcase genres={genres.data} />

      <Section className="py-8 sm:py-11">
        <Container>
          <SectionHeading
            eyebrow="Just shipped"
            title="New releases"
            description="Out in the last two months."
            href="/browse?ordering=-released"
          />
        </Container>
        <div className="mt-7">
          <GameRail games={newReleases.data} />
        </div>
      </Section>

      <JoinCta />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function StatsStrip({
  upcomingCount,
  trendingCount,
  genreCount,
}: {
  upcomingCount: number;
  trendingCount: number;
  genreCount: number;
}) {
  const stats = [
    { value: upcomingCount, label: "Upcoming releases tracked", icon: CalendarClock, compact: true },
    { value: trendingCount, label: "Trending this year", icon: Flame, compact: false },
    { value: genreCount, label: "Genres to explore", icon: Sparkles, compact: false },
    { value: 100, label: "Critic scores, 0–100", icon: Trophy, compact: false },
  ];

  return (
    <Section className="py-8 sm:py-10">
      <Container>
        <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <StaggerItem key={stat.label}>
                <Spotlight className="glass h-full rounded-2xl p-4 lg:p-5">
                  <Icon size={17} className="text-brand-soft" />
                  <p className="mt-3 font-display text-2xl font-bold leading-none lg:text-3xl">
                    <CountUp value={stat.value} compact={stat.compact} />
                    {!stat.compact && stat.value >= 100 ? "" : "+"}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-muted lg:text-[13px]">
                    {stat.label}
                  </p>
                </Spotlight>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </Section>
  );
}

function GenreShowcase({ genres }: { genres: { id: number; slug: string; name: string }[] }) {
  const featured = genres.slice(0, 10);
  if (featured.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Find your lane"
          title="Browse by genre"
          description="Jump straight into the kind of game you're after."
          href="/genres"
        />
      </Container>

      <Container className="mt-8">
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {featured.map((genre) => {
            const hue = hueFromString(genre.slug);
            return (
              <StaggerItem key={genre.id}>
                <Link
                  href={`/browse?genres=${genre.slug}`}
                  className="group relative flex h-28 items-end overflow-hidden rounded-2xl border border-line p-4 transition-all duration-500 fine:hover:border-line-strong lg:h-32"
                  style={{
                    background: `linear-gradient(140deg, hsl(${hue} 55% 20%), hsl(${(hue + 45) % 360} 50% 9%))`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 fine:group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(90% 70% at 30% 0%, hsl(${hue} 85% 60% / 0.4), transparent 65%)`,
                    }}
                  />
                  <span className="relative font-display text-base font-bold leading-tight lg:text-lg">
                    {genre.name}
                  </span>
                  <ArrowRight
                    size={15}
                    className="relative ml-auto shrink-0 text-white/50 transition-transform duration-500 group-hover:translate-x-1"
                  />
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>

      {/* Full-bleed ticker of the remaining genres. */}
      {genres.length > 10 && (
        <div className="mask-fade-x mt-4">
          <Marquee speed={44}>
            {genres.slice(10).map((genre) => (
              <Link
                key={genre.id}
                href={`/browse?genres=${genre.slug}`}
                className="rounded-full border border-line bg-white/[0.03] px-5 py-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
              >
                {genre.name}
              </Link>
            ))}
          </Marquee>
        </div>
      )}
    </Section>
  );
}

function JoinCta() {
  return (
    <Section>
      <Container>
        <Reveal>
          <div className="noise relative isolate overflow-hidden rounded-[28px] border border-line px-6 py-14 text-center sm:px-12 lg:py-20">
            <Aurora intensity="normal" className="-z-10" />
            <GridLines className="-z-10 opacity-50" />

            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-soft">
              Free, forever
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black leading-[1.05] sm:text-4xl lg:text-5xl">
              Never miss a release you&rsquo;ve been waiting for
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              Create an account to build a watchlist, track what you&rsquo;re playing and
              rate the games you finish.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button href="/signup" size="lg" iconRight={<ArrowRight size={17} />}>
                Create your account
              </Button>
              <Button href="/browse" size="lg" variant="secondary">
                Explore the database
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
