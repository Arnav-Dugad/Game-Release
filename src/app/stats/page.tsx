import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { StatsView } from "@/components/stats/StatsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGenres } from "@/lib/games/source";

export const metadata: Metadata = {
  title: "Your game stats",
  description: "A private, game-level view of your collection, progress, platforms, genres, and play history.",
  robots: { index: false, follow: false },
};

export default async function StatsPage() {
  const { data: genres } = await getGenres();
  return (
    <>
      <PageHeader
        eyebrow="Your collection, decoded"
        title="Personal stats studio"
        description="A precise view of what you own, what you finish, and how your taste evolves—calculated from your private Firebase library."
      />
      <AuthGate>
        <StatsView genreDirectory={genres} />
      </AuthGate>
    </>
  );
}
