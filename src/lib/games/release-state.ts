import type { ReleaseLike } from "@/lib/utils/format";

export type ReleaseState = "released" | "upcoming" | "unknown";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function monthEnd(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Conservative bounds for common IGDB human date windows. */
export function releaseWindowBounds(window: string | null | undefined): { start: string; end: string } | null {
  const value = window?.trim().toLowerCase();
  if (!value) return null;
  const yearMatch = value.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);

  const quarter = value.match(/\bq([1-4])\b/);
  if (quarter) {
    const startMonth = (Number(quarter[1]) - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return { start: iso(year, startMonth, 1), end: iso(year, endMonth, monthEnd(year, endMonth)) };
  }

  const month = Object.entries(MONTHS).find(([name]) => value.includes(name))?.[1];
  if (month) return { start: iso(year, month, 1), end: iso(year, month, monthEnd(year, month)) };

  if (/\bearly\b/.test(value)) return { start: iso(year, 1, 1), end: iso(year, 4, 30) };
  if (/\bmid(?:dle)?\b/.test(value)) return { start: iso(year, 5, 1), end: iso(year, 8, 31) };
  if (/\blate\b/.test(value)) return { start: iso(year, 9, 1), end: iso(year, 12, 31) };
  if (/^\s*(19\d{2}|20\d{2}|21\d{2})\s*$/.test(value)) {
    return { start: iso(year, 1, 1), end: iso(year, 12, 31) };
  }
  return null;
}

/** Unknown is deliberately not upcoming: absence of data is not a future release. */
export function releaseState(game: ReleaseLike, now: Date = new Date()): ReleaseState {
  const today = now.toISOString().slice(0, 10);
  if (game.released && /^\d{4}-\d{2}-\d{2}$/.test(game.released)) {
    return game.released > today ? "upcoming" : "released";
  }
  const bounds = releaseWindowBounds(game.releaseWindow);
  if (!bounds) return "unknown";
  if (bounds.end < today) return "released";
  if (bounds.start > today) return "upcoming";
  return "unknown";
}

