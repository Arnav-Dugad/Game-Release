/**
 * The single data entry point for the whole app.
 *
 * Pages call these functions and never touch a provider directly. Every result
 * is real, live data — there is no bundled placeholder catalogue. Each request
 * walks the provider chain in priority order and takes the first usable answer:
 *
 *   IGDB   — best coverage (every platform, covers, trailers, critic scores).
 *            Needs free Twitch credentials.
 *   Steam  — no credentials at all, so a fresh deploy still shows live data.
 *            PC-only, and browsing is limited to the storefront's own shelves.
 *
 * Steam also acts as a genuine fallback when IGDB is configured but a
 * particular request fails — a transient IGDB outage degrades to Steam's live
 * catalogue rather than to nothing.
 *
 * A provider returning null means "I can't answer this", never "no results" —
 * an empty-but-successful page is returned as an empty `Page`, which stops the
 * chain. That distinction is what keeps a legitimate "no matches" from being
 * mistaken for an outage. If every configured provider genuinely fails, the
 * result is labelled `"unavailable"` so the UI can say so honestly rather than
 * inventing something to show.
 *
 * Every result carries the provider that produced it, so the UI can attribute
 * the data and surface an outage state truthfully.
 */

import {
  igdbProvider,
  igdbSpotlight,
  igdbSteamCharts,
  igdbTotalGames,
  type SteamChart,
} from "./providers/igdb";
import { enrichWithSteam, steamProvider } from "./providers/steam";
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

/**
 * Which providers answer list and detail queries.
 *
 * When IGDB is configured it is the *only* browsing source. Steam is
 * deliberately not a fallback for a failing IGDB: its catalogue is the
 * storefront's own promotional shelves, so silently substituting it turns the
 * whole site into a list of whatever Steam is currently pushing — which reads
 * as a broken product rather than as the outage it actually is. Letting IGDB
 * failures surface as an honest "unavailable" state makes them diagnosable
 * instead of invisible.
 *
 * Steam is still used for the two things IGDB genuinely lacks — live pricing
 * and system requirements — via `enrichWithSteam` on the detail page.
 *
 * Steam only becomes a browsing source when IGDB has no credentials at all,
 * which is a local-development convenience rather than a production path.
 */
function activeChain(): GameProvider[] {
  if (igdbProvider.isConfigured()) return [igdbProvider];
  return [steamProvider];
}

/**
 * Last-resort providers, tried only after every preferred one has failed.
 *
 * `isConfigured()` can only check that credentials are *present*, not that they
 * still work — a rotated Twitch secret leaves IGDB configured but rejecting
 * every request. Without this, that single failure mode empties the entire
 * site. Steam is a poor substitute for IGDB's catalogue, so it never competes
 * for a request that IGDB can serve; it exists here purely so a total IGDB
 * outage degrades to a smaller live catalogue instead of to nothing.
 *
 * This is not silent: every result carries the provider that produced it, and
 * `SourceAttribution` renders it, so a page served from the fallback says so.
 */
function fallbackChain(): GameProvider[] {
  return igdbProvider.isConfigured() ? [steamProvider] : [];
}

/**
 * Runs `attempt` against each configured provider until one returns non-null.
 * A provider that throws is treated as unavailable rather than fatal.
 */
async function resolve<T>(
  operation: string,
  attempt: (provider: GameProvider) => Promise<T | null>,
): Promise<Sourced<T> | null> {
  for (const provider of [...activeChain(), ...fallbackChain()]) {
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

/** Fallback for when every configured provider failed outright. */
const UNAVAILABLE: DataSource = "unavailable";

/* ---------------------------------------------------------------------------
 * Public queries
 * ------------------------------------------------------------------------ */

/** Which provider would answer right now, without performing a request. */
export function dataMode(): DataSource {
  return activeChain()[0]?.id ?? UNAVAILABLE;
}

/**
 * True when a result came from the fallback rather than the intended source.
 *
 * IGDB being configured but a page arriving from Steam means the credentials
 * are present and failing — the exact state that once turned the whole site
 * into a list of Steam promotions with no explanation. Surfacing it lets the
 * UI say so plainly instead of leaving the reader to wonder why the catalogue
 * looks wrong.
 */
export function isDegraded(source: DataSource): boolean {
  return source === "steam" && igdbProvider.isConfigured();
}

export async function browseGames(filters: BrowseFilters): Promise<Sourced<Page<GameSummary>>> {
  const result = await resolve("browse", (provider) => provider.browse(filters));
  return result ?? { data: emptyPage(filters.page ?? 1), source: UNAVAILABLE };
}

export async function getUpcoming(
  pageSize = 24,
  page = 1,
  filters: BrowseFilters = {},
): Promise<Sourced<Page<GameSummary>>> {
  const result = await resolve("upcoming", (provider) =>
    provider.upcoming(pageSize, page, filters),
  );
  return result ?? { data: emptyPage(page), source: UNAVAILABLE };
}

/**
 * The homepage hero shelf.
 *
 * Deliberately bypasses the provider chain: this is IGDB or nothing. The hero
 * autoplays trailers over key art, and Steam list queries carry neither, so a
 * chain fallback here would silently turn the site's front door into a row of
 * static PC capsules. An empty hero is the honest outcome, and the page below
 * it still fills from the chain as usual.
 */
export async function getSpotlight(limit = 6): Promise<Sourced<GameSummary[]>> {
  const data = await igdbSpotlight(limit);
  return data && data.length > 0
    ? { data, source: "igdb" }
    : { data: [], source: UNAVAILABLE };
}

/**
 * Steam's own charts — most played, top sellers, most wishlisted.
 *
 * Sourced from IGDB rather than Steam directly, which sounds backwards until
 * you look at what Steam actually exposes: there is no public "top games"
 * query, only the storefront's curated promotional shelves. IGDB ingests the
 * real charts from Steam and republishes them, so this is the only route to a
 * genuine Steam-wide ranking.
 */
export async function getSteamCharts(perChart = 12): Promise<Sourced<SteamChart[]>> {
  const data = await igdbSteamCharts(perChart);
  return data && data.length > 0
    ? { data, source: "igdb" }
    : { data: [], source: UNAVAILABLE };
}

export async function getTrending(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("trending", (provider) => provider.trending(pageSize));
  return result ?? { data: [], source: UNAVAILABLE };
}

export async function getTopRated(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("topRated", (provider) => provider.topRated(pageSize));
  return result ?? { data: [], source: UNAVAILABLE };
}

export async function getNewReleases(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const result = await resolve("newReleases", (provider) => provider.newReleases(pageSize));
  return result ?? { data: [], source: UNAVAILABLE };
}

/**
 * Detail lookup.
 *
 * Slugs are provider-specific — IGDB uses its own, Steam encodes an appid — so
 * a miss in the active provider legitimately falls through to the next. That
 * also keeps older bookmarked URLs working after credentials are added.
 */
export async function getGame(
  slug: string,
  /** Steam country code, so prices render in the reader's currency. */
  region?: string,
): Promise<Sourced<GameDetail> | null> {
  const result = await resolve("detail", (provider) => provider.detail(slug));
  if (!result) return null;

  // Providers are merged, not just chained. IGDB knows every platform and has
  // the better artwork and critic scores; Steam knows the current price and the
  // system requirements. When IGDB tells us a title has a Steam listing, both
  // are worth having.
  if (result.source === "igdb" && result.data.steamAppId) {
    try {
      return { ...result, data: await enrichWithSteam(result.data, region) };
    } catch (err) {
      console.warn(
        "[source] steam enrichment failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}

/**
 * Related titles.
 *
 * `preferred` should be the source that produced the game being viewed, so the
 * rail is drawn from the same catalogue as the page around it. Without that,
 * clicking into a related title could jump between providers mid-journey.
 */
export async function getRelated(
  game: GameDetail,
  preferred?: DataSource,
  limit = 8,
): Promise<GameSummary[]> {
  const chain = [...activeChain(), ...fallbackChain()];
  const ordered = preferred
    ? chain.sort((a, b) => (a.id === preferred ? -1 : b.id === preferred ? 1 : 0))
    : chain;

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
  return result ?? { data: [], source: UNAVAILABLE };
}

export async function getPlatforms(): Promise<Sourced<Ref[]>> {
  const result = await resolve("platforms", async (provider) => {
    const platforms = await provider.platforms();
    return platforms && platforms.length > 0 ? platforms : null;
  });
  return result ?? { data: [], source: UNAVAILABLE };
}

/**
 * How many games the active database holds.
 *
 * Only IGDB can answer this honestly — Steam has no "total catalogue size"
 * concept, only a curated storefront pool. Returns null rather than a
 * misleading number when it can't be known; callers should hide the stat
 * entirely in that case rather than show a fabricated figure.
 */
export async function getTotalGames(): Promise<number | null> {
  const total = await igdbTotalGames();
  return total && total > 0 ? total : null;
}

/**
 * Slugs worth pre-rendering at build time: whatever is currently trending,
 * top rated, and at the front of the release calendar.
 *
 * Best-effort by design — every query it depends on already degrades to an
 * empty result rather than throwing, so an unreachable provider during the
 * build simply means fewer pages are pre-rendered. `dynamicParams` still
 * serves anything else on demand and caches it via ISR.
 */
export async function popularSlugs(limit = 60): Promise<string[]> {
  const [trending, topRated, upcoming] = await Promise.all([
    getTrending(30),
    getTopRated(30),
    getUpcoming(30),
  ]);

  const slugs = [
    ...trending.data.map((game) => game.slug),
    ...topRated.data.map((game) => game.slug),
    ...upcoming.data.results.map((game) => game.slug),
  ];

  return [...new Set(slugs)].slice(0, limit);
}

/** ISO `YYYY-MM-DD` for today, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
