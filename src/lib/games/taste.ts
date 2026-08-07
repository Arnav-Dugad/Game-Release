/**
 * Builds a taste profile from a user's tracked games.
 *
 * The scoring is deliberately opinionated rather than a flat tally:
 *
 *  - **Status weight.** Finishing a game is a much stronger signal than
 *    bookmarking one. "Played" counts for more than "playing", which counts for
 *    more than "want to play" — a wishlist is aspiration, a finished game is
 *    evidence.
 *  - **Recency.** Taste drifts. Signals decay on a half-life so what someone
 *    played this month outweighs what they saved two years ago.
 *  - **Rating.** A game they scored 9/10 says more than one they scored 4/10,
 *    and a low score actively counts against that genre.
 *  - **Breadth penalty.** A genre attached to almost everything they own (the
 *    "Action" problem) carries less information than a narrow one, so scores
 *    are damped by how common the genre is across the library.
 *
 * Everything here is pure so it can be unit-checked without a network or a
 * signed-in user.
 */

import type { WatchStatus } from "@/lib/firebase/db";

export interface TasteInput {
  gameId: number;
  genreIds: number[];
  platformSlugs: string[];
  status: WatchStatus;
  /** Platform the user actually played on, if recorded. */
  platform: string | null;
  addedAt: number;
  finishedAt: number | null;
  /** The user's own 1–10 score, when they've reviewed it. */
  rating?: number | null;
}

export interface TasteProfile {
  genreIds: number[];
  platformSlugs: string[];
  excludeIds: number[];
  /** How much evidence the profile rests on; below ~3 it isn't worth using. */
  strength: number;
}

const STATUS_WEIGHT: Record<WatchStatus, number> = {
  played: 3,
  playing: 2,
  want: 1,
};

/** Signals lose half their weight every ~8 months. */
const HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 240;

function recencyWeight(timestamp: number, now: number): number {
  const age = Math.max(0, now - timestamp);
  return Math.pow(0.5, age / HALF_LIFE_MS);
}

/**
 * Turns a 1–10 user score into a multiplier centred on 1.
 * 10 → 1.5, 7 → ~1.0, 1 → 0.25. Unrated games are neutral.
 */
function ratingWeight(rating: number | null | undefined): number {
  if (typeof rating !== "number") return 1;
  return Math.max(0.25, 0.25 + (rating / 10) * 1.25);
}

export function buildTasteProfile(
  entries: TasteInput[],
  options: { now?: number; maxGenres?: number; maxPlatforms?: number } = {},
): TasteProfile {
  const now = options.now ?? Date.now();
  const maxGenres = options.maxGenres ?? 4;
  const maxPlatforms = options.maxPlatforms ?? 3;

  const genreScores = new Map<number, number>();
  const genreCounts = new Map<number, number>();
  const platformScores = new Map<string, number>();
  let strength = 0;

  for (const entry of entries) {
    const status = STATUS_WEIGHT[entry.status] ?? 1;
    // Prefer the completion date when we have it — that's when the signal
    // actually happened, not when the game was first bookmarked.
    const stamp = entry.finishedAt ?? entry.addedAt;
    const weight = status * recencyWeight(stamp, now) * ratingWeight(entry.rating);
    strength += weight;

    for (const genreId of entry.genreIds) {
      genreScores.set(genreId, (genreScores.get(genreId) ?? 0) + weight);
      genreCounts.set(genreId, (genreCounts.get(genreId) ?? 0) + 1);
    }

    // A recorded play platform is a real preference; availability is only a hint.
    if (entry.platform) {
      platformScores.set(entry.platform, (platformScores.get(entry.platform) ?? 0) + weight * 3);
    }
    for (const slug of entry.platformSlugs) {
      platformScores.set(slug, (platformScores.get(slug) ?? 0) + weight * 0.4);
    }
  }

  const total = entries.length || 1;

  const genreIds = [...genreScores.entries()]
    .map(([id, score]) => {
      // Damp genres that appear on nearly everything — they describe the
      // library, not the taste.
      const ubiquity = (genreCounts.get(id) ?? 0) / total;
      return { id, score: score * (1 - 0.55 * ubiquity) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxGenres)
    .map((entry) => entry.id);

  const platformSlugs = [...platformScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPlatforms)
    .map(([slug]) => slug);

  return {
    genreIds,
    platformSlugs,
    excludeIds: entries.map((entry) => entry.gameId),
    strength: Math.round(strength * 100) / 100,
  };
}

/** Below this, recommendations would be noise dressed up as insight. */
export const MIN_TASTE_STRENGTH = 1.5;
