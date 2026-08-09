"use client";

/**
 * Steam price, resolved in the reader's own currency, with history.
 *
 * Fetched on the client rather than during SSR. The price is the only part of a
 * game page that differs per reader, and resolving it on the server meant
 * reading the region cookie there — which opts the whole route out of static
 * rendering. Keeping this one request client-side lets the rest of the page,
 * which is identical for everyone, stay prerendered and cached.
 *
 * Every observation is also recorded, which is what builds the history in the
 * first place: Steam publishes today's price and nothing else, so "is this
 * cheap?" is only answerable from prices we saved as we saw them.
 *
 * Renders nothing at all until a price arrives, so a title with no Steam
 * listing (or a failed lookup) leaves no empty card behind.
 */

import { useEffect, useMemo, useState } from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import {
  getPriceHistory,
  priceInsight,
  recordPrice,
  type PricePoint,
} from "@/lib/games/price-history";
import type { Price } from "@/lib/games/types";

export function PriceCard({ steamAppId }: { steamAppId: number | null }) {
  const { region, regionInfo, ready } = usePreferences();
  /**
   * The last response actually received, tagged with the request that produced
   * it. Deriving `loading` from this rather than tracking it separately means a
   * region change can never briefly show the previous currency's price, and
   * there is no loading flag that can get stuck.
   */
  const [settled, setSettled] = useState<{ key: string; price: Price | null } | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);

  // Only meaningful once the stored preference has loaded — otherwise the first
  // request goes out with the default region and is immediately superseded.
  const key = steamAppId && ready ? `${steamAppId}:${region}` : null;
  const price = key && settled?.key === key ? settled.price : null;
  const loading = key !== null && settled?.key !== key;

  useEffect(() => {
    if (!key) return;

    // Cleanup aborts the previous request, so a response can only ever settle
    // for the region currently selected.
    const controller = new AbortController();

    fetch(`/api/price?appid=${steamAppId}&cc=${encodeURIComponent(region)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { price: null }))
      .then((data: { price?: Price | null }) => setSettled({ key, price: data.price ?? null }))
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[price] failed", err);
          setSettled({ key, price: null });
        }
      });

    return () => controller.abort();
  }, [key, steamAppId, region]);

  /*
   * Record today's observation, then read the series back.
   *
   * Recording from the page view is what makes the history exist without a
   * server-side scheduler: any reader looking at a game contributes that day's
   * datapoint for their region, and the write is idempotent per day so repeat
   * views cost one read rather than a duplicate.
   */
  useEffect(() => {
    if (!steamAppId || !price) return;
    let cancelled = false;

    void recordPrice(steamAppId, region, price, regionInfo?.currency ?? "")
      .then(() => getPriceHistory(steamAppId, region))
      .then((points) => {
        if (!cancelled) setHistory(points);
      })
      .catch(() => {
        /* history is an enhancement, never a failure mode */
      });

    return () => {
      cancelled = true;
    };
  }, [steamAppId, region, price, regionInfo]);

  const insight = useMemo(() => priceInsight(history), [history]);

  if (!steamAppId) return null;

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="mt-3 h-7 w-28 rounded-lg" />
      </div>
    );
  }

  if (!price) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            {price.isFree ? "Price" : "Steam price"}
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-mint">{price.current}</span>
            {price.original && (
              <span className="text-sm text-faint line-through">{price.original}</span>
            )}
          </p>
        </div>
        {price.discountPercent > 0 && (
          <span className="shrink-0 rounded-lg bg-mint/15 px-2.5 py-1.5 text-sm font-bold text-mint tabular-nums">
            −{price.discountPercent}%
          </span>
        )}
      </div>

      {/* Only shown once the series is long enough to mean something. */}
      {insight && (
        <div className="mt-4 border-t border-line pt-3.5">
          {insight.isAllTimeLow ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-mint">
              <Sparkles size={14} className="shrink-0" />
              Lowest price we&rsquo;ve recorded
            </p>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <TrendingDown size={14} className="shrink-0 text-faint" />
              {insight.belowPeakPercent > 0
                ? `${insight.belowPeakPercent}% below its highest recorded price`
                : "At its highest recorded price"}
            </p>
          )}
          <p className="mt-1 text-[11px] text-faint">
            Tracked across {insight.points} {insight.points === 1 ? "day" : "days"} in{" "}
            {regionInfo?.name ?? region.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}
