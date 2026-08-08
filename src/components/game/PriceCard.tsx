"use client";

/**
 * Steam price, resolved in the reader's own currency.
 *
 * Fetched on the client rather than during SSR. The price is the only part of a
 * game page that differs per reader, and resolving it on the server meant
 * reading the region cookie there — which opts the whole route out of static
 * rendering. Keeping this one request client-side lets the rest of the page,
 * which is identical for everyone, stay prerendered and cached.
 *
 * Renders nothing at all until a price actually arrives, so a title with no
 * Steam listing (or a failed lookup) leaves no empty card behind.
 */

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import type { Price } from "@/lib/games/types";

export function PriceCard({ steamAppId }: { steamAppId: number | null }) {
  const { region, ready } = usePreferences();
  /**
   * The last response actually received, tagged with the request that produced
   * it. Deriving `loading` from this rather than tracking it separately means a
   * region change can never briefly show the previous currency's price, and
   * there is no loading flag that can get stuck.
   */
  const [settled, setSettled] = useState<{ key: string; price: Price | null } | null>(null);

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
    <div className="glass flex items-center justify-between gap-4 rounded-2xl p-5">
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
  );
}
