/**
 * Presentation helpers shared by server and client components. Everything here
 * must be deterministic across the server/client boundary — hydration mismatches
 * in date formatting are the classic source of React warnings, so all date
 * formatting is pinned to UTC and `en-US`.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

const LONG_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** Parses `YYYY-MM-DD` as UTC midnight. Never let the local timezone shift a date. */
export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined, fallback = "TBA"): string {
  const d = parseISO(iso);
  return d ? DATE_FMT.format(d) : fallback;
}

export function formatLongDate(iso: string | null | undefined, fallback = "Date to be announced"): string {
  const d = parseISO(iso);
  return d ? LONG_FMT.format(d) : fallback;
}

export function formatMonth(iso: string | null | undefined): string {
  const d = parseISO(iso);
  return d ? MONTH_FMT.format(d) : "TBA";
}

export function releaseYear(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 4) : "TBA";
}

/** Whole days from now until `iso`. Negative once the date has passed. */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  const target = parseISO(iso);
  if (!target) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - start) / 86_400_000);
}

/**
 * Anything with a release date, however precise. Lets the label helpers accept
 * summaries, details and stored watchlist entries interchangeably.
 */
export interface ReleaseLike {
  released: string | null;
  releaseWindow: string | null;
  tba: boolean;
}

/**
 * The one place release dates become text.
 *
 * Exact dates format normally; a known-but-imprecise window ("Q4 2026") is
 * printed verbatim; only a genuine absence of information reads as TBA. Every
 * surface goes through here so no view can accidentally imply a precision the
 * data doesn't have.
 */
export function releaseLabel(game: ReleaseLike, fallback = "Date TBA"): string {
  if (game.released) return formatDate(game.released);
  if (game.releaseWindow) return game.releaseWindow;
  return fallback;
}

export function releaseLabelLong(game: ReleaseLike, fallback = "Date to be announced"): string {
  if (game.released) return formatLongDate(game.released);
  if (game.releaseWindow) return game.releaseWindow;
  return fallback;
}

/** True when the title has not shipped: future-dated, windowed, or undated. */
export function isUnreleased(game: ReleaseLike, now: Date = new Date()): boolean {
  if (game.tba || game.releaseWindow) return true;
  if (!game.released) return true;
  return game.released > isoToday(now);
}

const isoToday = (now: Date) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;

/** "in 3 months" / "yesterday" / "2 years ago". */
export function relativeRelease(iso: string | null | undefined, now: Date = new Date()): string {
  const days = daysUntil(iso, now);
  if (days === null) return "TBA";
  if (days === 0) return "Out today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";

  const abs = Math.abs(days);
  const future = days > 0;
  let value: number;
  let unit: string;

  if (abs < 30) {
    value = abs;
    unit = "day";
  } else if (abs < 365) {
    value = Math.round(abs / 30);
    unit = "month";
  } else {
    value = Math.round((abs / 365) * 10) / 10;
    unit = "year";
  }

  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return future ? `in ${label}` : `${label} ago`;
}

/**
 * Relative phrasing that degrades gracefully: an imprecise window can't be
 * counted down to, so it is shown as-is rather than forced into "in N months".
 */
export function relativeReleaseLabel(game: ReleaseLike, now: Date = new Date()): string {
  if (game.released) return relativeRelease(game.released, now);
  if (game.releaseWindow) return game.releaseWindow;
  return "TBA";
}

/** 12400 → "12.4K". Used for library/rating counts. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}K`;
  }
  const v = n / 1_000_000;
  return `${v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}M`;
}

/** Metacritic's own banding: 75+ green, 50–74 yellow, below 50 red. */
export function scoreTier(score: number | null): "high" | "mid" | "low" | "none" {
  if (score === null || Number.isNaN(score)) return "none";
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

export function scoreColor(score: number | null): string {
  switch (scoreTier(score)) {
    case "high":
      return "var(--color-mint)";
    case "mid":
      return "var(--color-gold)";
    case "low":
      return "var(--color-flare)";
    default:
      return "var(--color-faint)";
  }
}

export function playtimeLabel(hours: number): string {
  if (!hours) return "—";
  return `${hours}h`;
}

/**
 * Deterministic 0–359 hue from a string. Drives the generated cover art, so the
 * same game always gets the same colours on server and client.
 */
export function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/** Up to two initials for generated cover art and avatars. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\w\s:]/g, "")
    .split(/[\s:]+/)
    .filter(Boolean)
    .filter((w) => !/^(the|of|a|an|and)$/i.test(w));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** The icon families the UI can actually render. */
export type PlatformKey =
  | "pc"
  | "playstation"
  | "xbox"
  | "nintendo"
  | "mac"
  | "linux"
  | "mobile"
  | "web";

/**
 * Maps any provider's platform vocabulary onto the small icon set the UI ships.
 *
 * Providers disagree wildly here — IGDB calls Windows "win", Steam reports a
 * boolean triple, and the sample catalogue mints family slugs directly. This
 * normalises all of them, and returns null for anything unrecognised so an
 * unknown platform is omitted rather than mislabelled.
 */
export function platformKey(slug: string): PlatformKey | null {
  const s = slug.toLowerCase().trim();
  if (!s) return null;

  if (s === "pc" || s === "win" || s.includes("windows")) return "pc";
  if (s === "mac" || s.includes("macos") || s.includes("macintosh")) return "mac";
  if (s === "linux") return "linux";
  if (s === "mobile" || s === "ios" || s === "android" || s.includes("iphone") || s.includes("ipad")) {
    return "mobile";
  }
  if (s === "web" || s === "browser") return "web";

  // Check the Sony console shorthands before the generic "ps" pattern.
  if (s.startsWith("psp") || s.startsWith("psvita") || s.startsWith("ps-vita")) return "playstation";
  if (s.includes("playstation") || /^ps[0-9]?(?:-|$)/.test(s)) return "playstation";

  if (s.includes("xbox") || s.includes("series-x")) return "xbox";

  if (
    s.includes("nintendo") ||
    s.includes("switch") ||
    s.includes("wii") ||
    s.includes("gamecube") ||
    s.includes("game-boy") ||
    s.includes("3ds") ||
    ["nes", "snes", "n64", "gba", "ngc", "nds"].includes(s)
  ) {
    return "nintendo";
  }

  return null;
}

/** Collapses a platform list to unique icon keys, preserving order. */
export function platformKeys(platforms: { slug: string }[]): PlatformKey[] {
  const seen = new Set<PlatformKey>();
  for (const p of platforms) {
    const key = platformKey(p.slug);
    if (key) seen.add(key);
  }
  return [...seen];
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}
