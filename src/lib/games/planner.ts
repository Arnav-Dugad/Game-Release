import type { WatchlistEntry } from "@/lib/firebase/db";
import { canonicalEntryHref } from "@/lib/notifications/model";

const DAY_MS = 86_400_000;
export const DEFAULT_WEEKLY_HOURS = 12;
export const FALLBACK_GAME_HOURS = 12;

export interface PlannedGame extends WatchlistEntry {
  planningHours: number;
  hoursAreEstimated: boolean;
}

export interface ReleaseConflict {
  weekStart: string;
  weekEnd: string;
  entries: PlannedGame[];
  hours: number;
  severity: "collision" | "crunch";
}

export interface ReleaseMonth {
  key: string;
  label: string;
  entries: PlannedGame[];
}

export interface PlannerSnapshot {
  upcoming: PlannedGame[];
  months: ReleaseMonth[];
  releaseWindows: PlannedGame[];
  undated: PlannedGame[];
  conflicts: ReleaseConflict[];
  nextRelease: PlannedGame | null;
  nextPlay: PlannedGame | null;
  backlogHours: number;
  estimatedBacklogCount: number;
  weeksToClear: number;
  releasesIn30Days: number;
  weeklyHours: number;
}

function utcToday(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function dateValue(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function isExactIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dateValue(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function addDays(iso: string, days: number): string {
  return new Date(dateValue(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const date = new Date(dateValue(iso));
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(iso, -offset);
}

function planningHours(entry: WatchlistEntry): number {
  return typeof entry.playtime === "number" && Number.isFinite(entry.playtime) && entry.playtime > 0
    ? Math.max(1, Math.round(entry.playtime))
    : FALLBACK_GAME_HOURS;
}

function planned(entry: WatchlistEntry): PlannedGame {
  return {
    ...entry,
    planningHours: planningHours(entry),
    hoursAreEstimated: !(typeof entry.playtime === "number" && entry.playtime > 0),
  };
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));
}

function nextPlay(entries: PlannedGame[], today: string): PlannedGame | null {
  const playing = entries
    .filter((entry) => entry.status === "playing")
    .sort((a, b) => (b.startedAt ?? b.addedAt) - (a.startedAt ?? a.addedAt));
  if (playing[0]) return playing[0];

  return (
    entries
      .filter((entry) => entry.status === "want" && Boolean(entry.released) && entry.released! <= today)
      .sort((a, b) => {
        const owned = Number((b.ownedOn?.length ?? 0) > 0) - Number((a.ownedOn?.length ?? 0) > 0);
        return owned || (b.metacritic ?? -1) - (a.metacritic ?? -1) || b.addedAt - a.addedAt;
      })[0] ?? null
  );
}

/**
 * Turns a watchlist into an honest personal schedule. Imprecise release
 * windows never masquerade as exact dates, and missing completion times are
 * explicitly marked as planning estimates.
 */
export function buildPlannerSnapshot(
  entries: WatchlistEntry[],
  weeklyHours = DEFAULT_WEEKLY_HOURS,
  now = Date.now(),
): PlannerSnapshot {
  const requestedCapacity = Number.isFinite(weeklyHours) ? weeklyHours : DEFAULT_WEEKLY_HOURS;
  const capacity = Math.min(60, Math.max(1, Math.round(requestedCapacity)));
  const today = utcToday(now);
  const active = entries.filter((entry) => entry.status !== "played").map(planned);
  const upcoming = active
    .filter((entry) => isExactIsoDate(entry.released) && entry.released >= today)
    .sort((a, b) => a.released!.localeCompare(b.released!) || a.name.localeCompare(b.name));
  const releaseWindows = active
    .filter((entry) => !entry.released && Boolean(entry.releaseWindow))
    .sort((a, b) => entryWindow(a).localeCompare(entryWindow(b)) || a.name.localeCompare(b.name));
  const undated = active
    .filter((entry) => !entry.released && !entry.releaseWindow)
    .sort((a, b) => b.addedAt - a.addedAt);

  const groupedMonths = new Map<string, PlannedGame[]>();
  for (const entry of upcoming) {
    const key = entry.released!.slice(0, 7);
    groupedMonths.set(key, [...(groupedMonths.get(key) ?? []), entry]);
  }
  const months = [...groupedMonths.entries()].map(([key, monthEntries]) => ({
    key,
    label: monthLabel(key),
    entries: monthEntries,
  }));

  const groupedWeeks = new Map<string, PlannedGame[]>();
  for (const entry of upcoming) {
    const week = mondayOf(entry.released!);
    groupedWeeks.set(week, [...(groupedWeeks.get(week) ?? []), entry]);
  }
  const conflicts = [...groupedWeeks.entries()]
    .filter(([, weekEntries]) => weekEntries.length > 1)
    .map(([weekStart, weekEntries]) => {
      const hours = weekEntries.reduce((sum, entry) => sum + entry.planningHours, 0);
      return {
        weekStart,
        weekEnd: addDays(weekStart, 6),
        entries: weekEntries,
        hours,
        severity: hours > capacity || weekEntries.length >= 3 ? "crunch" as const : "collision" as const,
      };
    });

  const backlog = active.filter(
    (entry) => entry.status === "playing" || (entry.status === "want" && Boolean(entry.released) && entry.released! <= today),
  );
  const backlogHours = backlog.reduce((sum, entry) => sum + entry.planningHours, 0);

  return {
    upcoming,
    months,
    releaseWindows,
    undated,
    conflicts,
    nextRelease: upcoming[0] ?? null,
    nextPlay: nextPlay(active, today),
    backlogHours,
    estimatedBacklogCount: backlog.filter((entry) => entry.hoursAreEstimated).length,
    weeksToClear: backlogHours === 0 ? 0 : Math.ceil(backlogHours / capacity),
    releasesIn30Days: upcoming.filter((entry) => dateValue(entry.released!) - dateValue(today) <= 30 * DAY_MS).length,
    weeklyHours: capacity,
  };
}

function entryWindow(entry: Pick<WatchlistEntry, "releaseWindow">): string {
  return entry.releaseWindow ?? "";
}

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function compactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

/** Builds private, date-only calendar events without sending watchlist data anywhere. */
export function buildPlannerIcs(
  entries: WatchlistEntry[],
  origin = "https://ludex.games",
  now = Date.now(),
): string {
  const today = utcToday(now);
  const events = entries
    .filter((entry) => entry.status !== "played" && isExactIsoDate(entry.released) && entry.released >= today)
    .sort((a, b) => a.released!.localeCompare(b.released!) || a.name.localeCompare(b.name))
    .map((entry) => {
      const href = `${origin.replace(/\/$/, "")}${canonicalEntryHref(entry)}`;
      return [
        "BEGIN:VEVENT",
        `UID:${entry.gameId}-${entry.released}@ludex.games`,
        `DTSTAMP:${compactDate(today)}T000000Z`,
        `DTSTART;VALUE=DATE:${compactDate(entry.released!)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(entry.released!, 1))}`,
        `SUMMARY:${escapeIcs(`${entry.name} releases`)}`,
        `DESCRIPTION:${escapeIcs("Tracked in your LUDEX release planner.")}`,
        `URL:${escapeIcs(href)}`,
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LUDEX//Release Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:LUDEX release plan",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
