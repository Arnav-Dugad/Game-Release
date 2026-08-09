import { NextResponse } from "next/server";
import { steamPrice } from "@/lib/games/providers/steam";
import { getGame } from "@/lib/games/source";
import { DEFAULT_STEAM_REGION, isValidRegion } from "@/lib/games/stores-catalog";

/**
 * Regional Steam pricing for one app.
 *
 * Exists so the game page can stay statically prerendered. Pricing is the only
 * thing on that page that varies per reader, and resolving it during SSR meant
 * reading a cookie, which opts the route out of static rendering entirely — all
 * 60 prerendered game pages became on-demand renders, and the extra IGDB
 * traffic that caused was enough to trip the rate limit during builds.
 *
 * Fetching it here instead keeps the expensive, shared part of the page (all
 * the IGDB data) cacheable, and leaves only this small request personalised.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  /*
   * Two ways in.
   *
   * `appid` is the direct route, used by the game page which already knows it.
   * `slug` exists for saved lists: a watchlist entry stores no Steam app id, so
   * the deals view would otherwise need a schema migration before it could ask
   * about anything. Resolving through the cached detail record costs a lookup
   * that is almost always a cache hit.
   */
  let appId = Number(searchParams.get("appid"));

  if (!Number.isInteger(appId) || appId <= 0) {
    const slug = searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json({ price: null }, { status: 400 });
    }
    const result = await getGame(slug).catch(() => null);
    const resolved = result?.data.steamAppId;
    if (!resolved) {
      // No Steam listing is a legitimate answer, not an error.
      return NextResponse.json({ price: null }, { status: 200 });
    }
    appId = resolved;
  }

  // Validate against the known region list rather than passing user input
  // straight into the storefront URL.
  const requested = searchParams.get("cc")?.toLowerCase() ?? "";
  const region = isValidRegion(requested) ? requested : DEFAULT_STEAM_REGION;

  try {
    const price = await steamPrice(appId, region);
    return NextResponse.json(
      { price, region },
      {
        headers: {
          // Prices move slowly, and a stale one for a few minutes is far better
          // than hammering Steam on every page view.
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    console.error("[api/price] failed", err);
    return NextResponse.json({ price: null }, { status: 200 });
  }
}
