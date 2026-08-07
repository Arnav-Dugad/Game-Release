"use client";

/**
 * Personalised recommendation rail.
 *
 * Renders nothing at all until it has something genuinely useful to say: a
 * signed-out visitor, an empty watchlist, or a profile too thin to be
 * meaningful all produce no rail rather than a generic one pretending to be
 * personal. Once there is enough signal, the heading names *why* these games
 * were picked, which is the difference between a recommendation and a guess.
 */

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { buildTasteProfile, MIN_TASTE_STRENGTH } from "@/lib/games/taste";
import { GameRail } from "@/components/game/GameRail";
import { Container, Section, SectionHeading } from "@/components/ui/SectionHeading";
import { GameRailSkeleton } from "@/components/ui/Skeleton";
import type { GameSummary } from "@/lib/games/types";
import type { Ref } from "@/lib/games/types";

export function RecommendedRail({ genres }: { genres: Ref[] }) {
  const { user, loading: authLoading } = useAuth();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const [results, setResults] = useState<GameSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const profile = useMemo(
    () =>
      buildTasteProfile(
        entries.map((entry) => ({
          gameId: entry.gameId,
          genreIds: entry.genreIds ?? [],
          platformSlugs: entry.platformSlugs ?? [],
          status: entry.status,
          platform: entry.platform ?? null,
          addedAt: entry.addedAt,
          finishedAt: entry.finishedAt ?? null,
        })),
      ),
    [entries],
  );

  const usable =
    Boolean(user) && profile.strength >= MIN_TASTE_STRENGTH && profile.genreIds.length > 0;

  useEffect(() => {
    if (!usable) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      genres: profile.genreIds.join(","),
      platforms: profile.platformSlugs.join(","),
      exclude: profile.excludeIds.slice(0, 40).join(","),
      limit: "14",
    });

    fetch(`/api/recommendations?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data: { results?: GameSummary[] }) => setResults(data.results ?? []))
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") setFailed(true);
      });

    return () => controller.abort();
  }, [usable, profile.genreIds, profile.platformSlugs, profile.excludeIds]);

  // Names the strongest genres so the rail explains its own reasoning.
  const because = useMemo(() => {
    const byId = new Map(genres.map((genre) => [genre.id, genre.name]));
    const named = profile.genreIds
      .map((id) => byId.get(id))
      .filter((name): name is string => Boolean(name))
      .slice(0, 2);
    return named.length > 0 ? named.join(" and ") : null;
  }, [genres, profile.genreIds]);

  if (authLoading || (user && watchlistLoading)) return null;
  if (!usable || failed) return null;

  return (
    <Section className="py-8 sm:py-11">
      <Container>
        <SectionHeading
          eyebrow="Picked for you"
          title={<span className="flex items-center gap-3">Because you play {because ?? "these"}</span>}
          description={`Drawn from the ${profile.excludeIds.length} ${
            profile.excludeIds.length === 1 ? "game" : "games"
          } in your library, weighted toward what you've actually finished.`}
          href="/browse"
          linkLabel="Browse more"
        />
      </Container>
      <div className="mt-7">
        {results === null ? (
          <Container>
            <GameRailSkeleton count={6} />
          </Container>
        ) : results.length > 0 ? (
          <GameRail games={results} />
        ) : (
          <Container>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Sparkles size={15} className="text-brand-soft" />
              Track a few more games and this gets sharper.
            </p>
          </Container>
        )}
      </div>
    </Section>
  );
}
