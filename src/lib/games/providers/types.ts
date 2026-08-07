import type {
  BrowseFilters,
  DataSource,
  GameDetail,
  GameSummary,
  Page,
  Ref,
} from "../types";

/**
 * A game data backend.
 *
 * Every method returns `null` to mean "I can't answer this" — unconfigured,
 * rate-limited, timed out, or simply not capable of that query. The resolver in
 * `source.ts` then tries the next provider in the chain. Nothing here throws,
 * because a data-source outage must degrade the page, not break it.
 *
 * Providers are responsible for emitting the normalised model, including
 * platform slugs drawn from the shared vocabulary in `format.ts` so that
 * platform icons and `/browse` filter links work identically across backends.
 */
export interface GameProvider {
  readonly id: DataSource;

  /** False when required credentials are absent; the chain skips it entirely. */
  isConfigured(): boolean;

  browse(filters: BrowseFilters): Promise<Page<GameSummary> | null>;
  /**
   * The release calendar. Takes the same filters as `browse` so the upcoming
   * page can offer genre/platform narrowing and sorting without a second,
   * subtly different query path.
   */
  upcoming(
    pageSize: number,
    page: number,
    filters?: BrowseFilters,
  ): Promise<Page<GameSummary> | null>;
  trending(pageSize: number): Promise<GameSummary[] | null>;
  topRated(pageSize: number): Promise<GameSummary[] | null>;
  newReleases(pageSize: number): Promise<GameSummary[] | null>;

  /**
   * Returns null both for "not found" and "backend unavailable". A slug minted
   * by a different provider is a normal null, letting the chain fall through.
   */
  detail(slug: string): Promise<GameDetail | null>;

  related(game: GameDetail, limit: number): Promise<GameSummary[] | null>;
  genres(): Promise<Ref[] | null>;
  platforms(): Promise<Ref[] | null>;
}

/** Shared safety net so one slow backend can't hold a render open. */
export const REQUEST_TIMEOUT_MS = 9000;

/** Cache windows in seconds, shared so provider behaviour stays comparable. */
export const TTL = {
  list: 60 * 60 * 6,
  detail: 60 * 60 * 24,
  search: 60 * 10,
  taxonomy: 60 * 60 * 24 * 7,
} as const;
