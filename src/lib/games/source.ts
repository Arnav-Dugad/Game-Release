/**
 * The single data entry point for the whole app.
 *
 * Every page calls these functions and never touches RAWG or the catalogue
 * directly. Each returns a `Sourced<T>` so the UI can honestly badge whether it
 * is showing live data or the bundled sample catalogue.
 *
 * Resolution order is always: try RAWG (if a key exists) → on null, fall back to
 * the catalogue. That means a missing key, a rate limit and an outage all
 * degrade to the same well-defined state.
 */

import {
  hasRawgKey,
  rawgBrowse,
  rawgDetail,
  rawgGenres,
  rawgPlatforms,
  rawgSeries,
} from "./rawg";
import {
  SAMPLE_BY_SLUG,
  SAMPLE_GAMES,
  SAMPLE_GENRES,
  SAMPLE_PLATFORMS,
  toSummary,
} from "./catalogue";
import type {
  BrowseFilters,
  DataSource,
  GameDetail,
  GameSummary,
  Page,
  Ref,
  SortKey,
  Sourced,
} from "./types";

/* ---------------------------------------------------------------------------
 * Date helpers
 * ------------------------------------------------------------------------ */

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shift(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

const today = () => isoDate(new Date());

/* ---------------------------------------------------------------------------
 * Sample-mode query engine
 *
 * Mirrors the subset of RAWG's query semantics the UI actually uses, so both
 * modes behave identically from a component's point of view.
 * ------------------------------------------------------------------------ */

function sampleSort(list: GameSummary[], ordering: SortKey | undefined): GameSummary[] {
  const out = [...list];
  const byDate = (g: GameSummary) => (g.released ? Date.parse(g.released) : Number.NaN);

  switch (ordering) {
    case "released":
      // Ascending, with undated titles pushed to the end rather than sorted as 0.
      return out.sort((a, b) => {
        const [x, y] = [byDate(a), byDate(b)];
        if (Number.isNaN(x) && Number.isNaN(y)) return b.added - a.added;
        if (Number.isNaN(x)) return 1;
        if (Number.isNaN(y)) return -1;
        return x - y;
      });
    case "-released":
      return out.sort((a, b) => {
        const [x, y] = [byDate(a), byDate(b)];
        if (Number.isNaN(x) && Number.isNaN(y)) return b.added - a.added;
        if (Number.isNaN(x)) return 1;
        if (Number.isNaN(y)) return -1;
        return y - x;
      });
    case "-rating":
      return out.sort((a, b) => b.rating - a.rating || b.added - a.added);
    case "-metacritic":
      return out.sort((a, b) => (b.metacritic ?? 0) - (a.metacritic ?? 0) || b.added - a.added);
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "-added":
    default:
      return out.sort((a, b) => b.added - a.added);
  }
}

function sampleFilter(filters: BrowseFilters): GameSummary[] {
  let list = SAMPLE_GAMES.map(toSummary);

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    const terms = q.split(/\s+/);
    list = list.filter((g) => {
      const haystack = `${g.name} ${g.genres.map((x) => x.name).join(" ")}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
    // Prefix matches on the title are far more likely to be what was meant.
    list.sort((a, b) => {
      const rank = (g: GameSummary) => (g.name.toLowerCase().startsWith(q) ? 0 : 1);
      return rank(a) - rank(b) || b.added - a.added;
    });
  }

  if (filters.genres) {
    const wanted = new Set(filters.genres.split(","));
    list = list.filter((g) => g.genres.some((x) => wanted.has(x.slug) || wanted.has(String(x.id))));
  }

  if (filters.platforms) {
    const wanted = new Set(filters.platforms.split(","));
    list = list.filter((g) =>
      g.parentPlatforms.some((x) => wanted.has(x.slug) || wanted.has(String(x.id))),
    );
  }

  if (filters.dates) {
    const [from, to] = filters.dates.split(",");
    list = list.filter((g) => Boolean(g.released) && g.released! >= from && g.released! <= to);
  }

  if (filters.metacritic) {
    const [lo, hi] = filters.metacritic.split(",").map(Number);
    list = list.filter((g) => g.metacritic !== null && g.metacritic >= lo && g.metacritic <= hi);
  }

  // Search results keep their relevance order; everything else gets sorted.
  return filters.search?.trim() && !filters.ordering
    ? list
    : sampleSort(list, filters.ordering);
}

function samplePage(filters: BrowseFilters): Page<GameSummary> {
  const all = sampleFilter(filters);
  const page = Math.max(1, filters.page ?? 1);
  const size = filters.pageSize ?? 24;
  const start = (page - 1) * size;
  const slice = all.slice(start, start + size);
  return { results: slice, count: all.length, hasNext: start + size < all.length, page };
}

const sourced = <T,>(data: T, source: DataSource): Sourced<T> => ({ data, source });

/* ---------------------------------------------------------------------------
 * Public queries
 * ------------------------------------------------------------------------ */

export function dataMode(): DataSource {
  return hasRawgKey() ? "live" : "sample";
}

export async function browseGames(filters: BrowseFilters): Promise<Sourced<Page<GameSummary>>> {
  const live = await rawgBrowse(filters);
  return live ? sourced(live, "live") : sourced(samplePage(filters), "sample");
}

/**
 * Release calendar. Live mode asks RAWG for anything shipping between today and
 * a year out, ascending. Sample mode surfaces announced-but-undated titles,
 * since the bundled catalogue deliberately carries no speculative dates.
 */
export async function getUpcoming(pageSize = 24, page = 1): Promise<Sourced<Page<GameSummary>>> {
  const live = await rawgBrowse({
    dates: `${today()},${shift(365)}`,
    ordering: "released",
    pageSize,
    page,
  });
  if (live) return sourced(live, "live");

  const upcoming = SAMPLE_GAMES.map(toSummary).filter(
    (g) => g.tba || (g.released !== null && g.released >= today()),
  );
  const ordered = sampleSort(upcoming, "released");
  const start = (page - 1) * pageSize;
  return sourced(
    {
      results: ordered.slice(start, start + pageSize),
      count: ordered.length,
      hasNext: start + pageSize < ordered.length,
      page,
    },
    "sample",
  );
}

/** Popular right now — RAWG's `added` signal over the last twelve months. */
export async function getTrending(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const live = await rawgBrowse({
    dates: `${shift(-365)},${today()}`,
    ordering: "-added",
    pageSize,
  });
  if (live) return sourced(live.results, "live");

  const list = sampleSort(
    SAMPLE_GAMES.map(toSummary).filter((g) => !g.tba),
    "-added",
  );
  return sourced(list.slice(0, pageSize), "sample");
}

/** Critically acclaimed, all time. */
export async function getTopRated(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const live = await rawgBrowse({
    ordering: "-metacritic",
    metacritic: "88,100",
    pageSize,
  });
  if (live) return sourced(live.results, "live");

  const list = SAMPLE_GAMES.map(toSummary).filter((g) => (g.metacritic ?? 0) >= 88);
  return sourced(sampleSort(list, "-metacritic").slice(0, pageSize), "sample");
}

/** Shipped in the last two months. */
export async function getNewReleases(pageSize = 12): Promise<Sourced<GameSummary[]>> {
  const live = await rawgBrowse({
    dates: `${shift(-60)},${today()}`,
    ordering: "-released",
    pageSize,
  });
  if (live) return sourced(live.results, "live");

  const list = sampleSort(
    SAMPLE_GAMES.map(toSummary).filter((g) => !g.tba),
    "-released",
  );
  return sourced(list.slice(0, pageSize), "sample");
}

export async function getGame(slug: string): Promise<Sourced<GameDetail> | null> {
  const live = await rawgDetail(slug);
  if (live) return sourced(live, "live");

  const sample = SAMPLE_BY_SLUG.get(slug);
  return sample ? sourced(sample, "sample") : null;
}

/**
 * Related titles. RAWG's series endpoint is exact but often empty, so both modes
 * fall back to a genre-overlap score, which is a better "you might also like"
 * than an empty rail.
 */
export async function getRelated(game: GameDetail, limit = 8): Promise<GameSummary[]> {
  const series = await rawgSeries(game.slug);
  if (series && series.length > 0) return series.slice(0, limit);

  if (hasRawgKey() && game.genres.length > 0) {
    const byGenre = await rawgBrowse({
      genres: game.genres.map((g) => g.slug).join(","),
      ordering: "-added",
      pageSize: limit + 6,
    });
    if (byGenre) {
      return byGenre.results.filter((g) => g.slug !== game.slug).slice(0, limit);
    }
  }

  const wanted = new Set(game.genres.map((g) => g.slug));
  return SAMPLE_GAMES.map(toSummary)
    .filter((g) => g.slug !== game.slug)
    .map((g) => ({ g, score: g.genres.filter((x) => wanted.has(x.slug)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.g.added - a.g.added)
    .slice(0, limit)
    .map((x) => x.g);
}

export async function searchGames(query: string, pageSize = 24, page = 1) {
  return browseGames({ search: query, pageSize, page, ordering: undefined });
}

export async function getGenres(): Promise<Sourced<Ref[]>> {
  const live = await rawgGenres();
  return live ? sourced(live, "live") : sourced(SAMPLE_GENRES, "sample");
}

export async function getPlatforms(): Promise<Sourced<Ref[]>> {
  const live = await rawgPlatforms();
  return live ? sourced(live, "live") : sourced(SAMPLE_PLATFORMS, "sample");
}

/** Slugs used to pre-render the most valuable detail pages at build time. */
export function sampleSlugs(): string[] {
  return SAMPLE_GAMES.map((g) => g.slug);
}
