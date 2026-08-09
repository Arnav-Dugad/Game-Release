"use client";

/**
 * "Because you own <game>" — recommendations anchored to one specific title.
 *
 * Deliberately narrower than `RecommendedRail`, which blends the whole
 * watchlist into an averaged taste profile. Averaging is good for breadth and
 * bad for explanation: "because you play RPGs" is true of half the catalogue.
 * Naming one game the reader definitely owns makes the reasoning checkable, and
 * a recommendation you can argue with is worth more than one you can't.
 *
 * Renders nothing until there is a real owned game to anchor to — no signed-in
 * state, no ownership, no rail.
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { GameRail } from "@/components/game/GameRail";
import { Container, Section, SectionHeading } from "@/components/ui/SectionHeading";
import { GameRailSkeleton } from "@/components/ui/Skeleton";
import type { GameSummary } from "@/lib/games/types";

export function BecauseYouOwnRail() {
  const { user, loading: authLoading } = useAuth();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const [results, setResults] = useState<GameSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * The anchor: the most recently added owned game that actually carries
   * genres. Recency beats "favourite" here — the newest addition is the one
   * the reader's current interest is closest to.
   */
  const anchor = useMemo(() => {
    return (
      entries
        .filter((entry) => (entry.ownedOn ?? []).length > 0 && (entry.genreIds ?? []).length > 0)
        .sort((a, b) => b.addedAt - a.addedAt)[0] ?? null
    );
  }, [entries]);

  // Everything already tracked is excluded, so the rail can't recommend the
  // library back to itself.
  const excludeIds = useMemo(() => entries.map((entry) => entry.gameId), [entries]);

  const genreKey = anchor?.genreIds.join(",") ?? "";
  const platformKey = anchor?.platformSlugs?.join(",") ?? "";
  const excludeKey = excludeIds.slice(0, 40).join(",");

  useEffect(() => {
    if (!user || !genreKey) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      genres: genreKey,
      platforms: platformKey,
      exclude: excludeKey,
      limit: "14",
    });

    fetch(`/api/recommendations?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data: { results?: GameSummary[] }) => setResults(data.results ?? []))
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") setFailed(true);
      });

    return () => controller.abort();
  }, [user, genreKey, platformKey, excludeKey]);

  if (authLoading || (user && watchlistLoading)) return null;
  if (!user || !anchor || failed) return null;
  // An empty result set is not worth a heading promising recommendations.
  if (results !== null && results.length === 0) return null;

  return (
    <Section className="py-8 sm:py-11">
      <Container>
        <SectionHeading
          eyebrow="From your library"
          title={`Because you own ${anchor.name}`}
          description="Games that share its genres and platforms, minus everything you're already tracking."
          href="/library"
          linkLabel="Your library"
        />
      </Container>
      <div className="mt-7">
        {results === null ? (
          <Container>
            <GameRailSkeleton count={6} />
          </Container>
        ) : (
          <GameRail games={results} />
        )}
      </div>
    </Section>
  );
}
