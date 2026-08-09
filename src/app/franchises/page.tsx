import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityDirectory } from "@/components/game/EntityDirectory";
import { igdbTopFranchises } from "@/lib/games/providers/igdb";

export const revalidate = 604800;

export const metadata: Metadata = {
  title: "Game series",
  description: "Browse game franchises and series, from the largest to the most niche.",
};

export default async function FranchisesPage() {
  const franchises = await igdbTopFranchises(72);

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Series"
        description="Franchises worth following as a whole, led by the ones with the most entries."
      />

      <Container className="py-8 lg:py-12">
        {!franchises || franchises.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Series directory unavailable"
            body="This list comes from IGDB, which isn't answering right now. It should return shortly."
            action={{ href: "/browse", label: "Browse games instead" }}
          />
        ) : (
          <EntityDirectory items={franchises} kind="franchise" />
        )}
      </Container>
    </>
  );
}
