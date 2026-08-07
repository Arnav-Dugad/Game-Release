/**
 * The single data entry point for the whole app.
 *
 * Pages call these functions and never touch a provider directly. Each request
 * walks the provider chain in priority order and takes the first usable answer:
 *
 *   IGDB   — best coverage (every platform, covers, trailers, critic scores).
 *            Needs free Twitch credentials.
 *   Steam  — no credentials at all, so a fresh deploy still shows live data.
 *            PC-only, and browsing is limited to the storefront's own shelves.
 *   Sample — bundled catalogue. No network. Always succeeds.
 *
 * A provider returning null means "I can't answer this", never "no results" —
 * an empty-but-successful page is returned as an empty `Page`, which stops the
 * chain. That distinction is what keeps a legitimate "no matches" from silently
 * falling through to sample data.
 *
 * Every result carries the provider that produced it, so the UI can attribute
 * the data and label sample mode honestly.
 */

import { igdbProvider } from "./providers/igdb";
import { steamProvider } from "./providers/steam";
import { sampleProvider } from "./providers/sample";
import type { GameProvider } from "./providers/types";
import type {
  BrowseFilters,
  DataSource,
  GameDetail,
  GameSummary,
  Page,
  Ref,
  Sourced,
} from "./types";
import { SAMPLE_GAMES } from "./catalogue";

/** Priority order. Steam sits above sample so zero-config deploys get live data. */
const CHAIN: GameProvider[] = [igdbProvider, steamProvider, sampleProvider];

function activeChain(): GameProvider[] {
  return CHAIN.filter((provider) => provider.isConfigured());
}

/**
 * Runs `attempt` against each configured provider until one returns non-null.
 * A provider that throws is treated as unavailable rather than fatal.
 */
async function resolve<T>(
  operation: string,
  attempt: (provider: GameProvider) => Promise<T | null>,
): Promise<Sourced<T> | null> {
  for (const provider of activeChain()) {
    try {
      const data = await attempt(provider);
      if (data !== null && data !== undefined) {
        return { data, source: provider.id };
      }
    } catch (err) {
      console.warn(
        `[source] ${provider.id}.${operation} threw:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return null;
}

/** A list result that is present but empty still counts as an answer. */
const emptyPage = (page: number): Page<GameSummary> => ({
  results: [],
  count: 0,
  hasNext: false,
  page,
});

/* ---------------------------------------------------------------------------
 * Public queries
 * ------------------------------------------------------------------------ */

/** Which provider would answer right now, without performing a request. */
export function dataMode(): DataSource {
  return activeChain()[0]?.id ?? "sample";
}

export async function browseGames(filters: BrowseFilters): Promise<Sourced<Page<GameSummary>>> {
  const result = await resolve("browse", (provider) => provider.browse(filters));
  return result ?? { data: emptyPage(filters.page ?? 1), source: "sample" };
}

export async function getUpcoming(pageSize = 24, page = 1): Promise<Sourced<Page<GameSummary>>> {
  const result = await resolve("upcoming", (provider) => provider.upcoming(pageSize, page));
  return result ?? { data: emptyPage(page), source: "sample" };
}

export async function getTrending(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("trending", (provider) => provider.trending(pageSize));
  return result ?? { data: [], source: "sample" };
}

export async function getTopRated(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("topRated", (provider) => provider.topRated(pageSize));
  return result ?? { data: [], source: "sample" };
}

export async function getNewReleases(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("newReleases", (provider) => provider.newReleases(pageSize));
  return result ?? { data: [], source: "sample" };
}

/**
 * Detail lookup.
 *
 * Slugs are provider-specific — IGDB uses its own, Steam encodes an appid — so
 * a miss in the active provider legitimately falls through to the next. That
 * also keeps older bookmarked URLs working after credentials are added.
 */
export async function getGame(slug: string): Promise<Sourced<GameDetail> | null> {
  return resolve("detail", (provider) => provider.detail(slug));
}

/**
 * Related titles.
 *
 * `preferred` should be the source that produced the game being viewed, so the
 * rail is drawn from the same catalogue as the page around it. Without that,
 * a sample-backed detail page could show live related games (or vice versa),
 * and clicking one would jump between datasets mid-journey.
 */
export async function getRelated(
  game: GameDetail,
  preferred?: DataSource,
  limit = 8,
): Promise<GameSummary[]> {
  const ordered = preferred
    ? [...activeChain()].sort((a, b) =>
        a.id === preferred ? -1 : b.id === preferred ? 1 : 0,
      )
    : activeChain();

  for (const provider of ordered) {
    try {
      const related = await provider.related(game, limit);
      // An empty list is a weak answer; let the next provider try before
      // giving up on the rail entirely.
      if (related && related.length > 0) return related;
    } catch (err) {
      console.warn(
        `[source] ${provider.id}.related threw:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return [];
}

export async function searchGames(query: string, pageSize = 24, page = 1) {
  return browseGames({ search: query, pageSize, page });
}

export async function getGenres(): Promise<Sourced<Ref[]>> {
  const result = await resolve("genres", async (provider) => {
    const genres = await provider.genres();
    return genres && genres.length > 0 ? genres : null;
  });
  return result ?? { data: [], source: "sample" };
}

export async function getPlatforms(): Promise<Sourced<Ref[]>> {
  const result = await resolve("platforms", async (provider) => {
    const platforms = await provider.platforms();
    return platforms && platforms.length > 0 ? platforms : null;
  });
  return result ?? { data: [], source: "sample" };
}

/**
 * Slugs pre-rendered at build time.
 *
 * Only the bundled catalogue is enumerated: live provider slugs are discovered
 * at request time and cached by ISR, and pre-rendering a live catalogue would
 * mean thousands of build-time API calls for pages nobody has asked for.
 */
export function sampleSlugs(): string[] {
  return SAMPLE_GAMES.map((game) => game.slug);
}

/** ISO `YYYY-MM-DD` for today, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
