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
  /**
   * Providers differ in what they can hand us: Steam hosts real MP4s, while
   * IGDB only stores YouTube ids. The player branches on this rather than
   * guessing from the URL.
   */
  kind: "mp4" | "youtube";
  /** Set only when `kind` is "youtube". */
  youtubeId?: string;
  preview: string | null;
  /** Direct media URL for MP4, or the watch URL for YouTube. */
  url: string | null;
}

export interface Requirement {
  platform: string;
  minimum: string | null;
  recommended: string | null;
}

export interface AgeRating {
  /** e.g. "ESRB", "PEGI", "USK". */
  organization: string;
  /** e.g. "M", "18". */
  rating: string;
}

export interface WebsiteRef {
  /** Store/social slug from `classifyUrl`, or "official". */
  kind: string;
  url: string;
}

export interface MultiplayerModes {
  campaignCoop: boolean;
  dropIn: boolean;
  lanCoop: boolean;
  offlineCoop: boolean;
  onlineCoop: boolean;
  splitScreen: boolean;
  onlineMax: number | null;
  offlineMax: number | null;
}

export interface Price {
  /** Already formatted for display in the store's currency, e.g. "$59.99". */
  current: string;
  /** Pre-discount price, when the title is on sale. */
  original: string | null;
  /** 0 when not discounted. */
  discountPercent: number;
  isFree: boolean;
}

export interface GameSummary {
  id: number;
  slug: string;
  name: string;
  /**
   * ISO `YYYY-MM-DD`, and only ever set when the source gave us a genuine
   * day-level date. Never synthesised from a looser window.
   */
  released: string | null;
  /**
   * Human label for a known-but-imprecise date — "Q4 2026", "March 2026",
   * "2027". Set when a source has committed to a window but not a day.
   * Rendering this instead of inventing a day is the difference between an
   * honest release calendar and a misleading one.
   */
  releaseWindow: string | null;
  /** No date information at all: announced, but nothing scheduled. */
  tba: boolean;
  /**
   * Preferred poster. Portrait 3:4 wherever the provider has one, since that is
   * the shape every card renders at.
   */
  image: string | null;
  /**
   * Used when `image` fails to load. Steam's portrait library capsule is the
   * best-looking asset it has but is missing for a minority of apps, so the
   * guaranteed 16:9 header sits behind it rather than being used by default.
   */
  imageFallback: string | null;
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
  /** Narrative premise, kept separate from the marketing summary. */
  storyline: string | null;
  /**
   * Steam application id, when this title is known to have a Steam listing.
   * IGDB publishes it via `external_games`, which is what lets an IGDB record
   * be enriched with Steam's pricing and system requirements.
   */
  steamAppId: number | null;
  /** Storefront pricing, when a provider exposes it. */
  price: Price | null;
  website: string | null;
  developers: Ref[];
  publishers: Ref[];
  supportingStudios: Ref[];
  tags: Ref[];
  themes: Ref[];
  gameModes: Ref[];
  playerPerspectives: Ref[];
  engines: Ref[];
  /** Franchises and collections merged — both answer "what series is this?". */
  franchises: Ref[];
  ageRatings: AgeRating[];
  languages: string[];
  multiplayerModes: MultiplayerModes | null;
  /** Key art, distinct from in-game screenshots. */
  artworks: string[];
  /** DLC and expansions. */
  expansions: Ref[];
  /** Provider-curated similar titles, already expanded. */
  similar: GameSummary[];
  /** Combined critic + user score, 0–100. */
  totalRating: number | null;
  /** Pre-release anticipation count. */
  hypes: number;
  websites: WebsiteRef[];
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
  | "-hypes"
  | "name"
  | "-name";

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

/**
 * Which provider answered a request. Surfaced in the UI so the data's origin is
 * always attributable, and so sample mode can label itself.
 */
export type DataSource = "igdb" | "steam" | "sample";

export const SOURCE_LABELS: Record<DataSource, string> = {
  igdb: "IGDB",
  steam: "Steam",
  sample: "Sample catalogue",
};

export const isLiveSource = (source: DataSource): boolean => source !== "sample";

export interface Sourced<T> {
  data: T;
  source: DataSource;
}
