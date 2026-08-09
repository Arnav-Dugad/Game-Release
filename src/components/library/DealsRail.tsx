"use client";

/**
 * Live discounts across the games you track.
 *
 * The genuinely useful version of a wishlist: rather than making people check
 * each game, this checks all of them and reports only what's actually on sale
 * today, in their currency.
 *
 * Two constraints shape it. Steam has no bulk price endpoint, so this is one
 * request per game — which means the set has to be bounded and the requests
 * throttled. And a wishlist is far more interesting than a library here: a
 * discount on something you already own is trivia, while a discount on
 * something you're waiting for is the whole point. Owned games are still
 * included but ranked below, and labelled, so "you own this on Steam and it's
 * cheap on your other store" stays visible without crowding out the rest.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import { GameCover } from "@/components/game/GameCover";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { cn } from "@/lib/utils/cn";
import type { Price } from "@/lib/games/types";
import type { WatchlistEntry } from "@/lib/firebase/db";

/** Bounded so a large collection can't fan out into hundreds of requests. */
const MAX_CHECKED = 24;
/** Steam throttles aggressively; this stays comfortably under it. */
const CONCURRENCY = 4;

interface Deal {
  entry: WatchlistEntry;
  price: Price;
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return out;
}

export function DealsRail() {
  const { entries, loading } = useWatchlist();
  const { region, ready } = usePreferences();
  const [deals, setDeals] = useState<Deal[] | null>(null);

  /**
   * Candidates, wanted-first. Entries store no Steam app id, so the lookup goes
   * by slug and the endpoint resolves it; titles with no Steam listing simply
   * come back priceless and drop out.
   */
  const candidates = useMemo(() => {
    const rank = (entry: WatchlistEntry) => ((entry.ownedOn ?? []).length > 0 ? 1 : 0);
    return [...entries]
      .sort((a, b) => rank(a) - rank(b) || b.addedAt - a.addedAt)
      .slice(0, MAX_CHECKED);
  }, [entries]);

  const key = candidates.map((entry) => entry.gameId).join(",");

  useEffect(() => {
    if (!ready || candidates.length === 0) return;
    const controller = new AbortController();

    void mapWithLimit(candidates, CONCURRENCY, async (entry) => {
      try {
        const res = await fetch(
          `/api/price?slug=${encodeURIComponent(entry.slug)}&cc=${encodeURIComponent(region)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { price?: Price | null };
        // Only an actual discount counts. Full price is not a deal.
        if (!data.price || data.price.discountPercent <= 0) return null;
        return { entry, price: data.price } satisfies Deal;
      } catch {
        return null;
      }
    })
      .then((results) => {
        if (controller.signal.aborted) return;
        const found = results.filter((deal): deal is Deal => deal !== null);
        found.sort((a, b) => b.price.discountPercent - a.price.discountPercent);
        setDeals(found);
      })
      .catch(() => setDeals([]));

    return () => controller.abort();
  }, [key, region, ready, candidates]);

  if (loading || !deals || deals.length === 0) return null;

  return (
    <section className="mb-8 rounded-3xl border border-mint/25 bg-mint/[0.06] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Tag size={16} className="text-mint" />
        <h2 className="font-display text-lg font-bold">On sale now</h2>
        <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint tabular-nums">
          {deals.length}
        </span>
        <Link
          href="/deals"
          className="ml-auto text-xs font-semibold text-muted transition-colors hover:text-text"
        >
          Explore all deals →
        </Link>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map(({ entry, price }) => {
          const owned = (entry.ownedOn ?? []).length > 0;
          return (
            <li key={entry.gameId}>
              <Link
                href={`/game/${entry.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-panel/60 p-2.5 transition-colors fine:hover:border-line-strong"
              >
                <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg">
                  <GameCover
                    name={entry.name}
                    slug={entry.slug}
                    image={entry.image}
                    imageFallback={entry.imageFallback}
                    width={160}
                    sizes="44px"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.name}</span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-mint">{price.current}</span>
                    {price.original && (
                      <span className="text-[11px] text-faint line-through">{price.original}</span>
                    )}
                  </span>
                  {owned && (
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.08em] text-faint">
                      Already in your library
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-[13px] font-bold tabular-nums",
                    owned ? "bg-white/8 text-muted" : "bg-mint/15 text-mint",
                  )}
                >
                  −{price.discountPercent}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
