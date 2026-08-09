import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { parseDirectorySearchParams, type DirectorySearchParams } from "@/lib/games/directory";
import { igdbFranchiseDirectory } from "@/lib/games/providers/igdb";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Game franchises",
  description: "Search and browse complete game universes from IGDB Franchises.",
};

export default async function FranchiseDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}) {
  const filters = parseDirectorySearchParams(await searchParams);
  const directory = await igdbFranchiseDirectory({ ...filters, pageSize: 60 });

  return (
    <>
      <PageHeader
        eyebrow="Universe directory"
        title="Franchises"
        description="Explore connected game universes, spin-offs, and release lines without confusing them with genres. Every page continues beyond the first 60 results."
      />
      <Container className="py-8 lg:py-12">
        {!directory ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Franchise directory unavailable"
            body="This live IGDB directory is not answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory
            key={`${filters.query}-${filters.order}-${filters.page}`}
            items={directory.results}
            kind="franchise"
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
