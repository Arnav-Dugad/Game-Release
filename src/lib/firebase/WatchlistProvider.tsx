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
  addToWatchlist,
  removeFromWatchlist,
  setWatchPlatform,
  setWatchStatus,
  subscribeWatchlist,
  watchlistEntryFromGame,
  type WatchStatus,
  type WatchlistEntry,
} from "./db";
import type { GameSummary } from "@/lib/games/types";

interface WatchlistContextValue {
  entries: WatchlistEntry[];
  loading: boolean;
  isWatched: (gameId: number) => boolean;
  statusOf: (gameId: number) => WatchStatus | null;
  /** Returns true if the game ended up tracked, false if it was removed. */
  toggle: (game: GameSummary) => Promise<boolean>;
  setStatus: (gameId: number, status: WatchStatus) => Promise<void>;
  /** Records which platform the user is playing on. */
  setPlatform: (gameId: number, platform: string | null) => Promise<void>;
  remove: (gameId: number) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** Games mid-write, so the UI can reflect intent before the snapshot lands. */
  const [pending, setPending] = useState<Map<number, boolean>>(new Map());

  useEffect(() => {
    if (!user) {
      // Signing out clears the cached list a frame later, keeping the state
      // write out of the effect body.
      const frame = requestAnimationFrame(() => {
        setEntries([]);
        setPending(new Map());
        setLoading(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    const unsubscribe = subscribeWatchlist(
      user.uid,
      (next) => {
        setEntries(next);
        setPending(new Map());
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
    (gameId: number) => pending.get(gameId) ?? serverIds.has(gameId),
    [pending, serverIds],
  );

  const statusOf = useCallback(
    (gameId: number) => entries.find((e) => e.gameId === gameId)?.status ?? null,
    [entries],
  );

  const toggle = useCallback(
    async (game: GameSummary) => {
      if (!user) throw new Error("Sign in to use your watchlist.");
      const next = !isWatched(game.id);

      setPending((prev) => new Map(prev).set(game.id, next));
      try {
        if (next) {
          await addToWatchlist(user.uid, watchlistEntryFromGame(game, "want"));
        } else {
          await removeFromWatchlist(user.uid, game.id);
        }
        return next;
      } catch (err) {
        setPending((prev) => {
          const rolled = new Map(prev);
          rolled.delete(game.id);
          return rolled;
        });
        throw err;
      }
    },
    [user, isWatched],
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
      setPending((prev) => new Map(prev).set(gameId, false));
      await removeFromWatchlist(user.uid, gameId);
    },
    [user],
  );

  const value = useMemo<WatchlistContextValue>(
    () => ({ entries, loading, isWatched, statusOf, toggle, setStatus, setPlatform, remove }),
    [entries, loading, isWatched, statusOf, toggle, setStatus, setPlatform, remove],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used inside <WatchlistProvider>.");
  return ctx;
}
