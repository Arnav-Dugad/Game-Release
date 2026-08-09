"use client";

/**
 * Watchlist state, subscribed once for the whole app.
 *
 * Every card on a grid needs to know whether its game is tracked. Subscribing
 * per-card would open dozens of Firestore listeners on a single page, so this
 * provider holds one snapshot listener and exposes a lookup.
 *
 * Toggles are optimistic: the local set updates immediately and rolls back if
 * the write fails, so the button never feels like it's waiting on the network.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import {
  ensureWatchlistEntry,
  removeFromWatchlist,
  setGameFollowing,
  setOwnedOn,
  setSubscriptionAccess,
  setWatchPlatform,
  setWatchStatus,
  subscribeWatchlist,
  type SubscriptionAccess,
  type WatchStatus,
  type WatchlistEntry,
} from "./db";
import type { GameSummary } from "@/lib/games/types";

interface WatchlistContextValue {
  entries: WatchlistEntry[];
  loading: boolean;
  isWatched: (gameId: number) => boolean;
  isFollowed: (gameId: number) => boolean;
  statusOf: (gameId: number) => WatchStatus | null;
  ensure: (game: GameSummary) => Promise<void>;
  /** Returns the new explicit follow state. */
  toggleFollow: (game: GameSummary) => Promise<boolean>;
  syncFollow: (game: GameSummary) => Promise<void>;
  setStatus: (gameId: number, status: WatchStatus) => Promise<void>;
  /** Records which platform the user is playing on. */
  setPlatform: (gameId: number, platform: string | null) => Promise<void>;
  /** Records where the user owns the game. */
  setOwnership: (gameId: number, ownedOn: string[]) => Promise<void>;
  ownershipOf: (gameId: number) => string[];
  setAccess: (gameId: number, access: SubscriptionAccess[]) => Promise<void>;
  accessOf: (gameId: number) => SubscriptionAccess[];
  remove: (gameId: number) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** Follow writes are optimistic; personal records remain server-backed. */
  const [pendingFollowing, setPendingFollowing] = useState<Map<number, boolean>>(new Map());

  useEffect(() => {
    if (!user) {
      // Signing out clears the cached list a frame later, keeping the state
      // write out of the effect body.
      const frame = requestAnimationFrame(() => {
        setEntries([]);
        setPendingFollowing(new Map());
        setLoading(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    const unsubscribe = subscribeWatchlist(
      user.uid,
      (next) => {
        setEntries(next);
        setPendingFollowing(new Map());
        setLoading(false);
      },
      (err) => {
        console.error("[watchlist] subscription failed", err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const serverIds = useMemo(() => new Set(entries.map((e) => e.gameId)), [entries]);

  const isWatched = useCallback(
    (gameId: number) => serverIds.has(gameId),
    [serverIds],
  );

  const isFollowed = useCallback(
    (gameId: number) => pendingFollowing.get(gameId)
      ?? entries.find((entry) => entry.gameId === gameId)?.following
      ?? false,
    [entries, pendingFollowing],
  );

  const statusOf = useCallback(
    (gameId: number) => entries.find((e) => e.gameId === gameId)?.status ?? null,
    [entries],
  );

  const ensure = useCallback(
    async (game: GameSummary) => {
      if (!user) throw new Error("Sign in to save games.");
      if (!isWatched(game.id)) await ensureWatchlistEntry(user.uid, game);
    },
    [user, isWatched],
  );

  const toggleFollow = useCallback(
    async (game: GameSummary) => {
      if (!user) throw new Error("Sign in to follow games.");
      const exists = isWatched(game.id);
      const next = !isFollowed(game.id);

      setPendingFollowing((prev) => new Map(prev).set(game.id, next));
      try {
        await setGameFollowing(user.uid, game, next, exists);
        return next;
      } catch (err) {
        setPendingFollowing((prev) => {
          const rolled = new Map(prev);
          rolled.delete(game.id);
          return rolled;
        });
        throw err;
      }
    },
    [user, isWatched, isFollowed],
  );

  const setStatus = useCallback(
    async (gameId: number, status: WatchStatus) => {
      if (!user) throw new Error("Sign in to use your watchlist.");
      // Pass the current entry so first-transition timestamps aren't rewritten.
      const current = entries.find((entry) => entry.gameId === gameId);
      await setWatchStatus(user.uid, gameId, status, current);
    },
    [user, entries],
  );

  const setOwnership = useCallback(
    async (gameId: number, ownedOn: string[]) => {
      if (!user) throw new Error("Sign in to track what you own.");
      await setOwnedOn(user.uid, gameId, ownedOn);
    },
    [user],
  );

  const ownershipOf = useCallback(
    (gameId: number) => entries.find((entry) => entry.gameId === gameId)?.ownedOn ?? [],
    [entries],
  );

  const syncFollow = useCallback(
    async (game: GameSummary) => {
      if (!user) return;
      await setGameFollowing(user.uid, game, true, true);
    },
    [user],
  );

  const setAccess = useCallback(
    async (gameId: number, access: SubscriptionAccess[]) => {
      if (!user) throw new Error("Sign in to track subscription play.");
      await setSubscriptionAccess(user.uid, gameId, access);
    },
    [user],
  );

  const accessOf = useCallback(
    (gameId: number) => entries.find((entry) => entry.gameId === gameId)?.subscriptionAccess ?? [],
    [entries],
  );

  const setPlatform = useCallback(
    async (gameId: number, platform: string | null) => {
      if (!user) throw new Error("Sign in to use your watchlist.");
      await setWatchPlatform(user.uid, gameId, platform);
    },
    [user],
  );

  const remove = useCallback(
    async (gameId: number) => {
      if (!user) throw new Error("Sign in to use your watchlist.");
      await removeFromWatchlist(user.uid, gameId);
    },
    [user],
  );

  const value = useMemo<WatchlistContextValue>(
    () => ({
      entries,
      loading,
      isWatched,
      isFollowed,
      statusOf,
      ensure,
      toggleFollow,
      syncFollow,
      setStatus,
      setPlatform,
      setOwnership,
      ownershipOf,
      setAccess,
      accessOf,
      remove,
    }),
    [entries, loading, isWatched, isFollowed, statusOf, ensure, toggleFollow, syncFollow, setStatus, setPlatform, setOwnership, ownershipOf, setAccess, accessOf, remove],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used inside <WatchlistProvider>.");
  return ctx;
}
