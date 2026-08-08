import { NextResponse } from "next/server";
import { igdbDiagnostics } from "@/lib/games/providers/igdb";

/**
 * Data-source diagnostics.
 *
 * Exists because a provider failure used to be invisible: IGDB would 403, the
 * chain would quietly fall through, and the site looked "wrong" with no way to
 * tell why from the outside. This reports exactly which step failed and what
 * to do about it, without ever echoing the credentials themselves.
 *
 * Safe to leave public — it returns booleans and error classifications, never
 * secret values.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const igdb = await igdbDiagnostics();

  return NextResponse.json(
    {
      ok: igdb.ok,
      igdb,
      checkedAt: new Date().toISOString(),
    },
    {
      status: igdb.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
