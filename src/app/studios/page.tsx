import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { igdbTopStudios } from "@/lib/games/providers/igdb";

/** Studio rosters barely move; a week is plenty. */
export const revalidate = 604800;

export const metadata: Metadata = {
  title: "Game studios",
  description:
    "Browse the studios behind the games — developers and publishers, ranked by how much they have shipped.",
};

export default async function StudiosPage() {
  const studios = await igdbTopStudios(72);

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Studios"
        description="The developers and publishers behind the catalogue, led by the ones who have shipped the most."
      />

      <Container className="py-8 lg:py-12">
        {!studios || studios.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title="Studio directory unavailable"
            body="This list comes from IGDB, which isn't answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory items={studios} kind="studio" />
        )}
      </Container>
    </>
  );
}
