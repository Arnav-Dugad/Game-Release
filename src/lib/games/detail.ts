import type { GameDetail } from "./types";

/**
 * Neutral values for every detail-only field.
 *
 * Providers vary enormously in what they expose — IGDB has engines and player
 * perspectives, Steam has neither. Spreading these defaults means a provider
 * only writes the fields it can actually fill, and adding a new field to
 * `GameDetail` doesn't break every provider at once.
 */
export const DETAIL_DEFAULTS: Omit<GameDetail, keyof import("./types").GameSummary> = {
  description: "",
  storyline: null,
  steamAppId: null,
  website: null,
  companies: [],
  developers: [],
  publishers: [],
  supportingStudios: [],
  tags: [],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
  engines: [],
  series: [],
  franchises: [],
  keywords: [],
  ageRatings: [],
  languages: [],
  multiplayerModes: null,
  artworks: [],
  platformDetails: [],
  releases: [],
  characters: [],
  dlcs: [],
  expansions: [],
  standaloneExpansions: [],
  editions: [],
  bundles: [],
  remakes: [],
  remasters: [],
  ports: [],
  parentGame: null,
  similar: [],
  totalRating: null,
  hypes: 0,
  websites: [],
  stores: [],
  requirements: [],
  trailers: [],
  redditUrl: null,
  metacriticUrl: null,
  alternativeNames: [],
};
