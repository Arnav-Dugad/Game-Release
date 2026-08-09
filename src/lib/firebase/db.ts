/**
 * Firestore access layer.
 *
 * Data model
 *   users/{uid}                        profile document
 *   users/{uid}/watchlist/{gameId}     one doc per tracked game
 *   reviews/{gameId}__{uid}            one review per user per game
 *
 * Reviews are top-level rather than nested under the game so they can be
 * queried both ways (by game, and by author for the profile page) without
 * duplicating writes. Ordering is done in memory instead of with `orderBy`,
 * which keeps the app working on a fresh project with no composite indexes
 * configured — a deliberate trade at these collection sizes.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./config";
import type { GameSummary } from "@/lib/games/types";

export type WatchStatus = "want" | "playing" | "played";

export interface WatchlistEntry {
  gameId: number;
  /** Direct storefront id when known; older records legitimately omit it. */
  steamAppId?: number | null;
  slug: string;
  name: string;
  image: string | null;
  /** Poster fallback, mirroring `GameSummary`. See `GameCover`. */
  imageFallback: string | null;
  released: string | null;
  /** Imprecise-but-known window, e.g. "Q4 2026". See `GameSummary`. */
  releaseWindow: string | null;
  tba: boolean;
  metacritic: number | null;
  status: WatchStatus;
  /**
   * Which platform the user played (or intends to play) this on — a family
   * slug such as "playstation". Null until they say.
   */
  platform: string | null;
  /** Epoch ms, set when the status first moves to "playing". */
  startedAt: number | null;
  /** Epoch ms, set when the status first moves to "played". */
  finishedAt: number | null;
  /**
   * Genre ids copied from the game at save time. Denormalised deliberately:
   * the recommendation engine needs a taste profile without fetching detail
   * pages for every tracked game.
   */
  genreIds: number[];
  /** Platform family slugs the game is available on. */
  platformSlugs: string[];
  /**
   * Storefronts/platforms the user actually owns this on — e.g. ["steam",
   * "playstation"]. Distinct from `platform`, which records where they *played*
   * it: people routinely own a game somewhere they've never launched it, and
   * own the same game in more than one place.
   */
  ownedOn: string[];
  /** Epoch ms. Written client-side so the list can sort before the server timestamp lands. */
  addedAt: number;
}

export interface Review {
  id: string;
  gameId: number;
  slug: string;
  gameName: string;
  uid: string;
  author: string;
  photoURL: string | null;
  /** 1–10, matching the detail page's scoring scale. */
  rating: number;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  bio: string;
  favouriteGenre: string | null;
  createdAt: number;
}

/**
 * Account-level display preferences.
 *
 * Mirrored from `localStorage` rather than replacing it. The device copy is
 * what makes preferences work signed-out and available synchronously on the
 * first paint; this copy is what makes them follow the account to a new
 * browser or phone. Neither alone covers both cases.
 *
 * Every field is optional: a profile written before a preference existed must
 * stay readable, and a partial write must never blank a key it didn't set.
 */
export interface UserPreferences {
  /** Steam country code driving price currency, e.g. "in". */
  region?: string;
  /** User-level motion opt-out, on top of the OS setting. */
  reduceMotion?: boolean;
  /**
   * Poster density on the collection pages, keyed by page.
   *
   * A map rather than a single value because the right density genuinely
   * differs per page — a watchlist is usually read as a list with inline
   * controls, a library as a wall of covers.
   */
  posterSizes?: Record<string, string>;
  /** Stable derived-notification ids already seen by this account. */
  notificationReadIds?: string[];
  notificationDeals?: boolean;
  notificationReleases?: boolean;
  /** Scheduled outbound delivery channels. Both are opt-in. */
  notificationPushEnabled?: boolean;
  notificationEmailEnabled?: boolean;
  /** Do not deliver a deal below this percentage. */
  notificationMinimumDiscount?: number;
  /** Local quiet window in 24-hour HH:mm form and its IANA timezone. */
  notificationQuietStart?: string;
  notificationQuietEnd?: string;
  notificationTimezone?: string;
  updatedAt?: number;
}

const reviewId = (gameId: number, uid: string) => `${gameId}__${uid}`;

/** Every write goes through this so a null db (unconfigured) is a clean error. */
function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

/* ---------------------------------------------------------------------------
 * Profiles
 * ------------------------------------------------------------------------ */

export async function ensureUserProfile(input: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ref = doc(db, "users", input.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const profile: UserProfile = {
    uid: input.uid,
    displayName: input.displayName?.trim() || input.email?.split("@")[0] || "Player",
    email: input.email,
    photoURL: input.photoURL,
    bio: "",
    favouriteGenre: null,
    createdAt: Date.now(),
  };
  await setDoc(ref, { ...profile, createdAtServer: serverTimestamp() });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<UserProfile, "displayName" | "bio" | "favouriteGenre" | "photoURL">>,
): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() });
}

/* ---------------------------------------------------------------------------
 * Preferences
 * ------------------------------------------------------------------------ */

/**
 * Reads account preferences.
 *
 * Returns null rather than throwing when Firebase is unconfigured or the
 * profile predates preferences, so the caller can simply fall back to whatever
 * the device already knows.
 */
export async function getUserPreferences(uid: string): Promise<UserPreferences | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", "preferences"));
    return snap.exists() ? (snap.data() as UserPreferences) : null;
  } catch (err) {
    console.warn("[prefs] read failed", err);
    return null;
  }
}

/**
 * Merges a preference patch into the account.
 *
 * `merge: true` matters: preferences are written from several places (settings
 * page, a region change on a game page), and a whole-document write from one of
 * them would silently clear whatever the others had set.
 */
export async function saveUserPreferences(
  uid: string,
  patch: UserPreferences,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await setDoc(
    doc(db, "users", uid, "settings", "preferences"),
    { ...patch, updatedAt: Date.now(), updatedAtServer: serverTimestamp() },
    { merge: true },
  );
}

/* ---------------------------------------------------------------------------
 * Watchlist
 * ------------------------------------------------------------------------ */

export function watchlistEntryFromGame(game: GameSummary, status: WatchStatus): WatchlistEntry {
  const steamSlugMatch = game.slug.match(/-s(\d+)$/);
  const steamAppId =
    "steamAppId" in game && typeof game.steamAppId === "number"
      ? game.steamAppId
      : steamSlugMatch?.[1]
        ? Number(steamSlugMatch[1])
        : null;
  return {
    gameId: game.id,
    steamAppId,
    slug: game.slug,
    name: game.name,
    image: game.image,
    imageFallback: game.imageFallback,
    released: game.released,
    releaseWindow: game.releaseWindow,
    tba: game.tba,
    metacritic: game.metacritic,
    status,
    platform: null,
    startedAt: status === "playing" ? Date.now() : null,
    finishedAt: status === "played" ? Date.now() : null,
    ownedOn: [],
    genreIds: game.genres.map((genre) => genre.id),
    platformSlugs: game.parentPlatforms.map((platform) => platform.slug),
    addedAt: Date.now(),
  };
}

export async function addToWatchlist(uid: string, entry: WatchlistEntry): Promise<void> {
  const db = requireDb();
  await setDoc(doc(db, "users", uid, "watchlist", String(entry.gameId)), entry);
}

export async function removeFromWatchlist(uid: string, gameId: number): Promise<void> {
  const db = requireDb();
  await deleteDoc(doc(db, "users", uid, "watchlist", String(gameId)));
}

/**
 * Updates play status, stamping the first transition into each state.
 *
 * Timestamps are only ever written once — re-marking something as "playing"
 * after finishing it shouldn't rewrite when you originally started.
 */
export async function setWatchStatus(
  uid: string,
  gameId: number,
  status: WatchStatus,
  current?: WatchlistEntry,
): Promise<void> {
  const db = requireDb();
  const patch: Record<string, unknown> = { status };
  if (status === "playing" && !current?.startedAt) patch.startedAt = Date.now();
  if (status === "played" && !current?.finishedAt) patch.finishedAt = Date.now();
  await updateDoc(doc(db, "users", uid, "watchlist", String(gameId)), patch);
}

/**
 * Records where the user owns a game.
 *
 * Written as a whole array rather than an arrayUnion so removing an entry uses
 * the same path as adding one, and so the caller's optimistic state and the
 * stored value can never diverge in shape.
 */
export async function setOwnedOn(
  uid: string,
  gameId: number,
  ownedOn: string[],
): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "users", uid, "watchlist", String(gameId)), {
    ownedOn: [...new Set(ownedOn)],
  });
}

/** Records which platform the user is playing a tracked game on. */
export async function setWatchPlatform(
  uid: string,
  gameId: number,
  platform: string | null,
): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "users", uid, "watchlist", String(gameId)), { platform });
}

/** Live watchlist. Returns a no-op unsubscribe when Firebase is unconfigured. */
export function subscribeWatchlist(
  uid: string,
  onChange: (entries: WatchlistEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, "users", uid, "watchlist"),
    (snap) => {
      // Documents written before `releaseWindow` existed omit the field
      // entirely, so normalise it rather than letting `undefined` reach the UI.
      const entries = snap.docs.map((d) => {
        const data = d.data() as WatchlistEntry;
        // Documents predate several fields; normalise rather than letting
        // `undefined` reach the UI or the recommendation profile.
        return {
          ...data,
          steamAppId: data.steamAppId ?? null,
          releaseWindow: data.releaseWindow ?? null,
          imageFallback: data.imageFallback ?? null,
          platform: data.platform ?? null,
          startedAt: data.startedAt ?? null,
          finishedAt: data.finishedAt ?? null,
          genreIds: data.genreIds ?? [],
          ownedOn: data.ownedOn ?? [],
          platformSlugs: data.platformSlugs ?? [],
        };
      });
      entries.sort((a, b) => b.addedAt - a.addedAt);
      onChange(entries);
    },
    (err) => onError?.(err),
  );
}

/* ---------------------------------------------------------------------------
 * Reviews
 * ------------------------------------------------------------------------ */

export async function upsertReview(input: {
  gameId: number;
  slug: string;
  gameName: string;
  uid: string;
  author: string;
  photoURL: string | null;
  rating: number;
  body: string;
}): Promise<void> {
  const db = requireDb();
  const id = reviewId(input.gameId, input.uid);
  const ref = doc(db, "reviews", id);
  const existing = await getDoc(ref);
  const now = Date.now();

  const review: Review = {
    id,
    gameId: input.gameId,
    slug: input.slug,
    gameName: input.gameName,
    uid: input.uid,
    author: input.author,
    photoURL: input.photoURL,
    rating: Math.min(10, Math.max(1, Math.round(input.rating))),
    body: input.body.trim().slice(0, 4000),
    createdAt: existing.exists() ? (existing.data() as Review).createdAt : now,
    updatedAt: now,
  };
  await setDoc(ref, review);
}

export async function deleteReview(gameId: number, uid: string): Promise<void> {
  const db = requireDb();
  await deleteDoc(doc(db, "reviews", reviewId(gameId, uid)));
}

export function subscribeGameReviews(
  gameId: number,
  onChange: (reviews: Review[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "reviews"), where("gameId", "==", gameId), fsLimit(200));
  return onSnapshot(
    q,
    (snap) => {
      const reviews = snap.docs.map((d) => d.data() as Review);
      reviews.sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(reviews);
    },
    (err) => onError?.(err),
  );
}

export async function getUserReviews(uid: string): Promise<Review[]> {
  const db = getDb();
  if (!db) return [];
  const q = query(collection(db, "reviews"), where("uid", "==", uid), fsLimit(200));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => d.data() as Review);
  reviews.sort((a, b) => b.updatedAt - a.updatedAt);
  return reviews;
}

/** Mean of the community scores, rounded to one decimal. */
export function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}
