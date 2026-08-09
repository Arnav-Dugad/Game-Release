"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getUserPreferences, saveUserPreferences, type WatchlistEntry } from "@/lib/firebase/db";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import type { Price } from "@/lib/games/types";
import {
  dealNotification,
  releaseNotifications,
  sortNotifications,
  type AppNotification,
} from "./model";

const MAX_DEAL_CHECKS = 18;
const CONCURRENCY = 4;
const EMPTY_READ = new Set<string>();

interface NotificationsContextValue {
  notifications: AppNotification[];
  unread: AppNotification[];
  unreadCount: number;
  loading: boolean;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

async function mapWithLimit<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

function storageKey(uid: string) {
  return `ludex:notifications:read:${uid}`;
}

function persistRead(uid: string, ids: Set<string>) {
  const values = [...ids].slice(-250);
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(values));
  } catch {
    /* the in-memory state still works */
  }
  void saveUserPreferences(uid, { notificationReadIds: values }).catch(() => {});
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const { region, regionInfo, ready, notificationDeals, notificationReleases } = usePreferences();
  const [readState, setReadState] = useState<{ uid: string; ids: Set<string> } | null>(null);
  const [dealState, setDealState] = useState<{
    key: string;
    items: AppNotification[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      let localIds: string[] = [];
      try {
        const stored = window.localStorage.getItem(storageKey(user.uid));
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) localIds = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        /* start unread */
      }
      if (!cancelled) setReadState({ uid: user.uid, ids: new Set(localIds) });

      void getUserPreferences(user.uid).then((preferences) => {
        if (cancelled) return;
        setReadState((current) => {
          const merged = new Set([
            ...(current?.uid === user.uid ? current.ids : []),
            ...(preferences?.notificationReadIds ?? []),
          ]);
          try {
            window.localStorage.setItem(storageKey(user.uid), JSON.stringify([...merged]));
          } catch {
            /* account state remains available */
          }
          return { uid: user.uid, ids: merged };
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [user]);

  const candidates = useMemo(
    () =>
      [...entries]
        .filter((entry) => entry.status === "want")
        .sort(
          (a, b) =>
            Number((a.ownedOn ?? []).length > 0) - Number((b.ownedOn ?? []).length > 0) ||
            b.addedAt - a.addedAt,
        )
        .slice(0, MAX_DEAL_CHECKS),
    [entries],
  );
  const candidateKey = candidates
    .map((entry) => `${entry.gameId}:${entry.steamAppId ?? ""}`)
    .join(",");
  const dealRequestKey = `${user?.uid ?? "signed-out"}:${region}:${candidateKey}`;

  useEffect(() => {
    if (!user || !ready || watchlistLoading || !notificationDeals || candidates.length === 0) return;
    const controller = new AbortController();
    void mapWithLimit(candidates, async (entry: WatchlistEntry) => {
      try {
        const lookup = entry.steamAppId
          ? `appid=${entry.steamAppId}`
          : `slug=${encodeURIComponent(entry.slug)}`;
        const response = await fetch(`/api/price?${lookup}&cc=${encodeURIComponent(region)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { price: Price | null; appId: number | null };
        if (!data.price || data.price.discountPercent <= 0 || !data.appId) return null;
        return dealNotification(entry, data.appId, data.price, regionInfo.name);
      } catch {
        return null;
      }
    }).then((results) => {
      if (controller.signal.aborted) return;
      setDealState({
        key: dealRequestKey,
        items: results.filter((item): item is AppNotification => item !== null),
      });
    });
    return () => controller.abort();
    // candidateKey captures the persisted fields used by this request batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey, dealRequestKey, ready, region, regionInfo.name, user, watchlistLoading, notificationDeals]);

  const releases = useMemo(
    () => (notificationReleases ? releaseNotifications(entries) : []),
    [entries, notificationReleases],
  );
  const deals = useMemo(
    () =>
      !user || !notificationDeals || candidates.length === 0
        ? []
        : dealState?.key === dealRequestKey
          ? dealState.items
          : null,
    [user, notificationDeals, candidates.length, dealState, dealRequestKey],
  );
  const notifications = useMemo(
    () => sortNotifications([...releases, ...(deals ?? [])]),
    [releases, deals],
  );
  const readIds = readState && readState.uid === user?.uid ? readState.ids : EMPTY_READ;
  const unread = useMemo(
    () => notifications.filter((notification) => !readIds.has(notification.id)),
    [notifications, readIds],
  );

  const markRead = useCallback(
    (id: string) => {
      if (!user || readIds.has(id)) return;
      const next = new Set(readIds).add(id);
      setReadState({ uid: user.uid, ids: next });
      persistRead(user.uid, next);
    },
    [user, readIds],
  );

  const markAllRead = useCallback(() => {
    if (!user || notifications.length === 0) return;
    const next = new Set(readIds);
    for (const notification of notifications) next.add(notification.id);
    setReadState({ uid: user.uid, ids: next });
    persistRead(user.uid, next);
  }, [user, notifications, readIds]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unread,
      unreadCount: unread.length,
      loading:
        Boolean(user) &&
        (watchlistLoading || readState?.uid !== user?.uid || deals === null),
      isRead: (id) => readIds.has(id),
      markRead,
      markAllRead,
    }),
    [notifications, unread, user, watchlistLoading, readState, deals, readIds, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside <NotificationsProvider>.");
  return context;
}
