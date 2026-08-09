import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/SectionHeading";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
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
          <Stagger
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            gap={0.03}
            onMount
          >
            {studios.map((studio) => (
              <StaggerItem key={studio.id}>
                <Link
                  href={`/studio/${studio.slug}`}
                  className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-line bg-panel/40 p-4 text-center transition-all duration-300 fine:hover:-translate-y-1 fine:hover:border-line-strong"
                >
                  {studio.logo ? (
                    <span className="relative grid h-14 w-full place-items-center overflow-hidden rounded-xl bg-white/[0.92] p-2">
                      <Image
                        src={studio.logo}
                        alt=""
                        fill
                        sizes="120px"
                        className="object-contain p-2"
                      />
                    </span>
                  ) : (
                    <span className="grid h-14 w-full place-items-center rounded-xl bg-white/[0.04] font-display text-lg font-bold text-muted">
                      {studio.name.charAt(0)}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[13px] font-semibold leading-snug transition-colors group-hover:text-brand-soft">
                    {studio.name}
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>
    </>
  );
}
