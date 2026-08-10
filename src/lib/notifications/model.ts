import type { WatchlistEntry } from "@/lib/firebase/db";

export type NotificationKind =
  | "release-today"
  | "release-soon"
  | "released"
  | "dlc-today"
  | "dlc-soon"
  | "dlc-released";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  gameName: string;
  image: string | null;
  imageFallback: string | null;
  createdAt: number;
  /** Higher comes first; time breaks ties. */
  priority: number;
}

const DAY = 86_400_000;

export function canonicalEntryHref(entry: Pick<WatchlistEntry, "slug" | "name">): string {
  return /-s\d+$/.test(entry.slug)
    ? `/browse?search=${encodeURIComponent(entry.name)}`
    : `/game/${entry.slug}`;
}

/** Deterministic release and add-on alerts for explicitly followed games. */
export function releaseNotifications(
  entries: WatchlistEntry[],
  now = Date.now(),
): AppNotification[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  const out: AppNotification[] = [];

  for (const entry of entries) {
    // `undefined` is a legacy watchlist record from before follows were split
    // out. It represented the same intent, so only an explicit false opts out.
    if (entry.following === false) continue;
    if (entry.released) {
      const releaseAt = Date.parse(`${entry.released}T00:00:00Z`);
      const days = Math.round((releaseAt - todayAt) / DAY);
      let notification: Pick<AppNotification, "kind" | "title" | "body" | "priority"> | null = null;

      if (Number.isFinite(releaseAt) && days === 0) {
        notification = { kind: "release-today", title: `${entry.name} releases today`, body: "The wait is over. Open the game page for platforms, stores, and release details.", priority: 100 };
      } else if (Number.isFinite(releaseAt) && days > 0 && days <= 14) {
        notification = { kind: "release-soon", title: `${entry.name} arrives in ${days} day${days === 1 ? "" : "s"}`, body: "A game you follow is nearly here. Check its platforms and launch details.", priority: 80 - days };
      } else if (Number.isFinite(releaseAt) && days < 0 && days >= -3) {
        notification = { kind: "released", title: `${entry.name} is out now`, body: "This followed release landed recently. You can update its play status from your library.", priority: 60 + days };
      }

      if (notification) out.push({
        /*
         * `days` is part of the identity for the countdown kind.
         *
         * The title embeds the day count ("arrives in 6 days") but the id did
         * not, so the first `release-soon` a reader saw permanently suppressed
         * every later one — they might get "in 13 days" and then nothing until
         * launch day. Including `days` makes each step its own notification;
         * the other kinds fire once by nature and are unaffected.
         */
        id:
          notification.kind === "release-soon"
            ? `${notification.kind}:${entry.gameId}:${entry.released}:${days}`
            : `${notification.kind}:${entry.gameId}:${entry.released}`,
        ...notification,
        href: canonicalEntryHref(entry),
        gameName: entry.name,
        image: entry.image,
        imageFallback: entry.imageFallback,
        createdAt: releaseAt,
      });
    }

    for (const related of entry.followedReleases ?? []) {
      if (!related.released) continue;
      const relatedAt = Date.parse(`${related.released}T00:00:00Z`);
      if (!Number.isFinite(relatedAt)) continue;
      const relatedDays = Math.round((relatedAt - todayAt) / DAY);
      const label = related.kind === "dlc" ? "DLC" : "expansion";
      let relatedKind: NotificationKind;
      let relatedTitle: string;
      let relatedBody: string;
      let relatedPriority: number;

      if (relatedDays === 0) {
        relatedKind = "dlc-today";
        relatedTitle = `${related.name} drops today`;
        relatedBody = `New ${label} for ${entry.name} is available today.`;
        relatedPriority = 95;
      } else if (relatedDays > 0 && relatedDays <= 14) {
        relatedKind = "dlc-soon";
        relatedTitle = `${related.name} arrives in ${relatedDays} day${relatedDays === 1 ? "" : "s"}`;
        relatedBody = `A new ${label} is approaching for ${entry.name}.`;
        relatedPriority = 75 - relatedDays;
      } else if (relatedDays < 0 && relatedDays >= -3) {
        relatedKind = "dlc-released";
        relatedTitle = `${related.name} is out now`;
        relatedBody = `The latest ${label} for ${entry.name} just landed.`;
        relatedPriority = 58 + relatedDays;
      } else {
        continue;
      }

      out.push({
        id: `${relatedKind}:${entry.gameId}:${related.gameId}:${related.released}`,
        kind: relatedKind,
        title: relatedTitle,
        body: relatedBody,
        // Same guard the parent uses: a Steam-derived slug ends in `-s<appid>`
        // and has no game page, so linking it directly 404s.
        href: canonicalEntryHref({ slug: related.slug, name: related.name }),
        gameName: entry.name,
        image: related.image ?? entry.image,
        imageFallback: related.imageFallback ?? entry.imageFallback,
        createdAt: relatedAt,
        priority: relatedPriority,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}

export function sortNotifications(items: AppNotification[]): AppNotification[] {
  return [...items].sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}
