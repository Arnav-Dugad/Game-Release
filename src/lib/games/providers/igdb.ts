/**
 * IGDB provider — the primary and, when configured, the only live backend.
 *
 * IGDB (Twitch/Amazon) covers ~300k games across every platform with covers,
 * artwork, screenshots, trailers, companies, engines, franchises, critic
 * aggregates, age ratings and release windows. Free tier; needs a Twitch
 * client id + secret.
 *
 * Three things shape this file:
 *
 * 1. Queries are POST with an APICalypse body. Next's fetch data cache only
 *    covers GET, so everything goes through `unstable_cache`, keyed on
 *    endpoint + body.
 *
 * 2. Failures throw rather than return null. `unstable_cache` stores whatever a
 *    function returns, so a null on an outage would be pinned in the cache for
 *    hours. Throwing leaves the cache empty; public methods catch and return
 *    null so the resolver can fall through.
 *
 * 3. The field list is *negotiated*, not assumed. IGDB has renamed several
 *    fields across API revisions (`release_dates.category` → `date_format`,
 *    `age_ratings.category`/`rating` → `organization`/`rating_category`).
 *    Requesting a field that no longer exists fails the entire query with a
 *    400 — which would silently degrade every page to whatever Steam has (or
 *    to an honest "unavailable" state if Steam has no answer either). So on
 *    first use the client probes which spelling this account's API speaks,
 *    caches the answer, and builds queries accordingly. Anything genuinely
 *    uncertain is derived instead: store links and the Steam appid come from
 *    `websites.url` hostnames rather than a category enum.
 */

import { unstable_cache } from "next/cache";
import type {
  AgeRating,
  BrowseFilters,
  GameDetail,
  GameSummary,
  MultiplayerModes,
  Ref,
  StoreRef,
  Trailer,
  WebsiteRef,
} from "../types";
import { REQUEST_TIMEOUT_MS, TTL, type GameProvider } from "./types";
import { platformKey, type PlatformKey } from "@/lib/utils/format";
import { storeFromUrl } from "../stores";

const API = "https://api.igdb.com/v4";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

function credentials() {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function igdbConfigured(): boolean {
  return credentials() !== null;
}

/* ---------------------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------------------ */

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

/**
 * How long Next may reuse a cached token response.
 *
 * Must not be *lower* than any route's own revalidate window. A fetch that
 * declares a shorter lifetime than the page it renders in drags the whole
 * route down to match, and because the token is fetched lazily that hit landed
 * on whichever page happened to authenticate first — one game page silently
 * revalidating every 50 minutes instead of daily, and re-querying IGDB 28×
 * more often than intended.
 *
 * A week clears the longest route window (a day) while staying far inside the
 * token's real lifetime, which Twitch currently issues at around eight weeks.
 * Freshness is governed by `tokenCache` below regardless, and a revoked token
 * self-heals through the 401 path rather than waiting this out.
 */
const TOKEN_CACHE_SECONDS = 604_800;

/**
 * Twitch distinguishes its two credential failures, and the difference is the
 * single most useful thing to know when the site goes quiet:
 *
 *   400 "invalid client"        → the client id is wrong or the app was deleted
 *   403 "invalid client secret" → the id is fine, the secret is wrong/rotated
 *
 * Both used to surface as a bare status code, so the message is preserved here
 * and mapped to an actionable hint by `igdbDiagnostics`.
 *
 * `refresh` busts the cache entry after a 401. It is part of the URL rather
 * than the body because the URL is what makes this a distinct cache key.
 */
async function fetchToken(
  clientId: string,
  clientSecret: string,
  refresh = 0,
): Promise<string> {
  const res = await fetch(refresh > 0 ? `${TOKEN_URL}?refresh=${refresh}` : TOKEN_URL, {
    method: "POST",
    // Form-encoded body is Twitch's documented form for this grant.
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    /*
     * Deliberately cached, not `no-store`.
     *
     * `/game/[slug]` is statically prerendered, and schema negotiation forces a
     * token exchange outside any `unstable_cache` boundary. A `no-store` fetch
     * opts the request out of caching "even if Request-time APIs are not
     * detected", which promotes the static route to dynamic *at runtime* — a
     * hard error in Next 16, so every affected detail page returned a 500.
     *
     * Caching is opt-in and covers POST with credentials, so `force-cache` plus
     * a lifetime is the documented way to make this request static-safe. It
     * also stops a cold lambda re-authenticating on every render.
     */
    cache: "force-cache",
    next: { revalidate: TOKEN_CACHE_SECONDS, tags: ["igdb-token"] },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((body: { message?: string }) => body?.message ?? "")
      .catch(() => "");
    throw new TokenError(res.status, detail);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new TokenError(res.status, "response had no access_token");

  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

/** Carries Twitch's status and message so callers can explain the failure. */
export class TokenError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`[igdb] token request failed: ${status}${detail ? ` — ${detail}` : ""}`);
    this.name = "TokenError";
  }
}

/** Increments on every forced refresh so each retry is its own cache entry. */
let tokenGeneration = 0;

async function getToken(forceRefresh = false): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("[igdb] not configured");

  if (forceRefresh) {
    tokenCache = null;
    tokenGeneration += 1;
  } else if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  // Collapse concurrent refreshes so a cold start doesn't fire one token
  // request per in-flight render.
  if (!tokenInFlight) {
    tokenInFlight = fetchToken(creds.clientId, creds.clientSecret, tokenGeneration).finally(
      () => {
        tokenInFlight = null;
      },
    );
  }
  return tokenInFlight;
}

/* ---------------------------------------------------------------------------
 * Transport
 * ------------------------------------------------------------------------ */

/** Carries the HTTP status so callers can tell *why* a query failed. */
export class IgdbHttpError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    readonly detail: string,
  ) {
    super(`[igdb] ${endpoint} → ${status} ${detail.slice(0, 240)}`);
    this.name = "IgdbHttpError";
  }
}

/*
 * Rate limiting.
 *
 * IGDB's free tier allows roughly four requests a second and answers anything
 * above that with a 429. Nothing here used to bound concurrency, so a single
 * homepage render (six parallel queries, each expanding covers and platforms)
 * or a `generateStaticParams` build sweep would burst straight through the
 * ceiling. Every 429 then surfaced as "IGDB can't answer", and the resolver
 * fell through to Steam — which is exactly the "everything is from Steam"
 * symptom, with working credentials the whole time.
 *
 * This is per-instance, not global, so it cannot guarantee the account-wide
 * rate. It removes the self-inflicted bursts, which are the dominant cause;
 * `retryAfter` handles whatever still slips through.
 */
const MAX_CONCURRENT = 3;
const MIN_SPACING_MS = 260;

let inFlight = 0;
let nextSlotAt = 0;
const waiting: Array<() => void> = [];

function pump() {
  while (inFlight < MAX_CONCURRENT && waiting.length > 0) {
    inFlight += 1;
    waiting.shift()!();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRateLimit<T>(run: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    waiting.push(resolve);
    pump();
  });

  // Space request *starts* so a burst of permitted-concurrency calls still
  // can't exceed the per-second ceiling.
  const now = Date.now();
  const startAt = Math.max(now, nextSlotAt);
  nextSlotAt = startAt + MIN_SPACING_MS;
  if (startAt > now) await sleep(startAt - now);

  try {
    return await run();
  } finally {
    inFlight -= 1;
    pump();
  }
}

/** How long to wait before retrying a 429, honouring Retry-After when sent. */
function retryDelayMs(res: Response, attempt: number): number {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 4000);
  // Otherwise back off geometrically from the spacing interval.
  return Math.min(MIN_SPACING_MS * 2 ** attempt, 4000);
}

const MAX_ATTEMPTS = 3;

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
      // Not `no-store`: see `fetchToken`. Caching is opt-in, so an uncached
      // POST is still fetched every time — without opting the whole route out
      // of static rendering. `queryFor` provides the real caching layer.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await withRateLimit(async () => {
      let response = await run(await getToken());
      // A revoked or expired token reads as 401; force a fresh one and retry.
      if (response.status === 401) {
        response = await run(await getToken(true));
      }
      return response;
    });

    if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new IgdbHttpError(res.status, endpoint, detail);
    }

    return (await res.json()) as T;
  }

  throw new IgdbHttpError(429, endpoint, "rate limited after retries");
}

/** One cached wrapper per TTL bucket; arguments form the rest of the key. */
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

/* ---------------------------------------------------------------------------
 * Schema negotiation
 * ------------------------------------------------------------------------ */

/**
 * Returns the first candidate field-set the API accepts.
 *
 * Probes with `limit 1` so the cost is one tiny request per field group, once
 * per server lifetime. An empty array is always the final candidate, meaning
 * "skip this data entirely" — losing one optional field is infinitely better
 * than failing every query.
 *
 * Only a 400 answers the question being asked. IGDB rejects an unknown field
 * with 400, so that genuinely means "this spelling is gone, try the next one".
 * Every other failure — 429, 5xx, a timeout — says nothing about the schema.
 * Treating those as rejection too was silently catastrophic: under rate
 * limiting all three candidates "failed", the empty set won, and the client
 * concluded IGDB had dropped `release_dates` and `age_ratings` entirely. Those
 * fields were then stripped from every query for the life of the server, so
 * release dates and age ratings vanished site-wide until the next deploy.
 * Rethrowing instead lets `schema()` discard the attempt and probe again.
 */
async function negotiate(label: string, candidates: string[][]): Promise<string[]> {
  for (const fields of candidates) {
    if (fields.length === 0) {
      console.warn(`[igdb] no supported spelling for ${label}; omitting`);
      return [];
    }
    try {
      await rawQuery("games", `fields ${fields.join(",")};\nlimit 1;`);
      return fields;
    } catch (err) {
      if (err instanceof IgdbHttpError && err.status === 400) continue;
      throw err;
    }
  }
  return [];
}

let schemaPromise: Promise<{ release: string[]; ageRating: string[] }> | null = null;

function schema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [release, ageRating] = await Promise.all([
        negotiate("release_dates", [
          ["release_dates.date_format", "release_dates.date", "release_dates.human"],
          ["release_dates.category", "release_dates.date", "release_dates.human"],
          [],
        ]),
        negotiate("age_ratings", [
          ["age_ratings.rating_category", "age_ratings.organization"],
          ["age_ratings.category", "age_ratings.rating"],
          [],
        ]),
      ]);
      return { release, ageRating };
    })().catch((err) => {
      // Never cache a rejected probe — a transient outage would otherwise
      // permanently strip these fields for the life of the server.
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/* ---------------------------------------------------------------------------
 * Query building
 * ------------------------------------------------------------------------ */

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

/** Fields present in every IGDB revision we support. */
const CORE_SUMMARY = [
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
  "aggregated_rating",
  "aggregated_rating_count",
  "rating",
  "rating_count",
  "total_rating",
  "total_rating_count",
  "hypes",
  "status",
  // Needed by the homepage hero, which autoplays a trailer straight from a
  // list query rather than fetching each game's full record.
  "videos.video_id",
  "videos.name",
];

const CORE_DETAIL = [
  ...CORE_SUMMARY,
  "summary",
  "storyline",
  "url",
  "artworks.image_id",
  "themes.name",
  "themes.slug",
  "game_modes.name",
  "game_modes.slug",
  "player_perspectives.name",
  "player_perspectives.slug",
  "game_engines.name",
  "game_engines.slug",
  "franchises.name",
  "franchises.slug",
  "collections.name",
  "collections.slug",
  "involved_companies.developer",
  "involved_companies.publisher",
  "involved_companies.porting",
  "involved_companies.supporting",
  "involved_companies.company.name",
  "involved_companies.company.slug",
  "alternative_names.name",
  "language_supports.language.name",
  "multiplayer_modes.campaigncoop",
  "multiplayer_modes.dropin",
  "multiplayer_modes.lancoop",
  "multiplayer_modes.offlinecoop",
  "multiplayer_modes.onlinecoop",
  "multiplayer_modes.splitscreen",
  "multiplayer_modes.onlinemax",
  "multiplayer_modes.offlinemax",
  "dlcs.name",
  "dlcs.slug",
  "expansions.name",
  "expansions.slug",
  "similar_games.name",
  "similar_games.slug",
  "similar_games.cover.image_id",
  "similar_games.first_release_date",
  "similar_games.total_rating",
  "similar_games.aggregated_rating",
  "similar_games.genres.name",
  "similar_games.genres.slug",
  "similar_games.platforms.name",
  "similar_games.platforms.slug",
  // Store links are classified by hostname rather than a category enum, which
  // has been renamed across revisions. The URL itself never changes shape.
  "websites.url",
];

async function summaryFields(): Promise<string> {
  const { release } = await schema();
  return [...CORE_SUMMARY, ...release].join(",");
}

async function detailFields(): Promise<string> {
  const { release, ageRating } = await schema();
  return [...CORE_DETAIL, ...release, ...ageRating].join(",");
}

/**
 * Excludes DLC, expansions, bundles and alternate editions.
 *
 * Filters on `parent_game` / `version_parent`, whose names have been stable
 * across revisions, rather than the `category` enum which has not.
 */
const MAIN_GAMES = "parent_game = null & version_parent = null";

/* ---------------------------------------------------------------------------
 * Payload shapes
 * ------------------------------------------------------------------------ */

interface IgdbNamed {
  id: number;
  name: string;
  slug?: string;
}

interface IgdbReleaseDate {
  /** Modern spelling. 0 = exact day, 1 = month, 2 = year, 3–6 = quarters, 7 = TBD. */
  date_format?: number;
  /** Legacy spelling of the same enum. */
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
  artworks?: { image_id?: string }[];
  videos?: { video_id?: string; name?: string }[];
  genres?: IgdbNamed[];
  themes?: IgdbNamed[];
  game_modes?: IgdbNamed[];
  player_perspectives?: IgdbNamed[];
  game_engines?: IgdbNamed[];
  franchises?: IgdbNamed[];
  collections?: IgdbNamed[];
  platforms?: (IgdbNamed & { abbreviation?: string })[];
  release_dates?: IgdbReleaseDate[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    porting?: boolean;
    supporting?: boolean;
    company?: IgdbNamed;
  }[];
  alternative_names?: { name?: string }[];
  language_supports?: { language?: { name?: string } }[];
  multiplayer_modes?: {
    campaigncoop?: boolean;
    dropin?: boolean;
    lancoop?: boolean;
    offlinecoop?: boolean;
    onlinecoop?: boolean;
    splitscreen?: boolean;
    onlinemax?: number;
    offlinemax?: number;
  }[];
  dlcs?: IgdbNamed[];
  expansions?: IgdbNamed[];
  similar_games?: IgdbGame[];
  websites?: { url?: string }[];
  age_ratings?: {
    rating_category?: number | { rating?: string };
    organization?: number | { name?: string };
    category?: number;
    rating?: number;
  }[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  hypes?: number;
  status?: number;
}

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
 * Platform families
 * ------------------------------------------------------------------------ */

const FAMILY_IDS: Record<PlatformKey, number> = {
  pc: 1, playstation: 2, xbox: 3, nintendo: 4, mac: 5, linux: 6, mobile: 7, web: 8,
};

const FAMILY_NAMES: Record<PlatformKey, string> = {
  pc: "PC", playstation: "PlayStation", xbox: "Xbox", nintendo: "Nintendo",
  mac: "macOS", linux: "Linux", mobile: "Mobile", web: "Browser",
};

export const PLATFORM_FAMILIES: Ref[] = (
  ["pc", "playstation", "xbox", "nintendo", "mac", "linux", "mobile"] as PlatformKey[]
).map((key) => ({ id: FAMILY_IDS[key], slug: key, name: FAMILY_NAMES[key] }));

/** IGDB has its own platform vocabulary; collapse it to our icon families. */
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

const toRefs = (items: IgdbNamed[] | undefined): Ref[] =>
  (items ?? []).map((item) => ({
    id: item.id,
    slug: item.slug ?? String(item.id),
    name: item.name,
  }));

/* ---------------------------------------------------------------------------
 * Release resolution
 * ------------------------------------------------------------------------ */

const isoFromUnix = (seconds: number): string =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * Resolves a release into an exact ISO date or a human window.
 *
 * `first_release_date` carries a full timestamp even when only a quarter is
 * known, so trusting it blindly would render "Oct 1, 2026" for a game dated
 * only "Q4 2026". The `release_dates` entries carry a precision enum — under
 * either spelling — so the earliest of those wins; the bare timestamp is a last
 * resort.
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
  const precision = earliest?.date_format ?? earliest?.category;

  if (earliest && typeof precision === "number") {
    if (precision === 0 && typeof earliest.date === "number") {
      return { released: isoFromUnix(earliest.date), releaseWindow: null, tba: false };
    }
    if (precision === 7) {
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

/* ---------------------------------------------------------------------------
 * Age ratings
 * ------------------------------------------------------------------------ */

const ESRB_LEGACY: Record<number, string> = {
  6: "RP", 7: "EC", 8: "E", 9: "E10+", 10: "T", 11: "M", 12: "AO",
};
const PEGI_LEGACY: Record<number, string> = {
  1: "3", 2: "7", 3: "12", 4: "16", 5: "18",
};

function mapAgeRatings(game: IgdbGame): AgeRating[] {
  const out: AgeRating[] = [];
  for (const entry of game.age_ratings ?? []) {
    // Modern spelling expands to objects; legacy returns bare enum ids.
    const modernRating =
      typeof entry.rating_category === "object" ? entry.rating_category?.rating : undefined;
    const modernOrg =
      typeof entry.organization === "object" ? entry.organization?.name : undefined;

    if (modernRating && modernOrg) {
      out.push({ organization: modernOrg, rating: modernRating });
      continue;
    }

    if (typeof entry.category === "number" && typeof entry.rating === "number") {
      if (entry.category === 1 && ESRB_LEGACY[entry.rating]) {
        out.push({ organization: "ESRB", rating: ESRB_LEGACY[entry.rating] });
      } else if (entry.category === 2 && PEGI_LEGACY[entry.rating]) {
        out.push({ organization: "PEGI", rating: PEGI_LEGACY[entry.rating] });
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Mapping
 * ------------------------------------------------------------------------ */

/** Drops cancelled titles, which IGDB keeps in the index with status 6. */
const CANCELLED = 6;

/** IGDB hosts no media itself — `video_id` is always a YouTube id. */
function toTrailers(game: IgdbGame): Trailer[] {
  return (game.videos ?? [])
    .filter((video) => video.video_id)
    .slice(0, 6)
    .map((video, index) => ({
      id: index,
      name: video.name?.trim() || "Trailer",
      kind: "youtube" as const,
      youtubeId: video.video_id!,
      preview: `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${video.video_id}`,
    }));
}

function mapSummary(game: IgdbGame): GameSummary {
  const release = resolveRelease(game);
  const ratings = mapAgeRatings(game);

  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    ...release,
    image: igdbImage(game.cover?.image_id, "cover_big_2x"),
    imageFallback: null,
    // IGDB user ratings are 0–100; the UI's star scale is 0–5.
    rating: typeof game.rating === "number" ? Math.round((game.rating / 20) * 10) / 10 : 0,
    ratingsCount: game.rating_count ?? 0,
    metacritic:
      typeof game.aggregated_rating === "number" ? Math.round(game.aggregated_rating) : null,
    platforms: toRefs(game.platforms),
    parentPlatforms: toFamilies(game.platforms),
    genres: toRefs(game.genres),
    screenshots: (game.screenshots ?? [])
      .map((shot) => igdbImage(shot.image_id, "screenshot_huge"))
      .filter((url): url is string => Boolean(url)),
    esrb: ratings.find((r) => r.organization.toUpperCase().includes("ESRB"))?.rating ?? null,
    heroTrailer: toTrailers(game).at(0) ?? null,
    playtime: 0,
    // `hypes` counts pre-release anticipation, `total_rating_count` post-release
    // engagement. Either is a reasonable popularity proxy for its lifecycle stage.
    added: game.total_rating_count ?? game.hypes ?? 0,
  };
}

function mapDetail(game: IgdbGame): GameDetail {
  const summary = mapSummary(game);

  const companiesWhere = (predicate: (entry: NonNullable<IgdbGame["involved_companies"]>[number]) => boolean) =>
    (game.involved_companies ?? [])
      .filter((entry) => predicate(entry) && entry.company)
      .map((entry) => ({
        id: entry.company!.id,
        slug: entry.company!.slug ?? String(entry.company!.id),
        name: entry.company!.name,
      }));

  const trailers = toTrailers(game);

  const description = [game.summary?.trim(), game.storyline?.trim()]
    .filter(Boolean)
    .join("\n\n");

  // Websites are classified by hostname, which is stable across API revisions
  // and also yields the Steam appid without a separate lookup.
  const websites: WebsiteRef[] = [];
  const stores: StoreRef[] = [];
  let steamAppId: number | null = null;
  let officialSite: string | null = null;

  for (const site of game.websites ?? []) {
    if (!site.url) continue;
    const classified = storeFromUrl(site.url);
    if (classified) {
      if (!stores.some((s) => s.slug === classified.slug)) {
        stores.push({
          id: stores.length + 1,
          slug: classified.slug,
          name: classified.name,
          domain: classified.domain,
          url: site.url,
        });
      }
      if (classified.slug === "steam" && classified.steamAppId) {
        steamAppId = classified.steamAppId;
      }
    } else if (!officialSite) {
      officialSite = site.url;
    }
    websites.push({ kind: classified?.slug ?? "official", url: site.url });
  }

  const multiplayer = game.multiplayer_modes?.[0];
  const multiplayerModes: MultiplayerModes | null = multiplayer
    ? {
        campaignCoop: Boolean(multiplayer.campaigncoop),
        dropIn: Boolean(multiplayer.dropin),
        lanCoop: Boolean(multiplayer.lancoop),
        offlineCoop: Boolean(multiplayer.offlinecoop),
        onlineCoop: Boolean(multiplayer.onlinecoop),
        splitScreen: Boolean(multiplayer.splitscreen),
        onlineMax: multiplayer.onlinemax ?? null,
        offlineMax: multiplayer.offlinemax ?? null,
      }
    : null;

  return {
    ...summary,
    description,
    storyline: game.storyline?.trim() || null,
    steamAppId,
    price: null,
    website: officialSite,
    developers: companiesWhere((entry) => Boolean(entry.developer)),
    publishers: companiesWhere((entry) => Boolean(entry.publisher)),
    supportingStudios: companiesWhere(
      (entry) => Boolean(entry.porting) || Boolean(entry.supporting),
    ),
    tags: [...toRefs(game.themes), ...toRefs(game.game_modes)].slice(0, 18),
    themes: toRefs(game.themes),
    gameModes: toRefs(game.game_modes),
    playerPerspectives: toRefs(game.player_perspectives),
    engines: toRefs(game.game_engines),
    franchises: [...toRefs(game.franchises), ...toRefs(game.collections)],
    ageRatings: mapAgeRatings(game),
    languages: [
      ...new Set(
        (game.language_supports ?? [])
          .map((entry) => entry.language?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    ],
    multiplayerModes,
    artworks: (game.artworks ?? [])
      .map((art) => igdbImage(art.image_id, "1080p"))
      .filter((url): url is string => Boolean(url)),
    expansions: [...toRefs(game.dlcs), ...toRefs(game.expansions)],
    similar: (game.similar_games ?? [])
      .filter((candidate) => candidate?.slug && candidate.status !== CANCELLED)
      .map(mapSummary),
    totalRating:
      typeof game.total_rating === "number" ? Math.round(game.total_rating) : null,
    hypes: game.hypes ?? 0,
    websites,
    stores,
    requirements: [],
    trailers,
    redditUrl: null,
    metacriticUrl: null,
    alternativeNames: (game.alternative_names ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name)),
  };
}

/* ---------------------------------------------------------------------------
 * Taxonomy
 * ------------------------------------------------------------------------ */

async function fetchGenres(): Promise<Ref[]> {
  const query = queryFor(TTL.taxonomy);
  const rows = await query<IgdbNamed[]>(
    "genres",
    apicalypse({ fields: "name,slug", sort: "name asc", limit: 60 }),
  );
  return toRefs(rows);
}

async function fetchThemes(): Promise<Ref[]> {
  const query = queryFor(TTL.taxonomy);
  const rows = await query<IgdbNamed[]>(
    "themes",
    apicalypse({ fields: "name,slug", sort: "name asc", limit: 60 }),
  );
  return toRefs(rows);
}

async function fetchPlatformIndex(): Promise<IgdbNamed[]> {
  const query = queryFor(TTL.taxonomy);
  return query<IgdbNamed[]>(
    "platforms",
    apicalypse({ fields: "name,slug,abbreviation", sort: "name asc", limit: 500 }),
  );
}

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

const usable = (games: IgdbGame[]) => games.filter((game) => game.status !== CANCELLED);

async function listGames(parts: Omit<QueryParts, "fields">, revalidate: number) {
  const query = queryFor(revalidate);
  const rows = await query<IgdbGame[]>(
    "games",
    apicalypse({ ...parts, fields: await summaryFields() }),
  );
  return usable(rows).map(mapSummary);
}

async function countGames(where: string, revalidate: number): Promise<number> {
  const query = queryFor(revalidate);
  const result = await query<{ count?: number }>("games/count", `where ${where};`);
  return result?.count ?? 0;
}

/** Total number of main games in IGDB. Surfaced on the homepage. */
export async function igdbTotalGames(): Promise<number | null> {
  if (!igdbConfigured()) return null;
  try {
    return await countGames(MAIN_GAMES, TTL.taxonomy);
  } catch (err) {
    warn("count", err);
    return null;
  }
}

function sortClause(ordering: BrowseFilters["ordering"]): string | undefined {
  switch (ordering) {
    case "released":
      return "first_release_date asc";
    case "-released":
      return "first_release_date desc";
    case "-rating":
      return "total_rating desc";
    case "-metacritic":
      return "aggregated_rating desc";
    case "name":
      return "name asc";
    case "-name":
      return "name desc";
    case "-hypes":
      return "hypes desc";
    case "-added":
    default:
      return "total_rating_count desc";
  }
}

/** Filter clauses shared by browse and the upcoming calendar. */
async function buildWhere(filters: BrowseFilters): Promise<string | null> {
  const clauses = [MAIN_GAMES];

  if (filters.genres) {
    const ids = await genreIdsForSlugs(filters.genres.split(",").filter(Boolean));
    if (ids.length === 0) return null;
    clauses.push(`genres = (${ids.join(",")})`);
  }

  if (filters.platforms) {
    const ids = await platformIdsForFamilies(filters.platforms.split(",").filter(Boolean));
    if (ids.length === 0) return null;
    clauses.push(`platforms = (${ids.join(",")})`);
  }

  if (filters.dates) {
    const [from, to] = filters.dates.split(",");
    const toUnix = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 1000);
    clauses.push(
      `first_release_date >= ${toUnix(from)} & first_release_date <= ${toUnix(to)}`,
    );
  }

  if (filters.metacritic) {
    const [lo, hi] = filters.metacritic.split(",").map(Number);
    clauses.push(`aggregated_rating >= ${lo} & aggregated_rating <= ${hi}`);
  }

  return clauses.join(" & ");
}

/** Strips punctuation and case so "Marvel's Spider-Man" matches "marvels spiderman". */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Re-ranks IGDB search results against the query the reader actually typed.
 *
 * Scoring, strongest signal first: an exact title match, then a prefix match,
 * then whole-word containment, then a loose substring. Popularity only breaks
 * ties — it must never let a famous unrelated game outrank the precise answer,
 * which is the usual failure mode of naive relevance sorting.
 *
 * Recognisable titles are additionally nudged up within a tier, because IGDB's
 * index contains a long tail of near-identically-named shovelware.
 */
export function rankSearchResults(games: GameSummary[], query: string): GameSummary[] {
  const q = normalise(query);
  if (!q) return games;

  const tierOf = (name: string): number => {
    const n = normalise(name);
    if (n === q) return 0;
    if (n.startsWith(`${q} `) || n.startsWith(q)) return 1;
    if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(n)) return 2;
    if (n.includes(q)) return 3;
    return 4;
  };

  return [...games]
    .map((game, index) => ({ game, index, tier: tierOf(game.name) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      // Within a tier, prefer titles people actually engage with…
      const engagement = b.game.added - a.game.added;
      if (engagement !== 0) return engagement;
      // …then fall back to IGDB's own ordering rather than reshuffling.
      return a.index - b.index;
    })
    .map((entry) => entry.game);
}

export const igdbProvider: GameProvider = {
  id: "igdb",

  isConfigured: igdbConfigured,

  async browse(filters: BrowseFilters) {
    if (!igdbConfigured()) return null;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = filters.pageSize ?? 24;

    try {
      const where = await buildWhere(filters);
      // An unmatched filter is unsatisfiable, not an error — report zero
      // results rather than silently dropping the filter.
      if (where === null) return { results: [], count: 0, hasNext: false, page };

      const revalidate = filters.search ? TTL.search : TTL.list;
      const term = filters.search?.trim();

      if (term) {
        // IGDB scores `search` internally and forbids combining it with `sort`,
        // and its raw ordering routinely puts editions, bundles and loosely
        // related titles above the obvious answer. Over-fetch, then re-rank
        // locally against the actual query so the exact title wins.
        const overFetch = Math.min(200, pageSize * 4);
        const pool = await listGames(
          { search: term, where, limit: overFetch },
          revalidate,
        );

        const ranked = rankSearchResults(pool, term);
        const start = (page - 1) * pageSize;
        return {
          results: ranked.slice(start, start + pageSize),
          count: ranked.length,
          hasNext: start + pageSize < ranked.length,
          page,
        };
      }

      const results = await listGames(
        {
          where,
          sort: sortClause(filters.ordering),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        revalidate,
      );

      return {
        results,
        count: await countGames(where, revalidate),
        hasNext: results.length >= pageSize,
        page,
      };
    } catch (err) {
      warn("browse", err);
      return null;
    }
  },

  async upcoming(pageSize: number, page: number, filters: BrowseFilters = {}) {
    if (!igdbConfigured()) return null;
    try {
      const base = await buildWhere(filters);
      if (base === null) return { results: [], count: 0, hasNext: false, page };
      const where = `${base} & first_release_date > ${nowSeconds()}`;
      const results = await listGames(
        {
          where,
          // Soonest-first is the only sensible default for a calendar.
          sort: sortClause(filters.ordering ?? "released"),
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
    if (!igdbConfigured()) return null;
    try {
      return await listGames(
        {
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
    if (!igdbConfigured()) return null;
    try {
      return await listGames(
        {
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
    if (!igdbConfigured()) return null;
    try {
      return await listGames(
        {
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
    if (!igdbConfigured()) return null;
    try {
      const query = queryFor(TTL.detail);
      const rows = await query<IgdbGame[]>(
        "games",
        apicalypse({
          fields: await detailFields(),
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
    if (!igdbConfigured()) return null;
    // IGDB curates `similar_games` itself, and the detail query already
    // expanded it — no second request needed.
    if (game.similar.length > 0) return game.similar.slice(0, limit);
    if (game.genres.length === 0) return [];

    try {
      const ids = game.genres.map((genre) => genre.id).join(",");
      const results = await listGames(
        {
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
    if (!igdbConfigured()) return null;
    try {
      return await fetchGenres();
    } catch (err) {
      warn("genres", err);
      return null;
    }
  },

  async platforms() {
    if (!igdbConfigured()) return null;
    // Families rather than IGDB's ~200 individual platforms: filtering by
    // "PlayStation" is what people mean, not "PlayStation Vita" specifically.
    return PLATFORM_FAMILIES;
  },
};

/** Themes power the recommendation engine's taste profile. */
export async function igdbThemes(): Promise<Ref[] | null> {
  if (!igdbConfigured()) return null;
  try {
    return await fetchThemes();
  } catch (err) {
    warn("themes", err);
    return null;
  }
}

/**
 * Games matching a taste profile, excluding anything already seen.
 *
 * Used by the recommendation rail: the caller derives genre and theme ids from
 * a user's library, and this returns well-regarded matches they don't have.
 */
export async function igdbRecommend(input: {
  genreIds: number[];
  themeIds: number[];
  platformSlugs: string[];
  excludeIds: number[];
  limit: number;
}): Promise<GameSummary[] | null> {
  if (!igdbConfigured()) return null;
  try {
    const clauses = [MAIN_GAMES, "total_rating_count > 12", "aggregated_rating > 70"];
    if (input.genreIds.length > 0) clauses.push(`genres = (${input.genreIds.join(",")})`);
    if (input.themeIds.length > 0) clauses.push(`themes = (${input.themeIds.join(",")})`);
    if (input.platformSlugs.length > 0) {
      const ids = await platformIdsForFamilies(input.platformSlugs);
      if (ids.length > 0) clauses.push(`platforms = (${ids.join(",")})`);
    }
    if (input.excludeIds.length > 0) {
      clauses.push(`id != (${input.excludeIds.join(",")})`);
    }

    return await listGames(
      { where: clauses.join(" & "), sort: "total_rating desc", limit: input.limit },
      TTL.list,
    );
  } catch (err) {
    warn("recommend", err);
    return null;
  }
}

export interface IgdbDiagnostics {
  ok: boolean;
  configured: boolean;
  /** Whether the Twitch OAuth exchange succeeded. */
  authenticated: boolean;
  /** Whether a real query returned rows. */
  querying: boolean;
  problem: string | null;
  /** Plain-language next step, when something is wrong. */
  hint: string | null;
}

/**
 * Reports exactly where the IGDB pipeline breaks.
 *
 * Deliberately never returns the credentials themselves — only whether each
 * stage succeeded, plus an actionable hint. This exists because a silent
 * provider failure is close to undiagnosable from a deployed site otherwise.
 */
export async function igdbDiagnostics(): Promise<IgdbDiagnostics> {
  const base: IgdbDiagnostics = {
    ok: false,
    configured: false,
    authenticated: false,
    querying: false,
    problem: null,
    hint: null,
  };

  if (!igdbConfigured()) {
    return {
      ...base,
      problem: "IGDB_CLIENT_ID and/or IGDB_CLIENT_SECRET are not set.",
      hint: "Add both to your environment (Vercel → Settings → Environment Variables), then redeploy.",
    };
  }

  try {
    await getToken();
  } catch (err) {
    if (err instanceof TokenError) {
      const hint =
        err.status === 403
          ? "The client id is valid but the secret is wrong — most likely it was rotated. Generate a new secret at dev.twitch.tv/console/apps and update IGDB_CLIENT_SECRET, then redeploy."
          : err.status === 400
            ? "Twitch doesn't recognise this client id. Check IGDB_CLIENT_ID matches your app at dev.twitch.tv/console/apps."
            : "Twitch rejected the token request. Check the credentials and try again shortly.";
      return { ...base, configured: true, problem: err.message, hint };
    }
    return {
      ...base,
      configured: true,
      problem: err instanceof Error ? err.message : String(err),
      hint: "Couldn't reach Twitch to authenticate. This is usually transient.",
    };
  }

  try {
    const rows = await rawQuery<unknown[]>("games", "fields name; limit 1;");
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ...base,
        configured: true,
        authenticated: true,
        problem: "Authenticated, but a test query returned no rows.",
        hint: "The credentials work; IGDB may be rate-limiting. Try again shortly.",
      };
    }
  } catch (err) {
    return {
      ...base,
      configured: true,
      authenticated: true,
      problem: err instanceof Error ? err.message : String(err),
      hint: "Authentication works but queries are failing — likely a rate limit or an API change.",
    };
  }

  return { ok: true, configured: true, authenticated: true, querying: true, problem: null, hint: null };
}

function warn(operation: string, err: unknown) {
  console.warn(`[igdb] ${operation} failed:`, err instanceof Error ? err.message : err);
}
