/**
 * RAWG.io client — server-side only.
 *
 * RAWG's free tier covers 20k requests/month, which is far more than this app
 * needs given every response is cached by the Next data cache. The key is read
 * from `RAWG_API_KEY` and never reaches the browser: all calls originate in
 * server components or route handlers.
 *
 * Every function returns `null` on any failure rather than throwing. Callers in
 * `source.ts` treat null as "fall back to the bundled catalogue", so a rate
 * limit or an outage degrades the site to sample data instead of a 500.
 */

import type {
  GameDetail,
  GameSummary,
  Page,
  Ref,
  Requirement,
  StoreRef,
  Trailer,
  BrowseFilters,
} from "./types";

const BASE = "https://api.rawg.io/api";

/** Cache windows, in seconds. Release data moves slowly; search moves fastest. */
const TTL = {
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 10,
  taxonomy: 60 * 60 * 24 * 7,
} as const;

export function hasRawgKey(): boolean {
  return Boolean(process.env.RAWG_API_KEY?.trim());
}

async function rawgFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidate: number = TTL.list,
): Promise<T | null> {
  const key = process.env.RAWG_API_KEY?.trim();
  if (!key) return null;

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: { Accept: "application/json" },
      // RAWG occasionally stalls; don't let a slow upstream hold a render.
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) {
      console.warn(`[rawg] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[rawg] ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Image helpers
 * ------------------------------------------------------------------------ */

/**
 * RAWG exposes an on-the-fly resizer by injecting `resize/{width}/-/` into the
 * media path. Requesting a 1600px hero when the card renders at 400px is the
 * single biggest bandwidth win available here, so always ask for a real width.
 */
export function rawgImage(url: string | null | undefined, width?: number): string | null {
  if (!url) return null;
  if (!width) return url;
  const marker = "/media/";
  const at = url.indexOf(marker);
  if (at === -1) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  // Already resized — don't nest transforms.
  if (tail.startsWith("resize/") || tail.startsWith("crop/")) return url;
  return `${head}resize/${width}/-/${tail}`;
}

/* ---------------------------------------------------------------------------
 * Raw payload shapes (only the fields we consume)
 * ------------------------------------------------------------------------ */

interface RawRef {
  id: number;
  slug: string;
  name: string;
}

interface RawGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  background_image: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  playtime: number;
  added: number;
  esrb_rating: RawRef | null;
  platforms?: { platform: RawRef }[] | null;
  parent_platforms?: { platform: RawRef }[] | null;
  genres?: RawRef[] | null;
  short_screenshots?: { id: number; image: string }[] | null;
}

interface RawGameDetail extends RawGame {
  description_raw?: string;
  description?: string;
  website?: string | null;
  reddit_url?: string | null;
  metacritic_url?: string | null;
  background_image_additional?: string | null;
  developers?: RawRef[] | null;
  publishers?: RawRef[] | null;
  tags?: RawRef[] | null;
  alternative_names?: string[] | null;
  stores?: { id: number; url?: string | null; store: RawRef & { domain?: string | null } }[] | null;
  platforms?: {
    platform: RawRef;
    requirements?: { minimum?: string; recommended?: string } | null;
  }[] | null;
}

interface RawList<T> {
  count: number;
  next: string | null;
  results: T[];
}

/* ---------------------------------------------------------------------------
 * Mappers
 * ------------------------------------------------------------------------ */

const toRefs = (items: RawRef[] | null | undefined): Ref[] =>
  (items ?? []).map((r) => ({ id: r.id, slug: r.slug, name: r.name }));

const toNestedRefs = (items: { platform: RawRef }[] | null | undefined): Ref[] =>
  (items ?? []).map((p) => ({ id: p.platform.id, slug: p.platform.slug, name: p.platform.name }));

export function mapSummary(g: RawGame): GameSummary {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released ?? null,
    tba: Boolean(g.tba),
    image: g.background_image ?? null,
    rating: g.rating ?? 0,
    ratingsCount: g.ratings_count ?? 0,
    metacritic: g.metacritic ?? null,
    platforms: toNestedRefs(g.platforms),
    parentPlatforms: toNestedRefs(g.parent_platforms),
    genres: toRefs(g.genres),
    screenshots: (g.short_screenshots ?? []).map((s) => s.image).filter(Boolean),
    esrb: g.esrb_rating?.name ?? null,
    playtime: g.playtime ?? 0,
    added: g.added ?? 0,
  };
}

/** RAWG's `description` is HTML; `description_raw` is not always present. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapRequirements(g: RawGameDetail): Requirement[] {
  return (g.platforms ?? [])
    .filter((p) => p.requirements?.minimum || p.requirements?.recommended)
    .map((p) => ({
      platform: p.platform.name,
      minimum: p.requirements?.minimum ? stripHtml(p.requirements.minimum) : null,
      recommended: p.requirements?.recommended ? stripHtml(p.requirements.recommended) : null,
    }));
}

function mapStores(g: RawGameDetail): StoreRef[] {
  return (g.stores ?? []).map((s) => ({
    id: s.store.id,
    slug: s.store.slug,
    name: s.store.name,
    domain: s.store.domain ?? null,
    url: s.url ?? null,
  }));
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

function buildPage(list: RawList<RawGame>, page: number): Page<GameSummary> {
  return {
    results: list.results.map(mapSummary),
    count: list.count,
    hasNext: Boolean(list.next),
    page,
  };
}

export async function rawgBrowse(filters: BrowseFilters): Promise<Page<GameSummary> | null> {
  const page = filters.page ?? 1;
  const list = await rawgFetch<RawList<RawGame>>(
    "/games",
    {
      search: filters.search,
      genres: filters.genres,
      platforms: filters.platforms,
      // RAWG rejects `relevance`; omitting `ordering` *is* relevance ordering.
      ordering: filters.ordering === "relevance" ? undefined : filters.ordering,
      dates: filters.dates,
      metacritic: filters.metacritic,
      page,
      page_size: filters.pageSize ?? 24,
      // Drop the long tail of asset flips and shovelware from browse results.
      exclude_additions: filters.search ? undefined : "true",
    },
    filters.search ? TTL.search : TTL.list,
  );
  return list ? buildPage(list, page) : null;
}

export async function rawgDetail(slug: string): Promise<GameDetail | null> {
  const g = await rawgFetch<RawGameDetail>(`/games/${encodeURIComponent(slug)}`, {}, TTL.detail);
  if (!g) return null;

  // Screenshots and trailers live on separate endpoints. Fetch in parallel and
  // treat either failing as "no media" rather than failing the whole page.
  const [shots, movies] = await Promise.all([
    rawgFetch<RawList<{ id: number; image: string }>>(
      `/games/${encodeURIComponent(slug)}/screenshots`,
      { page_size: 12 },
      TTL.detail,
    ),
    rawgFetch<RawList<{ id: number; name: string; preview: string; data: Record<string, string> }>>(
      `/games/${encodeURIComponent(slug)}/movies`,
      {},
      TTL.detail,
    ),
  ]);

  const trailers: Trailer[] = (movies?.results ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    preview: m.preview ?? null,
    url: m.data?.max ?? m.data?.["480"] ?? null,
  }));

  const summary = mapSummary(g);
  const screenshots = shots?.results?.length
    ? shots.results.map((s) => s.image)
    : summary.screenshots;

  const description = g.description_raw?.trim()
    ? g.description_raw.trim()
    : g.description
      ? stripHtml(g.description)
      : "";

  return {
    ...summary,
    screenshots,
    description,
    website: g.website?.trim() || null,
    developers: toRefs(g.developers),
    publishers: toRefs(g.publishers),
    // RAWG returns hundreds of tags; the tail is noise.
    tags: toRefs(g.tags).slice(0, 18),
    stores: mapStores(g),
    requirements: mapRequirements(g),
    trailers,
    redditUrl: g.reddit_url?.trim() || null,
    metacriticUrl: g.metacritic_url?.trim() || null,
    alternativeNames: g.alternative_names ?? [],
  };
}

export async function rawgSeries(slug: string): Promise<GameSummary[] | null> {
  const list = await rawgFetch<RawList<RawGame>>(
    `/games/${encodeURIComponent(slug)}/game-series`,
    { page_size: 12 },
    TTL.detail,
  );
  return list ? list.results.map(mapSummary) : null;
}

export async function rawgGenres(): Promise<Ref[] | null> {
  const list = await rawgFetch<RawList<RawRef>>("/genres", { page_size: 40 }, TTL.taxonomy);
  return list ? toRefs(list.results) : null;
}

export async function rawgPlatforms(): Promise<Ref[] | null> {
  const list = await rawgFetch<RawList<RawRef>>(
    "/platforms/lists/parents",
    { page_size: 20 },
    TTL.taxonomy,
  );
  return list ? toRefs(list.results) : null;
}
