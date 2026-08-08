import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { BrowseControls } from "@/components/game/BrowseControls";
import { GameGrid } from "@/components/game/GameGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { Pagination } from "@/components/ui/Pagination";
import { DataSourceNotice } from "@/components/ui/DataSourceNotice";
import { Button } from "@/components/ui/Button";
import { browseGames, getGenres, getPlatforms, isDegraded } from "@/lib/games/source";
import type { SortKey } from "@/lib/games/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Browse games",
  description:
    "Filter the full game database by genre, platform and score, sorted however you like.",
};

const PAGE_SIZE = 24;

/** Next 15+ delivers search params asynchronously. */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const search = first(sp.search);
  const genres = first(sp.genres);
  const platforms = first(sp.platforms);
  const ordering = first(sp.ordering) as SortKey | undefined;
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);

  const [{ data, source }, genreList, platformList] = await Promise.all([
    browseGames({ search, genres, platforms, ordering, page, pageSize: PAGE_SIZE }),
    getGenres(),
    getPlatforms(),
  ]);

  const totalPages = data.count > 0 ? Math.ceil(data.count / PAGE_SIZE) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Database"
        title={search ? `Results for “${search}”` : "Browse every game"}
        description={
          search
            ? undefined
            : "Filter by genre and platform, then sort by popularity, score or release date."
        }
      />

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
        />

        <div className="mt-8">
          {data.results.length === 0 ? (
            <EmptyResults />
          ) : (
            <>
              <GameGrid games={data.results} priorityCount={5} />
              <Pagination
                page={page}
                hasNext={data.hasNext}
                totalPages={totalPages}
                basePath="/browse"
                params={{ search, genres, platforms, ordering }}
              />
            </>
          )}
        </div>
      </Container>
    </>
  );
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
        <SearchX size={24} className="text-faint" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">No games match those filters</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Try removing a filter or two, or search for a title directly.
      </p>
      <Button href="/browse" variant="secondary" className="mt-6">
        Reset filters
      </Button>
    </div>
  );
}
