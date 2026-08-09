import { NextResponse } from "next/server";
import { steamDeals } from "@/lib/games/providers/steam";
import { DEFAULT_STEAM_REGION, isValidRegion } from "@/lib/games/stores-catalog";

/** Regional, verified Steam discounts for the public Deals page. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("cc")?.toLowerCase() ?? "";
  const region = isValidRegion(requested) ? requested : DEFAULT_STEAM_REGION;
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(60, Math.max(12, Math.floor(requestedLimit)))
    : 36;

  try {
    const deals = await steamDeals(limit, region);
    return NextResponse.json(
      { deals, region, refreshedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      },
    );
  } catch (err) {
    console.error("[api/deals] failed", err);
    return NextResponse.json(
      { deals: [], region, refreshedAt: null, unavailable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
