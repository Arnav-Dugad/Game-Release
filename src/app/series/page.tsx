import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { igdbTopSeries } from "@/lib/games/providers/igdb";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Game series",
  description: "Browse canonical game series from IGDB Collections.",
};

export default async function SeriesDirectoryPage() {
  const series = await igdbTopSeries(72);

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Series"
        description="True release series, led by the collections with the most games. Franchises and genres are kept separate."
      />

      <Container className="py-8 lg:py-12">
        {!series || series.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Series directory unavailable"
            body="This list comes from IGDB, which isn't answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory items={series} kind="series" />
        )}
      </Container>
    </>
  );
}
