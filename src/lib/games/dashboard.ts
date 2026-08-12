import type { WatchlistEntry } from "@/lib/firebase/db";
import { releaseState, releaseWindowInfo } from "./release-state";

const DAY = 86_400_000;

export interface DashboardSnapshot {
  focus: WatchlistEntry | null;
  nextRelease: WatchlistEntry | null;
  upcoming: WatchlistEntry[];
  owned: number;
  playing: number;
  played: number;
  wanted: number;
  releasesSoon: number;
}

function signalTime(entry: WatchlistEntry): number {
  return entry.startedAt ?? entry.finishedAt ?? entry.addedAt;
}

/** Pure, deterministic summary used by the personalized homepage. */
export function buildDashboardSnapshot(
  entries: WatchlistEntry[],
  now = Date.now(),
): DashboardSnapshot {
  const upcoming = entries
    .filter((entry) => releaseState(entry, new Date(now)) === "upcoming")
    .sort((a, b) => {
      const aSignal = a.released ?? releaseWindowInfo(a.releaseWindow)?.start ?? "9999";
      const bSignal = b.released ?? releaseWindowInfo(b.releaseWindow)?.start ?? "9999";
      return aSignal.localeCompare(bSignal) || a.name.localeCompare(b.name);
    });

  const byRecency = (status: WatchlistEntry["status"]) => entries
    .filter((entry) => entry.status === status)
    .sort((a, b) => signalTime(b) - signalTime(a));
  const playing = byRecency("playing");
  const wanted = byRecency("want");
  const played = byRecency("played");

  return {
    focus: playing[0] ?? wanted[0] ?? played[0]
      ?? [...entries].sort((a, b) => b.addedAt - a.addedAt)[0]
      ?? null,
    nextRelease: upcoming.find((entry) => Boolean(entry.released)) ?? null,
    upcoming,
    owned: entries.filter((entry) => (entry.ownedOn ?? []).length > 0).length,
    playing: playing.length,
    played: played.length,
    wanted: wanted.length,
    releasesSoon: upcoming.filter((entry) => {
      const days = daysUntilRelease(entry.released, now);
      return days >= 0 && days <= 30;
    }).length,
  };
}

export function daysUntilRelease(released: string | null, now = Date.now()): number {
  if (!released) return Number.POSITIVE_INFINITY;
  const today = new Date(now).toISOString().slice(0, 10);
  const target = Date.parse(`${released}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(start)) return Number.POSITIVE_INFINITY;
  return Math.round((target - start) / DAY);
}
