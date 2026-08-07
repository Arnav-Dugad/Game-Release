import { NextResponse } from "next/server";
import { searchGames } from "@/lib/games/source";

/**
 * Search endpoint for the command palette.
 *
 * Exists so the RAWG key stays server-side — the palette is a client component
 * and must not hold credentials. Responses are cached briefly at the edge:
 * repeated keystrokes across users hit the same popular prefixes constantly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ results: [], source: "sample" });
  }

  try {
    const { data, source } = await searchGames(query, 8);
    return NextResponse.json(
      { results: data.results, source },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/search] failed", err);
    return NextResponse.json({ results: [], source: "sample" }, { status: 200 });
  }
}
