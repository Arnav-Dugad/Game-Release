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
  slug: string;
  name: string;
  image: string | null;
  released: string | null;
  tba: boolean;
  metacritic: number | null;
  status: WatchStatus;
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
 * Watchlist
 * ------------------------------------------------------------------------ */

export function watchlistEntryFromGame(game: GameSummary, status: WatchStatus): WatchlistEntry {
  return {
    gameId: game.id,
    slug: game.slug,
    name: game.name,
    image: game.image,
    released: game.released,
    tba: game.tba,
    metacritic: game.metacritic,
    status,
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

export async function setWatchStatus(
  uid: string,
  gameId: number,
  status: WatchStatus,
): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "users", uid, "watchlist", String(gameId)), { status });
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
      const entries = snap.docs.map((d) => d.data() as WatchlistEntry);
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
