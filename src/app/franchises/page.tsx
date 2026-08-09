import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { igdbTopFranchises } from "@/lib/games/providers/igdb";
import { hueFromString } from "@/lib/utils/format";

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
          <Stagger
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            gap={0.03}
            onMount
          >
            {franchises.map((franchise) => {
              const hue = hueFromString(franchise.slug);
              return (
                <StaggerItem key={franchise.id}>
                  <Link
                    href={`/franchise/${franchise.slug}`}
                    className="group relative flex h-24 items-end overflow-hidden rounded-2xl border border-line p-4 transition-all duration-500 fine:hover:border-line-strong"
                    style={{
                      background: `linear-gradient(140deg, hsl(${hue} 55% 20%), hsl(${(hue + 45) % 360} 50% 9%))`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 opacity-0 transition-opacity duration-500 fine:group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(90% 70% at 30% 0%, hsl(${hue} 85% 60% / 0.4), transparent 65%)`,
                      }}
                    />
                    <span className="relative line-clamp-2 font-display text-[15px] font-bold leading-tight">
                      {franchise.name}
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </Container>
    </>
  );
}
