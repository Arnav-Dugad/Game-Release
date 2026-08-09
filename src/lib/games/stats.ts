import type { WatchlistEntry, WatchStatus } from "@/lib/firebase/db";
import type { Ref } from "./types";

export interface RankedStat {
  key: string;
  label: string;
  value: number;
}

export interface TimelineStat {
  key: string;
  label: string;
  added: number;
  completed: number;
}

export interface LibraryStats {
  games: WatchlistEntry[];
  uniqueGames: number;
  ownedGames: number;
  platformCopies: number;
  wanted: number;
  playing: number;
  played: number;
  completionRate: number;
  completedHours: number;
  backlogHours: number;
  averageCritic: number | null;
  platforms: RankedStat[];
  genres: RankedStat[];
  timeline: TimelineStat[];
  earliestAddedAt: number | null;
}

/**
 * Firestore normally guarantees one document per game id. The extra merge is
 * intentional defence against imported legacy data and makes every headline
 * metric game-based: owning Steam + PlayStation copies still counts as one
 * owned game, while `platformCopies` remains available as a separate fact.
 */
export function dedupeLibrary(entries: WatchlistEntry[]): WatchlistEntry[] {
  const merged = new Map<number, WatchlistEntry>();
  for (const entry of entries) {
    const previous = merged.get(entry.gameId);
    if (!previous) {
      merged.set(entry.gameId, { ...entry, ownedOn: [...new Set(entry.ownedOn ?? [])] });
      continue;
    }
    const newer = entry.addedAt >= previous.addedAt ? entry : previous;
    merged.set(entry.gameId, {
      ...newer,
      ownedOn: [...new Set([...(previous.ownedOn ?? []), ...(entry.ownedOn ?? [])])],
      genreIds: [...new Set([...(previous.genreIds ?? []), ...(entry.genreIds ?? [])])],
      genres: [...(previous.genres ?? []), ...(entry.genres ?? [])].filter(
        (genre, index, all) => all.findIndex((candidate) => candidate.id === genre.id) === index,
      ),
      startedAt: previous.startedAt ?? entry.startedAt,
      finishedAt: previous.finishedAt ?? entry.finishedAt,
      addedAt: Math.min(previous.addedAt, entry.addedAt),
    });
  }
  return [...merged.values()].sort((a, b) => b.addedAt - a.addedAt);
}

export function buildLibraryStats(entries: WatchlistEntry[], genreDirectory: Ref[] = []): LibraryStats {
  const games = dedupeLibrary(entries);
  const status = { want: 0, playing: 0, played: 0 } satisfies Record<WatchStatus, number>;
  const platformCounts = new Map<string, number>();
  const genreCounts = new Map<number, number>();
  const genreNames = new Map(genreDirectory.map((genre) => [genre.id, genre.name]));
  let platformCopies = 0;
  let completedHours = 0;
  let backlogHours = 0;
  let criticTotal = 0;
  let criticCount = 0;

  for (const game of games) {
    status[game.status]++;
    const owned = [...new Set(game.ownedOn ?? [])];
    platformCopies += owned.length;
    for (const platform of owned) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    for (const genre of game.genres ?? []) genreNames.set(genre.id, genre.name);
    for (const genreId of new Set(game.genreIds ?? [])) genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + 1);
    if (game.metacritic !== null) {
      criticTotal += game.metacritic;
      criticCount++;
    }
    const hours = Math.max(0, game.playtime ?? 0);
    if (game.status === "played") completedHours += hours;
    else backlogHours += hours;
  }

  const now = new Date();
  const timeline: TimelineStat[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = date.toISOString().slice(0, 7);
    timeline.push({
      key,
      label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date),
      added: games.filter((game) => monthKey(game.addedAt) === key).length,
      completed: games.filter((game) => game.finishedAt && monthKey(game.finishedAt) === key).length,
    });
  }

  const rank = (items: Map<string, number>): RankedStat[] => [...items]
    .map(([key, value]) => ({ key, label: humanise(key), value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  return {
    games,
    uniqueGames: games.length,
    ownedGames: games.filter((game) => (game.ownedOn ?? []).length > 0).length,
    platformCopies,
    wanted: status.want,
    playing: status.playing,
    played: status.played,
    completionRate: games.length ? Math.round((status.played / games.length) * 100) : 0,
    completedHours,
    backlogHours,
    averageCritic: criticCount ? Math.round(criticTotal / criticCount) : null,
    platforms: rank(platformCounts),
    genres: [...genreCounts]
      .map(([id, value]) => ({ key: String(id), label: genreNames.get(id) ?? "Unclassified", value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    timeline,
    earliestAddedAt: games.length ? Math.min(...games.map((game) => game.addedAt)) : null,
  };
}

function monthKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 7);
}

function humanise(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
