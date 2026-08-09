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
import { getUserPreferences, saveUserPreferences } from "@/lib/firebase/db";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import {
  releaseNotifications,
  sortNotifications,
  type AppNotification,
} from "./model";

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
  const { notificationReleases } = usePreferences();
  const [readState, setReadState] = useState<{ uid: string; ids: Set<string> } | null>(null);

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

  const releases = useMemo(
    () => (notificationReleases ? releaseNotifications(entries) : []),
    [entries, notificationReleases],
  );
  const notifications = useMemo(
    () => sortNotifications(releases),
    [releases],
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
        (watchlistLoading || readState?.uid !== user?.uid),
      isRead: (id) => readIds.has(id),
      markRead,
      markAllRead,
    }),
    [notifications, unread, user, watchlistLoading, readState, readIds, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside <NotificationsProvider>.");
  return context;
}
