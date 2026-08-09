import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { igdbSeriesDirectory } from "@/lib/games/providers/igdb";
import { parseDirectorySearchParams, type DirectorySearchParams } from "@/lib/games/directory";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Game series",
  description: "Browse canonical game series from IGDB Collections.",
};

export default async function SeriesDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}) {
  const filters = parseDirectorySearchParams(await searchParams);
  const directory = await igdbSeriesDirectory({ ...filters, pageSize: 60 });

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Series"
        description="Search and browse canonical multi-game series from IGDB Collections. Franchises and genres remain separate."
      />

      <Container className="py-8 lg:py-12">
        {!directory ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Series directory unavailable"
            body="This list comes from IGDB, which isn't answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory
            key={`${filters.query}-${filters.order}-${filters.page}`}
            items={directory.results}
            kind="series"
            query={filters.query}
            order={filters.order}
            page={directory.page}
            pageSize={directory.pageSize}
            count={directory.count}
            hasNext={directory.hasNext}
          />
        )}
      </Container>
    </>
  );
}
