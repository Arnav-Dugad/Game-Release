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
  extraCopies: number;
  followedGames: number;
  subscriptionGames: number;
  subscriptionAccesses: number;
  accessibleGames: number;
  unplayedOwned: number;
  upcomingFollowed: number;
  wanted: number;
  playing: number;
  played: number;
  completionRate: number;
  completedHours: number;
  backlogHours: number;
  averageCritic: number | null;
  highScorers: number;
  completedLast90Days: number;
  collectionAgeDays: number;
  platforms: RankedStat[];
  subscriptions: RankedStat[];
  playedPlatforms: RankedStat[];
  genres: RankedStat[];
  decades: RankedStat[];
  scoreBands: RankedStat[];
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
      merged.set(entry.gameId, {
        ...entry,
        ownedOn: [...new Set(entry.ownedOn ?? [])],
        subscriptionAccess: [...new Map((entry.subscriptionAccess ?? []).map((item) => [`${item.service}:${item.platform}`, item])).values()],
      });
      continue;
    }
    const newer = entry.addedAt >= previous.addedAt ? entry : previous;
    merged.set(entry.gameId, {
      ...newer,
      ownedOn: [...new Set([...(previous.ownedOn ?? []), ...(entry.ownedOn ?? [])])],
      subscriptionAccess: [...new Map([...(previous.subscriptionAccess ?? []), ...(entry.subscriptionAccess ?? [])].map((item) => [`${item.service}:${item.platform}`, item])).values()],
      followedReleases: [...new Map([...(previous.followedReleases ?? []), ...(entry.followedReleases ?? [])].map((item) => [item.gameId, item])).values()],
      following: previous.following || entry.following,
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
  const subscriptionCounts = new Map<string, number>();
  const playedPlatformCounts = new Map<string, number>();
  const genreCounts = new Map<number, number>();
  const decadeCounts = new Map<string, number>();
  const scoreBandCounts = new Map<string, number>();
  const genreNames = new Map(genreDirectory.map((genre) => [genre.id, genre.name]));
  let platformCopies = 0;
  let completedHours = 0;
  let backlogHours = 0;
  let criticTotal = 0;
  let criticCount = 0;
  let subscriptionAccesses = 0;

  for (const game of games) {
    status[game.status]++;
    const owned = [...new Set(game.ownedOn ?? [])];
    platformCopies += owned.length;
    for (const platform of owned) platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    for (const access of game.subscriptionAccess ?? []) {
      subscriptionAccesses++;
      subscriptionCounts.set(access.service, (subscriptionCounts.get(access.service) ?? 0) + 1);
      playedPlatformCounts.set(access.platform, (playedPlatformCounts.get(access.platform) ?? 0) + 1);
    }
    if (game.platform) playedPlatformCounts.set(game.platform, (playedPlatformCounts.get(game.platform) ?? 0) + 1);
    for (const genre of game.genres ?? []) genreNames.set(genre.id, genre.name);
    for (const genreId of new Set(game.genreIds ?? [])) genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + 1);
    if (game.metacritic !== null) {
      criticTotal += game.metacritic;
      criticCount++;
      const band = game.metacritic >= 90 ? "90–100" : game.metacritic >= 80 ? "80–89" : game.metacritic >= 70 ? "70–79" : "Below 70";
      scoreBandCounts.set(band, (scoreBandCounts.get(band) ?? 0) + 1);
    }
    if (game.released) {
      const year = Number(game.released.slice(0, 4));
      if (Number.isFinite(year)) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
      }
    }
    const hours = Math.max(0, game.playtime ?? 0);
    if (game.status === "played") completedHours += hours;
    else backlogHours += hours;
  }

  const now = new Date();
  const timeline: TimelineStat[] = [];
  for (let offset = 11; offset >= 0; offset--) {
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
    extraCopies: Math.max(0, platformCopies - games.filter((game) => (game.ownedOn ?? []).length > 0).length),
    followedGames: games.filter((game) => game.following).length,
    subscriptionGames: games.filter((game) => (game.subscriptionAccess ?? []).length > 0).length,
    subscriptionAccesses,
    accessibleGames: games.filter((game) => (game.ownedOn ?? []).length > 0 || (game.subscriptionAccess ?? []).length > 0).length,
    unplayedOwned: games.filter((game) => (game.ownedOn ?? []).length > 0 && game.status !== "played").length,
    upcomingFollowed: games.filter((game) => game.following && game.released && Date.parse(game.released) > Date.now()).length,
    wanted: status.want,
    playing: status.playing,
    played: status.played,
    completionRate: games.length ? Math.round((status.played / games.length) * 100) : 0,
    completedHours,
    backlogHours,
    averageCritic: criticCount ? Math.round(criticTotal / criticCount) : null,
    highScorers: games.filter((game) => (game.metacritic ?? 0) >= 85).length,
    completedLast90Days: games.filter((game) => game.finishedAt && game.finishedAt >= Date.now() - 90 * 86_400_000).length,
    collectionAgeDays: games.length ? Math.max(0, Math.floor((Date.now() - Math.min(...games.map((game) => game.addedAt))) / 86_400_000)) : 0,
    platforms: rank(platformCounts),
    subscriptions: rank(subscriptionCounts),
    playedPlatforms: rank(playedPlatformCounts),
    genres: [...genreCounts]
      .map(([id, value]) => ({ key: String(id), label: genreNames.get(id) ?? "Unclassified", value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    decades: rank(decadeCounts),
    scoreBands: ["90–100", "80–89", "70–79", "Below 70"].flatMap((label) => {
      const value = scoreBandCounts.get(label) ?? 0;
      return value ? [{ key: label, label, value }] : [];
    }),
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
