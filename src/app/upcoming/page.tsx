import type { Metadata } from "next";
import { CalendarClock, CalendarX2 } from "lucide-react";
import { BrowseControls, UPCOMING_SORTS } from "@/components/game/BrowseControls";
import { ReleaseTimeline } from "@/components/game/ReleaseTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { Pagination } from "@/components/ui/Pagination";
import { DataSourceNotice, SourceAttribution } from "@/components/ui/DataSourceNotice";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getGenres, getPlatforms, getUpcoming } from "@/lib/games/source";
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

  const [{ data, source }, genreList, platformList] = await Promise.all([
    getUpcoming(PAGE_SIZE, page, { genres, platforms, ordering }),
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
        </div>
      </PageHeader>

      <Container className="py-8 lg:py-12">
        {source === "unavailable" && (
          <div className="mb-7">
            <DataSourceNotice source={source} />
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
            <EmptyCalendar filtered={filtered} />
          ) : (
            <>
              <ReleaseTimeline games={data.results} />
              <Pagination
                page={page}
                hasNext={data.hasNext}
                totalPages={totalPages}
                basePath="/upcoming"
                params={{ genres, platforms, ordering: ordering === "released" ? undefined : ordering }}
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

function EmptyCalendar({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
        <CalendarX2 size={24} className="text-faint" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">
        {filtered ? "Nothing upcoming matches those filters" : "Nothing scheduled right now"}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {filtered
          ? "Try widening the genre or platform selection."
          : "The calendar will fill in as studios announce dates."}
      </p>
      {filtered && (
        <Button href="/upcoming" variant="secondary" className="mt-6">
          Clear filters
        </Button>
      )}
    </div>
  );
}
