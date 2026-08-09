import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarX2, Sparkles } from "lucide-react";
import { BrowseControls, UPCOMING_SORTS } from "@/components/game/BrowseControls";
import { ReleaseTimeline } from "@/components/game/ReleaseTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { Pagination } from "@/components/ui/Pagination";
import { DataSourceNotice, SourceAttribution } from "@/components/ui/DataSourceNotice";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGenres, getPlatforms, getUpcoming, isDegraded } from "@/lib/games/source";
import type { SortKey } from "@/lib/games/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Upcoming game releases",
  description:
    "A filterable, month-by-month calendar of upcoming video game releases with countdowns, platforms and critic scores.",
};

/**
 * 120 keeps the timeline useful across long release windows without
 * pushing a single page past a couple of hundred DOM-heavy rows.
 */
const PAGE_SIZE = 120;
const WINDOWS = [
  { value: "30", label: "Next 30 days", detail: "Immediate launches" },
  { value: "90", label: "Next 90 days", detail: "The useful default" },
  { value: "365", label: "Next 12 months", detail: "Long-range calendar" },
  { value: "all", label: "All announced", detail: "Every dated release" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function UpcomingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const genres = first(sp.genres);
  const platforms = first(sp.platforms);
  const ordering = (first(sp.ordering) as SortKey | undefined) ?? "released";
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const requestedWindow = first(sp.window);
  const timeframe = WINDOWS.some((item) => item.value === requestedWindow) ? requestedWindow! : "90";
  // Notable-only is the default. Opting *out* is the explicit choice, because
  // the unfiltered calendar is two thirds shovelware and reads as broken.
  const showAll = first(sp.all) === "1";
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const rangeDays = timeframe === "all" ? null : Number(timeframe);
  const to = rangeDays
    ? new Date(today.getTime() + rangeDays * 86_400_000).toISOString().slice(0, 10)
    : null;
  const dates = to ? `${from},${to}` : undefined;

  const [{ data, source }, genreList, platformList] = await Promise.all([
    getUpcoming(PAGE_SIZE, page, { genres, platforms, dates, ordering, notableOnly: !showAll }),
    getGenres(),
    getPlatforms(),
  ]);

  const totalPages = data.count > 0 ? Math.ceil(data.count / PAGE_SIZE) : 1;
  const dated = data.results.filter((game) => game.released).length;
  const filtered = Boolean(genres || platforms);

  return (
    <>
      <PageHeader
        eyebrow="Release calendar"
        title="A release calendar you can actually use"
        description="Correct UTC dates, clear launch windows, month navigation, and the controls to focus on what you can play next."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" icon={<CalendarClock size={12} />}>
            {data.count.toLocaleString("en-US")} {filtered ? "matching" : "scheduled"}
          </Badge>
          {dated > 0 && <Badge tone="neon">{dated} dated on this page</Badge>}
          {/*
            An honest escape hatch rather than a hidden filter. The default hides
            roughly two thirds of the calendar, so it has to say so and offer the
            way back.
          */}
          <Link
            href={upcomingHref({ genres, platforms, ordering, timeframe, showAll: !showAll })}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3 py-1 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            {showAll ? "Show anticipated only" : "Include every announced game"}
          </Link>
        </div>
      </PageHeader>

      <Container className="py-8 lg:py-12">
        {source === "unavailable" && (
          <div className="mb-7">
            <DataSourceNotice source={source} degraded={isDegraded(source)} />
          </div>
        )}

        <nav aria-label="Release horizon" className="mb-6 grid gap-2 rounded-3xl border border-line bg-panel/45 p-2 sm:grid-cols-2 lg:grid-cols-4">
          {WINDOWS.map((item) => {
            const active = timeframe === item.value;
            return <Link key={item.value} href={upcomingHref({ genres, platforms, ordering, timeframe: item.value, showAll })} aria-current={active ? "page" : undefined} className={active ? "rounded-2xl border border-brand/35 bg-brand/15 p-4 text-white shadow-[0_18px_45px_-28px_rgba(124,92,255,0.9)]" : "rounded-2xl border border-transparent p-4 text-muted transition-colors hover:border-line hover:bg-white/[0.035] hover:text-text"}><span className="flex items-center gap-2 text-sm font-bold">{active ? <Sparkles size={14} className="text-brand-soft" /> : <CalendarDays size={14} className="text-faint" />}{item.label}</span><span className="mt-1.5 block pl-[22px] text-[11px] text-faint">{item.detail}</span></Link>;
          })}
        </nav>

        <BrowseControls
          genres={genreList.data}
          platforms={platformList.data}
          totalCount={data.count}
          sorts={UPCOMING_SORTS}
          defaultSort="released"
          noun="release"
          showDatePresets={false}
        />

        <div className="mt-9">
          {data.results.length === 0 ? (
            <EmptyCalendar filtered={filtered} showAll={showAll} />
          ) : (
            <>
              <ReleaseTimeline games={data.results} />
              <Pagination
                page={page}
                hasNext={data.hasNext}
                totalPages={totalPages}
                basePath="/upcoming"
                params={{
                  genres,
                  platforms,
                  ordering: ordering === "released" ? undefined : ordering,
                  all: showAll ? "1" : undefined,
                  window: timeframe === "90" ? undefined : timeframe,
                }}
              />
            </>
          )}
        </div>

        <div className="mt-10">
          <SourceAttribution source={source} />
        </div>
      </Container>
    </>
  );
}

function upcomingHref({
  genres,
  platforms,
  ordering,
  timeframe,
  showAll,
}: {
  genres?: string;
  platforms?: string;
  ordering?: SortKey;
  timeframe: string;
  showAll: boolean;
}) {
  const params = new URLSearchParams();
  if (genres) params.set("genres", genres);
  if (platforms) params.set("platforms", platforms);
  if (ordering && ordering !== "released") params.set("ordering", ordering);
  if (timeframe !== "90") params.set("window", timeframe);
  if (showAll) params.set("all", "1");
  const query = params.toString();
  return query ? `/upcoming?${query}` : "/upcoming";
}

function EmptyCalendar({ filtered, showAll }: { filtered: boolean; showAll: boolean }) {
  if (filtered) {
    return (
      <EmptyState
        icon={<CalendarX2 size={24} />}
        title="Nothing upcoming matches those filters"
        body="Try widening the genre or platform selection."
        action={{ href: "/upcoming", label: "Clear filters" }}
      />
    );
  }

  return (
    <EmptyState
      icon={<CalendarX2 size={24} />}
      title="Nothing scheduled right now"
      body={
        showAll
          ? "The calendar will fill in as studios announce dates."
          : "Nothing with a following is dated yet. The full calendar includes every announced game, most of which nobody is tracking."
      }
      action={showAll ? undefined : { href: "/upcoming?all=1", label: "Include every game" }}
      secondaryAction={{ href: "/browse", label: "Browse released games" }}
    />
  );
}
