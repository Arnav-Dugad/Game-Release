/**
 * Normalised game model.
 *
 * Everything in the UI speaks this shape — never a raw RAWG payload. That
 * boundary is what lets the bundled sample catalogue and the live API be
 * swapped without a single component changing.
 */

export interface Ref {
  id: number;
  slug: string;
  name: string;
}

export interface StoreRef extends Ref {
  domain: string | null;
  url: string | null;
}

export interface Trailer {
  id: number;
  name: string;
  preview: string | null;
  /** Direct MP4. RAWG serves these; YouTube embeds are not used. */
  url: string | null;
}

export interface Requirement {
  platform: string;
  minimum: string | null;
  recommended: string | null;
}

export interface GameSummary {
  id: number;
  slug: string;
  name: string;
  /** ISO `YYYY-MM-DD`, or null when the date is unannounced. */
  released: string | null;
  /** True when the studio has announced the game but not a date. */
  tba: boolean;
  image: string | null;
  /** 0–5 user score. */
  rating: number;
  ratingsCount: number;
  /** 0–100 critic score, or null when unscored. */
  metacritic: number | null;
  platforms: Ref[];
  parentPlatforms: Ref[];
  genres: Ref[];
  screenshots: string[];
  esrb: string | null;
  /** Median hours to complete, per RAWG. */
  playtime: number;
  /** RAWG's popularity signal — how many users have it in a library. */
  added: number;
}

export interface GameDetail extends GameSummary {
  description: string;
  website: string | null;
  developers: Ref[];
  publishers: Ref[];
  tags: Ref[];
  stores: StoreRef[];
  requirements: Requirement[];
  trailers: Trailer[];
  redditUrl: string | null;
  metacriticUrl: string | null;
  alternativeNames: string[];
}

export interface Page<T> {
  results: T[];
  count: number;
  hasNext: boolean;
  page: number;
}

export type SortKey =
  | "relevance"
  | "released"
  | "-released"
  | "-added"
  | "-rating"
  | "-metacritic"
  | "name";

export interface BrowseFilters {
  search?: string;
  genres?: string;
  platforms?: string;
  ordering?: SortKey;
  dates?: string;
  page?: number;
  pageSize?: number;
  metacritic?: string;
}

/** Which backend answered a request — surfaced in the UI as a data-source badge. */
export type DataSource = "live" | "sample";

export interface Sourced<T> {
  data: T;
  source: DataSource;
}
