import type { WatchlistEntry } from "@/lib/firebase/db";
import type { Price } from "@/lib/games/types";

export type NotificationKind = "deal" | "release-today" | "release-soon" | "released";

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

/** Deterministic release alerts derived from the signed-in reader's watchlist. */
export function releaseNotifications(
  entries: WatchlistEntry[],
  now = Date.now(),
): AppNotification[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const todayAt = Date.parse(`${today}T00:00:00Z`);
  const out: AppNotification[] = [];

  for (const entry of entries) {
    if (!entry.released) continue;
    const releaseAt = Date.parse(`${entry.released}T00:00:00Z`);
    if (!Number.isFinite(releaseAt)) continue;
    const days = Math.round((releaseAt - todayAt) / DAY);

    let kind: NotificationKind;
    let title: string;
    let body: string;
    let priority: number;

    if (days === 0) {
      kind = "release-today";
      title = `${entry.name} releases today`;
      body = "The wait is over. Open the game page for platforms, stores, and release details.";
      priority = 100;
    } else if (days > 0 && days <= 14) {
      kind = "release-soon";
      title = `${entry.name} arrives in ${days} day${days === 1 ? "" : "s"}`;
      body = "A game on your watchlist is nearly here. Check its release details before launch.";
      priority = 80 - days;
    } else if (days < 0 && days >= -3) {
      kind = "released";
      title = `${entry.name} is out now`;
      body = "This tracked release landed recently. You can update its play status from your watchlist.";
      priority = 60 + days;
    } else {
      continue;
    }

    out.push({
      id: `${kind}:${entry.gameId}:${entry.released}`,
      kind,
      title,
      body,
      href: canonicalEntryHref(entry),
      gameName: entry.name,
      image: entry.image,
      imageFallback: entry.imageFallback,
      createdAt: releaseAt,
      priority,
    });
  }

  return out.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}

export function dealNotification(
  entry: WatchlistEntry,
  appId: number,
  price: Price,
  regionName: string,
  now = Date.now(),
): AppNotification {
  return {
    id: `deal:${appId}:${price.discountPercent}:${price.current}`,
    kind: "deal",
    title: `${entry.name} is ${price.discountPercent}% off`,
    body: `${price.current}${price.original ? `, down from ${price.original}` : ""} on Steam in ${regionName}.`,
    href: canonicalEntryHref(entry),
    gameName: entry.name,
    image: entry.image,
    imageFallback: entry.imageFallback,
    createdAt: now,
    priority: 90 + price.discountPercent / 100,
  };
}

export function sortNotifications(items: AppNotification[]): AppNotification[] {
  return [...items].sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
}
