import type { ReleaseLike } from "@/lib/utils/format";

export type ReleaseState = "released" | "upcoming" | "unknown";

const MONTHS: Array<[RegExp, number]> = [
  [/\bjan(?:uary)?\b/, 1], [/\bfeb(?:ruary)?\b/, 2], [/\bmar(?:ch)?\b/, 3],
  [/\bapr(?:il)?\b/, 4], [/\bmay\b/, 5], [/\bjun(?:e)?\b/, 6],
  [/\bjul(?:y)?\b/, 7], [/\baug(?:ust)?\b/, 8], [/\bsep(?:t(?:ember)?)?\b/, 9],
  [/\boct(?:ober)?\b/, 10], [/\bnov(?:ember)?\b/, 11], [/\bdec(?:ember)?\b/, 12],
];

export type ReleaseWindowPrecision = "month" | "quarter" | "period" | "year";
export interface ReleaseWindowInfo {
  start: string;
  end: string;
  precision: ReleaseWindowPrecision;
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function monthEnd(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Conservative bounds for every imprecise date format emitted by IGDB. */
export function releaseWindowInfo(window: string | null | undefined): ReleaseWindowInfo | null {
  const value = window?.trim().toLowerCase();
  if (!value) return null;
  const yearMatch = value.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);

  const numericMonth = value.match(/^\s*(19\d{2}|20\d{2}|21\d{2})[-/]([01]?\d)\s*$/);
  if (numericMonth) {
    const month = Number(numericMonth[2]);
    if (month >= 1 && month <= 12) {
      return { start: iso(year, month, 1), end: iso(year, month, monthEnd(year, month)), precision: "month" };
    }
  }

  const quarter = value.match(/\bq([1-4])\b/);
  if (quarter) {
    const startMonth = (Number(quarter[1]) - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return { start: iso(year, startMonth, 1), end: iso(year, endMonth, monthEnd(year, endMonth)), precision: "quarter" };
  }

  const month = MONTHS.find(([pattern]) => pattern.test(value))?.[1];
  if (month) return { start: iso(year, month, 1), end: iso(year, month, monthEnd(year, month)), precision: "month" };

  if (/\bearly\b/.test(value)) return { start: iso(year, 1, 1), end: iso(year, 4, 30), precision: "period" };
  if (/\bmid(?:dle)?\b/.test(value)) return { start: iso(year, 5, 1), end: iso(year, 8, 31), precision: "period" };
  if (/\blate\b/.test(value)) return { start: iso(year, 9, 1), end: iso(year, 12, 31), precision: "period" };
  if (/^\s*(19\d{2}|20\d{2}|21\d{2})\s*$/.test(value)) {
    return { start: iso(year, 1, 1), end: iso(year, 12, 31), precision: "year" };
  }
  return null;
}

export function releaseWindowBounds(window: string | null | undefined): { start: string; end: string } | null {
  const info = releaseWindowInfo(window);
  return info ? { start: info.start, end: info.end } : null;
}

/** TBA is upcoming; only genuinely absent, non-TBA provider data is unknown. */
export function releaseState(game: ReleaseLike, now: Date = new Date()): ReleaseState {
  const today = now.toISOString().slice(0, 10);
  if (game.released && /^\d{4}-\d{2}-\d{2}$/.test(game.released)) {
    return game.released > today ? "upcoming" : "released";
  }
  const window = releaseWindowInfo(game.releaseWindow);
  if (!window) return game.tba ? "upcoming" : "unknown";
  // A month-level commitment is considered released once that month begins.
  // This avoids leaving an August 2026 release "unknown" throughout August.
  if (window.precision === "month") return window.start <= today ? "released" : "upcoming";
  if (window.end < today) return "released";
  if (window.start > today) return "upcoming";
  return "unknown";
}
