import type { Metadata } from "next";
import { EntityPage } from "@/components/game/EntityPage";
import { igdbFranchise } from "@/lib/games/providers/igdb";

export const revalidate = 86400;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const franchise = await igdbFranchise(slug);
  if (!franchise) return { title: "Series not found" };

  return {
    title: franchise.name,
    description: `Every game in the ${franchise.name} series, in release order.`,
  };
}

export default async function FranchisePage({ params }: { params: Params }) {
  const { slug } = await params;
  return <EntityPage entity={await igdbFranchise(slug)} kind="franchise" eyebrow="Series" />;
}
