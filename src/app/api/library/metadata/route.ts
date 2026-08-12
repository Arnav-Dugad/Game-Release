import { NextResponse } from "next/server";
import { igdbConfigured, listGamesByIds } from "@/lib/games/providers/igdb";

export const dynamic = "force-dynamic";

/** Public catalogue repair endpoint. It returns no personal data. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.filter((id): id is number => Number.isInteger(id) && Number(id) > 0))].slice(0, 100)
      : [];
    if (ids.length === 0 || !igdbConfigured()) {
      return NextResponse.json({ games: [], syncedAt: Date.now() });
    }
    const games = await listGamesByIds(ids);
    return NextResponse.json(
      { games, syncedAt: Date.now() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[library/metadata] refresh failed", error);
    return NextResponse.json({ games: [], syncedAt: Date.now() }, { status: 200 });
  }
}
