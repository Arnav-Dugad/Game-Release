import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityPage } from "@/components/game/EntityPage";
import { igdbSeries } from "@/lib/games/providers/igdb";

export const revalidate = 86400;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const series = await igdbSeries(slug);
  if (!series) notFound();

  return {
    title: series.name,
    description: `Every game in the ${series.name} series, in release order.`,
  };
}

export default async function SeriesPage({ params }: { params: Params }) {
  const { slug } = await params;
  return <EntityPage entity={await igdbSeries(slug)} kind="series" eyebrow="Series" />;
}
