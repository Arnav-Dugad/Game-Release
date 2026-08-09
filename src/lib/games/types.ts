/**
 * Normalised game model.
 *
 * Everything in the UI speaks this shape — never a raw RAWG payload. That
 * boundary is what lets providers be swapped or added without a single
 * component changing.
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
  /**
   * Why the board gave that rating — "Blood and Gore", "Strong Language".
   * Empty when the board publishes none, which is common outside ESRB/PEGI.
   */
  descriptors: string[];
}

/**
 * A company, platform or engine that has a brand mark on IGDB.
 *
 * `logo` is IGDB's own asset rather than a bundled icon, so it covers the long
 * tail of studios no icon set will ever have. Null when IGDB has none, which
 * the UI must handle rather than render a broken image.
 */
export interface LogoRef extends Ref {
  logo: string | null;
}

/** A directory entry with enough context to rank and describe it. */
export interface DirectoryRef extends Ref {
  logo?: string | null;
  gameCount: number;
}

/** A studio's role on a specific game. */
export interface CompanyRef extends LogoRef {
  developer: boolean;
  publisher: boolean;
  porting: boolean;
  supporting: boolean;
  /** The studio's own site, when IGDB has it. */
  website: string | null;
}

/** A platform, with IGDB's mark and the family it rolls up to. */
export interface PlatformRef extends LogoRef {
  /** Icon family slug — "playstation", "xbox" — for the bundled brand icons. */
  family: string | null;
  abbreviation: string | null;
  /** e.g. "console", "portable", "computer". */
  category: string | null;
  generation: number | null;
}

/** One dated release, for a specific region and platform. */
export interface ReleaseEvent {
  /** ISO `YYYY-MM-DD`, or null when only a window is known. */
  date: string | null;
  /** Human label as IGDB renders it — "Q4 2026", "Feb 25, 2022". */
  human: string;
  /** "North America", "Europe", "Japan", … or null when unspecified. */
  region: string | null;
  platform: string | null;
}

/** A named character appearing in a game. */
export interface CharacterRef extends Ref {
  description: string | null;
  /** Portrait, IGDB's "mug shot". */
  image: string | null;
  species: string | null;
  gender: string | null;
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
  /**
   * IGDB's own popularity signal, recomputed daily from page visits and list
   * additions. Distinct from `added`, which counts library saves: this reflects
   * what people are *looking at* right now, which is what "trending" means.
   * Null when IGDB has no score for the title.
   */
  popScore: number | null;
  /**
   * A single trailer, carried on the summary so list views can autoplay one
   * without fetching the full detail record. Null when the provider has none.
   */
  heroTrailer: Trailer | null;
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
  website: string | null;
  /** Every involved studio with its role and brand mark. */
  companies: CompanyRef[];
  developers: Ref[];
  publishers: Ref[];
  supportingStudios: Ref[];
  tags: Ref[];
  themes: Ref[];
  gameModes: Ref[];
  playerPerspectives: Ref[];
  engines: LogoRef[];
  /** Canonical release series from IGDB Collections. */
  series: Ref[];
  /** Wider fictional/product franchises; intentionally separate from series. */
  franchises: Ref[];
  /** Free-form IGDB keywords, useful for discovery beyond formal genres. */
  keywords: Ref[];
  ageRatings: AgeRating[];
  languages: string[];
  multiplayerModes: MultiplayerModes | null;
  /** Key art, distinct from in-game screenshots. */
  artworks: string[];
  /** Platforms with IGDB marks and hardware metadata. */
  platformDetails: PlatformRef[];
  /** Per-region, per-platform release dates. */
  releases: ReleaseEvent[];
  /** Named cast, when IGDB has character records for the title. */
  characters: CharacterRef[];
  /** Downloadable content that depends on the base game. */
  dlcs: GameSummary[];
  /** Non-standalone expansions that depend on the base game. */
  expansions: GameSummary[];
  /** Expansions that are sold and played as their own games. */
  standaloneExpansions: GameSummary[];
  /** Alternate editions/versions of the same game. */
  editions: GameSummary[];
  bundles: GameSummary[];
  remakes: GameSummary[];
  remasters: GameSummary[];
  ports: GameSummary[];
  /** The base game, when this record is itself a DLC or expansion. */
  parentGame: Ref | null;
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
  /**
   * Drop titles nobody is following.
   *
   * IGDB lists every announced game, and roughly two thirds of the upcoming
   * calendar has zero anticipation and no audience — asset-flip shovelware
   * scheduled against placeholder dates. Chronologically it is all perfectly
   * valid, which is exactly the problem: page after page of it looks identical
   * and buries the releases anyone is actually waiting for.
   */
  notableOnly?: boolean;
}

/**
 * Which provider answered a request. Surfaced in the UI so the data's origin is
 * always attributable, and so a total outage can be told apart from a
 * legitimately empty result.
 */
export type DataSource = "igdb" | "steam" | "unavailable";

export const SOURCE_LABELS: Record<DataSource, string> = {
  igdb: "IGDB",
  steam: "Steam",
  unavailable: "Live data unavailable",
};

export const isLiveSource = (source: DataSource): boolean => source !== "unavailable";

export interface Sourced<T> {
  data: T;
  source: DataSource;
}
