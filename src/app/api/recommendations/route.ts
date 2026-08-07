import { NextResponse } from "next/server";
import { igdbRecommend } from "@/lib/games/providers/igdb";
import { getTopRated } from "@/lib/games/source";

/**
 * Recommendation endpoint.
 *
 * The taste profile is derived on the client from the user's own watchlist —
 * that data lives in Firestore under their uid and never needs to reach the
 * server. Only the anonymous *shape* of their taste (a handful of genre ids and
 * platform slugs) is sent here, which keeps provider credentials server-side
 * without moving personal data anywhere.
 *
 * Falls back to critically acclaimed titles when the profile is too thin or the
 * provider can't answer, so the rail is never empty.
 */

const numbers = (raw: string | null): number[] =>
  (raw ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 40);

const slugs = (raw: string | null): string[] =>
  (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9-]{1,32}$/.test(value))
    .slice(0, 8);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const genreIds = numbers(searchParams.get("genres"));
  const themeIds = numbers(searchParams.get("themes"));
  const platformSlugs = slugs(searchParams.get("platforms"));
  const excludeIds = numbers(searchParams.get("exclude"));
  const limit = Math.min(24, Math.max(4, Number(searchParams.get("limit")) || 12));

  try {
    if (genreIds.length > 0 || themeIds.length > 0) {
      const recommended = await igdbRecommend({
        genreIds,
        themeIds,
        platformSlugs,
        excludeIds,
        limit,
      });
      if (recommended && recommended.length > 0) {
        return NextResponse.json(
          { results: recommended, personalised: true },
          { headers: { "Cache-Control": "private, max-age=300" } },
        );
      }
    }

    const { data } = await getTopRated(limit);
    const excluded = new Set(excludeIds);
    return NextResponse.json(
      {
        results: data.filter((game) => !excluded.has(game.id)),
        personalised: false,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    console.error("[api/recommendations] failed", err);
    return NextResponse.json({ results: [], personalised: false }, { status: 200 });
  }
}
