import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarX2 } from "lucide-react";
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
 * 48 keeps the timeline long enough to feel like a real calendar without
 * pushing a single page past a couple of hundred DOM-heavy rows.
 */
const PAGE_SIZE = 48;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function UpcomingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const genres = first(sp.genres);
  const platforms = first(sp.platforms);
  const ordering = (first(sp.ordering) as SortKey | undefined) ?? "released";
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  // Notable-only is the default. Opting *out* is the explicit choice, because
  // the unfiltered calendar is two thirds shovelware and reads as broken.
  const showAll = first(sp.all) === "1";

  const [{ data, source }, genreList, platformList] = await Promise.all([
    getUpcoming(PAGE_SIZE, page, { genres, platforms, ordering, notableOnly: !showAll }),
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
        title="What's coming next"
        description="Every announced release ahead, grouped by month and counting down to launch."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" icon={<CalendarClock size={12} />}>
            {data.count.toLocaleString("en-US")} {filtered ? "matching" : "tracked"}
          </Badge>
          {dated > 0 && <Badge tone="neon">{dated} dated on this page</Badge>}
          {/*
            An honest escape hatch rather than a hidden filter. The default hides
            roughly two thirds of the calendar, so it has to say so and offer the
            way back.
          */}
          <Link
            href={showAll ? "/upcoming" : "/upcoming?all=1"}
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

        <BrowseControls
          genres={genreList.data}
          platforms={platformList.data}
          totalCount={data.count}
          sorts={UPCOMING_SORTS}
          defaultSort="released"
          noun="release"
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
