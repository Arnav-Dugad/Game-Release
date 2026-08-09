import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { igdbStudiosDirectory } from "@/lib/games/providers/igdb";
import { parseDirectorySearchParams, type DirectorySearchParams } from "@/lib/games/directory";

// The provider result is cached for a week; the shell stays dynamic so a
// failed build-time request cannot publish an empty directory for a week.
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Game studios",
  description:
    "Browse the studios behind the games — developers and publishers, ranked by how much they have shipped.",
};

export default async function StudiosPage({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}) {
  const filters = parseDirectorySearchParams(await searchParams);
  const directory = await igdbStudiosDirectory({ ...filters, pageSize: 60 });

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Studios"
        description="Search and browse the complete developer and publisher directory, with every result linked to its game catalogue."
      />

      <Container className="py-8 lg:py-12">
        {!directory ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title="Studio directory unavailable"
            body="This list comes from IGDB, which isn't answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory
            key={`${filters.query}-${filters.order}-${filters.page}`}
            items={directory.results}
            kind="studio"
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
