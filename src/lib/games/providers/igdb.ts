/**
 * IGDB provider — the primary backend.
 *
 * IGDB (run by Twitch/Amazon) is the most complete free game database
 * available: ~300k games across every platform, with covers, screenshots,
 * trailers, genres, companies, critic aggregates and release windows. The free
 * tier needs a Twitch application (client id + secret), which costs nothing.
 *
 * Two things shape this file:
 *
 * 1. IGDB queries are POST requests carrying an APICalypse body. Next's fetch
 *    data cache only covers GET, so every query goes through `unstable_cache`
 *    instead — keyed on endpoint + body.
 *
 * 2. Failures throw rather than return null. `unstable_cache` stores whatever a
 *    function returns, so returning null on an outage would pin that null in
 *    the cache for hours. Throwing leaves the cache empty; the public methods
 *    catch and hand back null so the resolver can fall through.
 */

import { unstable_cache } from "next/cache";
import type {
  BrowseFilters,
  GameDetail,
  GameSummary,
  Ref,
  Requirement,
  StoreRef,
  Trailer,
} from "../types";
import { REQUEST_TIMEOUT_MS, TTL, type GameProvider } from "./types";
import { platformKey, type PlatformKey } from "@/lib/utils/format";

const API = "https://api.igdb.com/v4";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

function credentials() {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/* ---------------------------------------------------------------------------
 * Auth
 *
 * App access tokens last ~60 days. Held in module scope so a warm server reuses
 * one token across requests, and refreshed a minute before expiry.
 * ------------------------------------------------------------------------ */

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const url = new URL(TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`[igdb] token request failed: ${res.status}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("[igdb] token response had no access_token");

  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

async function getToken(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("[igdb] not configured");

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;

  // Collapse concurrent refreshes so a cold start doesn't fire one token
  // request per in-flight page render.
  if (!tokenInFlight) {
    tokenInFlight = fetchToken(creds.clientId, creds.clientSecret).finally(() => {
      tokenInFlight = null;
    });
  }
  return tokenInFlight;
}

/* ---------------------------------------------------------------------------
 * Query transport
 * ------------------------------------------------------------------------ */

async function rawQuery<T>(endpoint: string, body: string): Promise<T> {
  const creds = credentials();
  if (!creds) throw new Error("[igdb] not configured");

  const run = async (token: string) =>
    fetch(`${API}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": creds.clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  let res = await run(await getToken());

  // A revoked or expired token reads as 401; drop it and retry exactly once.
  if (res.status === 401) {
    tokenCache = null;
    res = await run(await getToken());
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`[igdb] ${endpoint} → ${res.status} ${detail.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

/**
 * One cached wrapper per TTL bucket. `unstable_cache` bakes `revalidate` into
 * the instance, so the bucket has to be chosen at construction time; arguments
 * form the rest of the cache key.
 */
const queryFor = (() => {
  const cache = new Map<number, <T>(endpoint: string, body: string) => Promise<T>>();
  return (revalidate: number) => {
    const existing = cache.get(revalidate);
    if (existing) return existing;
    const fn = unstable_cache(
      async (endpoint: string, body: string) => rawQuery<unknown>(endpoint, body),
      ["igdb", String(revalidate)],
      { revalidate, tags: ["igdb"] },
    ) as <T>(endpoint: string, body: string) => Promise<T>;
    cache.set(revalidate, fn);
    return fn;
  };
})();

interface QueryParts {
  fields: string;
  where?: string;
  sort?: string;
  /** IGDB forbids combining `search` with `sort`; the builder enforces it. */
  search?: string;
  limit?: number;
  offset?: number;
}

function apicalypse(parts: QueryParts): string {
  const lines = [`fields ${parts.fields};`];
  if (parts.search) lines.push(`search "${parts.search.replace(/"/g, '\\"')}";`);
  if (parts.where) lines.push(`where ${parts.where};`);
  if (parts.sort && !parts.search) lines.push(`sort ${parts.sort};`);
  lines.push(`limit ${Math.min(parts.limit ?? 24, 500)};`);
  if (parts.offset) lines.push(`offset ${parts.offset};`);
  return lines.join("\n");
}

/* ---------------------------------------------------------------------------
 * Payload shapes (only the fields consumed here)
 * ------------------------------------------------------------------------ */

interface IgdbNamed {
  id: number;
  name: string;
  slug?: string;
}

interface IgdbReleaseDate {
  /** 0 = exact day, 1 = month, 2 = year, 3–6 = quarters, 7 = TBD. */
  category?: number;
  date?: number;
  human?: string;
}

interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  screenshots?: { image_id?: string }[];
  videos?: { video_id?: string; name?: string }[];
  genres?: IgdbNamed[];
  themes?: IgdbNamed[];
  game_modes?: IgdbNamed[];
  platforms?: (IgdbNamed & { abbreviation?: string })[];
  release_dates?: IgdbReleaseDate[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: IgdbNamed;
  }[];
  websites?: { url?: string; category?: number }[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  total_rating_count?: number;
  hypes?: number;
  follows?: number;
  status?: number;
  url?: string;
  /** Cross-store identifiers. Category 1 is Steam. */
  external_games?: { category?: number; uid?: string }[];
}

/** IGDB's external-store category for Steam. */
const EXTERNAL_STEAM = 1;

function steamAppIdOf(game: IgdbGame): number | null {
  for (const external of game.external_games ?? []) {
    if (external.category === EXTERNAL_STEAM && external.uid) {
      const appid = Number(external.uid);
      if (Number.isFinite(appid) && appid > 0) return appid;
    }
  }
  return null;
}

const SUMMARY_FIELDS = [
  "name",
  "slug",
  "first_release_date",
  "cover.image_id",
  "screenshots.image_id",
  "genres.name",
  "genres.slug",
  "platforms.name",
  "platforms.slug",
  "platforms.abbreviation",
  "release_dates.category",
  "release_dates.date",
  "release_dates.human",
  "aggregated_rating",
  "aggregated_rating_count",
  "rating",
  "rating_count",
  "total_rating_count",
  "hypes",
  "follows",
  "status",
].join(",");

const DETAIL_FIELDS = [
  SUMMARY_FIELDS,
  "summary",
  "storyline",
  "url",
  "videos.video_id",
  "videos.name",
  "themes.name",
  "themes.slug",
  "game_modes.name",
  "game_modes.slug",
  "involved_companies.developer",
  "involved_companies.publisher",
  "involved_companies.company.name",
  "involved_companies.company.slug",
  "websites.url",
  "websites.category",
  "external_games.category",
  "external_games.uid",
].join(",");

/**
 * Excludes DLC, expansions, bundles and alternate editions.
 *
 * Filters on `parent_game` / `version_parent` rather than IGDB's `category`
 * enum: those two field names have been stable across API revisions, whereas
 * `category` has been superseded by `game_type`.
 */
const MAIN_GAMES = "parent_game = null & version_parent = null";

/* ---------------------------------------------------------------------------
 * Images
 * ------------------------------------------------------------------------ */

export type IgdbImageSize =
  | "cover_small"
  | "cover_big"
  | "cover_big_2x"
  | "screenshot_med"
  | "screenshot_big"
  | "screenshot_huge"
  | "720p"
  | "1080p";

export function igdbImage(imageId: string | null | undefined, size: IgdbImageSize): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/* ---------------------------------------------------------------------------
 * Mapping
 * ------------------------------------------------------------------------ */

/** IGDB stores its own platform vocabulary; collapse it to our icon families. */
function toFamilies(platforms: IgdbNamed[] | undefined): Ref[] {
  const seen = new Map<PlatformKey, Ref>();
  for (const platform of platforms ?? []) {
    const key = platformKey(platform.slug ?? platform.name ?? "");
    if (key && !seen.has(key)) {
      seen.set(key, { id: FAMILY_IDS[key], slug: key, name: FAMILY_NAMES[key] });
    }
  }
  return [...seen.values()];
}

/** Stable synthetic ids for platform families — IGDB has no such entity. */
const FAMILY_IDS: Record<PlatformKey, number> = {
  pc: 1,
  playstation: 2,
  xbox: 3,
  nintendo: 4,
  mac: 5,
  linux: 6,
  mobile: 7,
  web: 8,
};

const FAMILY_NAMES: Record<PlatformKey, string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  mac: "macOS",
  linux: "Linux",
  mobile: "Mobile",
  web: "Browser",
};

export const PLATFORM_FAMILIES: Ref[] = (
  ["pc", "playstation", "xbox", "nintendo", "mac", "linux", "mobile"] as PlatformKey[]
).map((key) => ({ id: FAMILY_IDS[key], slug: key, name: FAMILY_NAMES[key] }));

const toRefs = (items: IgdbNamed[] | undefined): Ref[] =>
  (items ?? []).map((item) => ({
    id: item.id,
    slug: item.slug ?? String(item.id),
    name: item.name,
  }));

const isoFromUnix = (seconds: number): string =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * Resolves a release into either an exact ISO date or a human window.
 *
 * IGDB's `first_release_date` carries a full timestamp even when only a
 * quarter is actually known, so trusting it blindly would render "Oct 1, 2026"
 * for a game that has only been dated "Q4 2026". The `release_dates` entries
 * carry a precision category, so the earliest of those wins; the bare
 * timestamp is used only when no categorised entry exists.
 */
function resolveRelease(game: IgdbGame): {
  released: string | null;
  releaseWindow: string | null;
  tba: boolean;
} {
  const dated = (game.release_dates ?? [])
    .filter((entry) => typeof entry.date === "number")
    .sort((a, b) => (a.date ?? 0) - (b.date ?? 0));

  const earliest = dated[0];

  if (earliest && typeof earliest.category === "number") {
    // Category 0 is the only day-level precision IGDB exposes.
    if (earliest.category === 0 && typeof earliest.date === "number") {
      return { released: isoFromUnix(earliest.date), releaseWindow: null, tba: false };
    }
    if (earliest.category === 7) {
      return { released: null, releaseWindow: null, tba: true };
    }
    return {
      released: null,
      releaseWindow: earliest.human?.trim() || null,
      tba: !earliest.human?.trim(),
    };
  }

  if (typeof game.first_release_date === "number") {
    return { released: isoFromUnix(game.first_release_date), releaseWindow: null, tba: false };
  }

  return { released: null, releaseWindow: null, tba: true };
}

function mapSummary(game: IgdbGame): GameSummary {
  const release = resolveRelease(game);
  const platforms = toRefs(game.platforms);

  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    ...release,
    // IGDB covers are already portrait 3:4 and high resolution, so no
    // fallback asset is needed here.
    image: igdbImage(game.cover?.image_id, "cover_big_2x"),
    imageFallback: null,
    // IGDB user ratings are 0–100; the UI's star scale is 0–5.
    rating: typeof game.rating === "number" ? Math.round((game.rating / 20) * 10) / 10 : 0,
    ratingsCount: game.rating_count ?? 0,
    metacritic:
      typeof game.aggregated_rating === "number" ? Math.round(game.aggregated_rating) : null,
    platforms,
    parentPlatforms: toFamilies(game.platforms),
    genres: toRefs(game.genres),
    screenshots: (game.screenshots ?? [])
      .map((shot) => igdbImage(shot.image_id, "screenshot_huge"))
      .filter((url): url is string => Boolean(url)),
    esrb: null,
    playtime: 0,
    // `hypes` counts pre-release anticipation; `follows` counts library adds.
    // Either is a reasonable stand-in for popularity depending on lifecycle.
    added: game.follows ?? game.hypes ?? game.total_rating_count ?? 0,
  };
}

/** IGDB website category 1 is the official site. */
const OFFICIAL_SITE = 1;

function mapDetail(game: IgdbGame): GameDetail {
  const summary = mapSummary(game);

  const developers = (game.involved_companies ?? [])
    .filter((entry) => entry.developer && entry.company)
    .map((entry) => ({
      id: entry.company!.id,
      slug: entry.company!.slug ?? String(entry.company!.id),
      name: entry.company!.name,
    }));

  const publishers = (game.involved_companies ?? [])
    .filter((entry) => entry.publisher && entry.company)
    .map((entry) => ({
      id: entry.company!.id,
      slug: entry.company!.slug ?? String(entry.company!.id),
      name: entry.company!.name,
    }));

  const trailers: Trailer[] = (game.videos ?? [])
    .filter((video) => video.video_id)
    .slice(0, 6)
    .map((video, index) => ({
      id: index,
      name: video.name?.trim() || "Trailer",
      // IGDB hosts no media itself — `video_id` is a YouTube id.
      kind: "youtube" as const,
      youtubeId: video.video_id!,
      preview: `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${video.video_id}`,
    }));

  const description = [game.summary?.trim(), game.storyline?.trim()]
    .filter(Boolean)
    .join("\n\n");

  // Themes and modes are the closest IGDB analogue to descriptive tags.
  const tags = [...toRefs(game.themes), ...toRefs(game.game_modes)].slice(0, 18);

  const stores: StoreRef[] = [];
  const requirements: Requirement[] = [];

  return {
    ...summary,
    description,
    steamAppId: steamAppIdOf(game),
    // IGDB publishes no pricing; the Steam merge fills this in when available.
    price: null,
    website:
      game.websites?.find((site) => site.category === OFFICIAL_SITE)?.url?.trim() ||
      game.url?.trim() ||
      null,
    developers,
    publishers,
    tags,
    stores,
    requirements,
    trailers,
    redditUrl: null,
    metacriticUrl: null,
    alternativeNames: [],
  };
}

/* ---------------------------------------------------------------------------
 * Taxonomy lookups
 * ------------------------------------------------------------------------ */

async function fetchGenres(): Promise<Ref[]> {
  const query = queryFor(TTL.taxonomy);
  const rows = await query<IgdbNamed[]>(
    "genres",
    apicalypse({ fields: "name,slug", sort: "name asc", limit: 60 }),
  );
  return toRefs(rows);
}

async function fetchPlatformIndex(): Promise<IgdbNamed[]> {
  const query = queryFor(TTL.taxonomy);
  return query<IgdbNamed[]>(
    "platforms",
    apicalypse({ fields: "name,slug,abbreviation", sort: "name asc", limit: 300 }),
  );
}

/** Maps our family slugs onto the concrete IGDB platform ids they cover. */
async function platformIdsForFamilies(slugs: string[]): Promise<number[]> {
  const index = await fetchPlatformIndex();
  const wanted = new Set(slugs);
  return index
    .filter((platform) => {
      const key = platformKey(platform.slug ?? platform.name ?? "");
      return key !== null && wanted.has(key);
    })
    .map((platform) => platform.id);
}

async function genreIdsForSlugs(slugs: string[]): Promise<number[]> {
  const genres = await fetchGenres();
  const wanted = new Set(slugs);
  return genres.filter((genre) => wanted.has(genre.slug)).map((genre) => genre.id);
}

/* ---------------------------------------------------------------------------
 * Provider
 * ------------------------------------------------------------------------ */

const nowSeconds = () => Math.floor(Date.now() / 1000);
const daysFromNow = (days: number) => nowSeconds() + days * 86_400;

/** Drops cancelled titles, which IGDB keeps in the index with status 6. */
const CANCELLED = 6;
const usable = (games: IgdbGame[]) => games.filter((game) => game.status !== CANCELLED);

async function listGames(
  parts: QueryParts,
  revalidate: number,
): Promise<GameSummary[]> {
  const query = queryFor(revalidate);
  const rows = await query<IgdbGame[]>("games", apicalypse(parts));
  return usable(rows).map(mapSummary);
}

async function countGames(where: string, revalidate: number): Promise<number> {
  const query = queryFor(revalidate);
  const result = await query<{ count?: number }>(
    "games/count",
    `where ${where};`,
  );
  return result?.count ?? 0;
}

export const igdbProvider: GameProvider = {
  id: "igdb",

  isConfigured() {
    return credentials() !== null;
  },

  async browse(filters: BrowseFilters) {
    if (!this.isConfigured()) return null;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = filters.pageSize ?? 24;

    try {
      const clauses = [MAIN_GAMES];

      if (filters.genres) {
        const ids = await genreIdsForSlugs(filters.genres.split(",").filter(Boolean));
        // No matching genre means the filter is unsatisfiable — report zero
        // results rather than silently dropping it and showing everything.
        if (ids.length === 0) {
          return { results: [], count: 0, hasNext: false, page };
        }
        clauses.push(`genres = (${ids.join(",")})`);
      }

      if (filters.platforms) {
        const ids = await platformIdsForFamilies(filters.platforms.split(",").filter(Boolean));
        if (ids.length === 0) {
          return { results: [], count: 0, hasNext: false, page };
        }
        clauses.push(`platforms = (${ids.join(",")})`);
      }

      if (filters.dates) {
        const [from, to] = filters.dates.split(",");
        const toUnix = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 1000);
        clauses.push(`first_release_date >= ${toUnix(from)} & first_release_date <= ${toUnix(to)}`);
      }

      const where = clauses.join(" & ");
      const revalidate = filters.search ? TTL.search : TTL.list;

      const results = await listGames(
        {
          fields: SUMMARY_FIELDS,
          search: filters.search,
          where,
          sort: sortClause(filters.ordering),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        revalidate,
      );

      // `search` bypasses `where` counting semantics, so only report a real
      // total for filtered browsing.
      const count = filters.search
        ? results.length + (page - 1) * pageSize
        : await countGames(where, revalidate);

      return {
        results,
        count,
        hasNext: results.length >= pageSize,
        page,
      };
    } catch (err) {
      warn("browse", err);
      return null;
    }
  },

  async upcoming(pageSize: number, page: number) {
    if (!this.isConfigured()) return null;
    try {
      const where = `${MAIN_GAMES} & first_release_date > ${nowSeconds()} & first_release_date < ${daysFromNow(730)}`;
      const results = await listGames(
        {
          fields: SUMMARY_FIELDS,
          where,
          sort: "first_release_date asc",
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        TTL.list,
      );
      return {
        results,
        count: await countGames(where, TTL.list),
        hasNext: results.length >= pageSize,
        page,
      };
    } catch (err) {
      warn("upcoming", err);
      return null;
    }
  },

  async trending(pageSize: number) {
    if (!this.isConfigured()) return null;
    try {
      return await listGames(
        {
          fields: SUMMARY_FIELDS,
          where: `${MAIN_GAMES} & first_release_date > ${daysFromNow(-365)} & first_release_date < ${nowSeconds()}`,
          sort: "total_rating_count desc",
          limit: pageSize,
        },
        TTL.list,
      );
    } catch (err) {
      warn("trending", err);
      return null;
    }
  },

  async topRated(pageSize: number) {
    if (!this.isConfigured()) return null;
    try {
      return await listGames(
        {
          fields: SUMMARY_FIELDS,
          // A minimum critic count keeps single-review outliers off the shelf.
          where: `${MAIN_GAMES} & aggregated_rating_count > 7 & aggregated_rating > 80`,
          sort: "aggregated_rating desc",
          limit: pageSize,
        },
        TTL.list,
      );
    } catch (err) {
      warn("topRated", err);
      return null;
    }
  },

  async newReleases(pageSize: number) {
    if (!this.isConfigured()) return null;
    try {
      return await listGames(
        {
          fields: SUMMARY_FIELDS,
          where: `${MAIN_GAMES} & first_release_date > ${daysFromNow(-60)} & first_release_date <= ${nowSeconds()}`,
          sort: "first_release_date desc",
          limit: pageSize,
        },
        TTL.list,
      );
    } catch (err) {
      warn("newReleases", err);
      return null;
    }
  },

  async detail(slug: string) {
    if (!this.isConfigured()) return null;
    try {
      const query = queryFor(TTL.detail);
      const rows = await query<IgdbGame[]>(
        "games",
        apicalypse({
          fields: DETAIL_FIELDS,
          where: `slug = "${slug.replace(/"/g, "")}"`,
          limit: 1,
        }),
      );
      return rows.length > 0 ? mapDetail(rows[0]) : null;
    } catch (err) {
      warn("detail", err);
      return null;
    }
  },

  async related(game: GameDetail, limit: number) {
    if (!this.isConfigured()) return null;
    if (game.genres.length === 0) return [];
    try {
      const ids = game.genres.map((genre) => genre.id).join(",");
      const results = await listGames(
        {
          fields: SUMMARY_FIELDS,
          where: `${MAIN_GAMES} & genres = (${ids}) & id != ${game.id}`,
          sort: "total_rating_count desc",
          limit: limit + 4,
        },
        TTL.detail,
      );
      return results.slice(0, limit);
    } catch (err) {
      warn("related", err);
      return null;
    }
  },

  async genres() {
    if (!this.isConfigured()) return null;
    try {
      return await fetchGenres();
    } catch (err) {
      warn("genres", err);
      return null;
    }
  },

  async platforms() {
    if (!this.isConfigured()) return null;
    // Families rather than IGDB's ~200 individual platforms: filtering by
    // "PlayStation" is what people mean, not "PlayStation Vita" specifically.
    return PLATFORM_FAMILIES;
  },
};

function sortClause(ordering: BrowseFilters["ordering"]): string | undefined {
  switch (ordering) {
    case "released":
      return "first_release_date asc";
    case "-released":
      return "first_release_date desc";
    case "-rating":
      return "rating desc";
    case "-metacritic":
      return "aggregated_rating desc";
    case "name":
      return "name asc";
    case "-added":
      return "total_rating_count desc";
    default:
      return "total_rating_count desc";
  }
}

function warn(operation: string, err: unknown) {
  console.warn(`[igdb] ${operation} failed:`, err instanceof Error ? err.message : err);
}
