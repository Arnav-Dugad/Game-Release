"use client";

/**
 * The reader's owned-games collection, as a first-class browsable page.
 *
 * A collection is a fundamentally different thing to browse than a catalogue:
 * it is small enough to hold in your head, so the useful operations are
 * "narrow it down" and "reorder it", not "search 300,000 records". Everything
 * here works against the already-loaded watchlist snapshot — no network, no
 * pagination, instant feedback on every control.
 *
 * A game can be owned on several storefronts at once. Filtering by store shows
 * every copy that matches rather than collapsing to one, because owning the
 * same title twice is normal and hiding it would misreport the collection.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Library, PackageOpen, Search, X } from "lucide-react";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { GameCover } from "@/components/game/GameCover";
import { ScorePill } from "@/components/ui/ScoreRing";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Badge";
import { Reveal } from "@/components/motion/Reveal";
import {
  PosterSizeToggle,
  posterGridClass,
  usePosterSize,
} from "@/components/ui/PosterSizeToggle";
import { PosterTile } from "@/components/game/PosterTile";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useWatchlist } from "@/lib/firebase/WatchlistProvider";
import { OWNERSHIP_PLATFORMS, ownershipPlatform } from "@/lib/games/stores-catalog";
import { cn } from "@/lib/utils/cn";
import type { WatchlistEntry, WatchStatus } from "@/lib/firebase/db";

type SortKey = "added" | "name" | "score" | "released";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "added", label: "Recently added" },
  { value: "name", label: "A–Z" },
  { value: "score", label: "Highest rated" },
  { value: "released", label: "Newest release" },
];

const STATUS_FILTERS: { value: WatchStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: "Want to play" },
  { value: "playing", label: "Playing" },
  { value: "played", label: "Played" },
];

export function LibraryView() {
  const { user } = useAuth();
  const { entries, loading } = useWatchlist();

  const [store, setStore] = useState<string | "all">("all");
  const [status, setStatus] = useState<WatchStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [query, setQuery] = useState("");
  const { size: posterSize, setSize: setPosterSize } = usePosterSize("ludex:library-size");

  /** Only games the reader has actually marked as owned somewhere. */
  const owned = useMemo(
    () => entries.filter((entry) => (entry.ownedOn ?? []).length > 0),
    [entries],
  );

  /** Stores that actually appear in this collection, with counts. */
  const stores = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of owned) {
      for (const slug of entry.ownedOn ?? []) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([slug, count]) => ({
        slug,
        count,
        name: ownershipPlatform(slug)?.name ?? slug,
        icon: ownershipPlatform(slug)?.icon ?? null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [owned]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    const filtered = owned.filter((entry) => {
      if (store !== "all" && !(entry.ownedOn ?? []).includes(store)) return false;
      if (status !== "all" && entry.status !== status) return false;
      if (term && !entry.name.toLowerCase().includes(term)) return false;
      return true;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "score":
        return sorted.sort((a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1));
      case "released":
        // Undated titles sort last rather than being treated as ancient.
        return sorted.sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""));
      default:
        return sorted.sort((a, b) => b.addedAt - a.addedAt);
    }
  }, [owned, store, status, query, sort]);

  const activeFilters = (store !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (query ? 1 : 0);

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your library"
        body="Your collection is tied to your account, so it follows you to any device."
        action={{ href: "/login", label: "Sign in" }}
      />
    );
  }

  if (loading) {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer-bg h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (owned.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        body="Open any game and use “I own this” to record where you bought it — Steam, PlayStation, a physical copy, wherever."
        action={{ href: "/browse", label: "Find your games" }}
      />
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm">
          <Library size={15} className="text-mint" />
          <span className="font-semibold tabular-nums">{owned.length}</span>
          <span className="text-muted">{owned.length === 1 ? "game" : "games"}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-4 py-2 text-sm">
          <span className="font-semibold tabular-nums">{stores.length}</span>
          <span className="text-muted">{stores.length === 1 ? "store" : "stores"}</span>
        </span>
        {activeFilters > 0 && (
          <span className="text-sm text-muted">
            Showing <span className="font-semibold text-text tabular-nums">{visible.length}</span>
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4 rounded-2xl border border-line bg-panel/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library…"
              aria-label="Search your library"
              className="min-h-11 w-full rounded-full border border-line bg-white/[0.04] pl-10 pr-9 text-sm outline-none transition-colors focus-visible:border-brand"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-faint transition-colors hover:bg-white/10 hover:text-text"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="relative">
            <ArrowUpDown
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort library"
              className="min-h-11 appearance-none rounded-full border border-line bg-white/[0.04] py-2 pl-9 pr-9 text-sm outline-none transition-colors hover:border-line-strong focus-visible:border-brand"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value} className="bg-panel text-text">
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint"
            >
              ▾
            </span>
          </div>

          <PosterSizeToggle size={posterSize} onChange={setPosterSize} />
        </div>

        <div>
          <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Store
          </h3>
          <div className="flex flex-wrap gap-2">
            <Chip active={store === "all"} onClick={() => setStore("all")}>
              All stores
            </Chip>
            {stores.map((option) => (
              <Chip
                key={option.slug}
                active={store === option.slug}
                onClick={() => setStore(option.slug)}
              >
                {option.icon && <BrandIcon name={option.icon} size={12} title={null} />}
                {option.name}
                <span className="tabular-nums opacity-60">{option.count}</span>
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            Status
          </h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
              <Chip
                key={option.value}
                active={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line py-16 text-center">
          <PackageOpen size={22} className="text-faint" />
          <p className="mt-3 text-sm text-muted">Nothing in your library matches those filters.</p>
          <button
            type="button"
            onClick={() => {
              setStore("all");
              setStatus("all");
              setQuery("");
            }}
            className="mt-4 text-xs font-medium text-brand-soft underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className={cn("grid gap-3", posterGridClass(posterSize))}>
          {visible.map((entry, index) => (
            <li key={entry.gameId}>
              {/* Mount-based: filtering re-mounts these while the reader is
                  already scrolled into the results. */}
              <Reveal delay={Math.min(index, 10) * 0.025} blur={false} onMount>
                {posterSize === "list" ? (
                  <LibraryRow entry={entry} />
                ) : (
                  <PosterTile
                    entry={entry}
                    size={posterSize === "large" ? "large" : "compact"}
                    badge={STATUS_LABELS[entry.status]}
                  />
                )}
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const STATUS_LABELS: Record<WatchStatus, string> = {
  want: "Want to play",
  playing: "Playing",
  played: "Played",
};

function LibraryRow({ entry }: { entry: WatchlistEntry }) {
  const owned = entry.ownedOn ?? [];

  return (
    <Link
      href={`/game/${entry.slug}`}
      className="flex items-center gap-3.5 rounded-2xl border border-line bg-panel/50 p-3 transition-all duration-300 fine:hover:border-line-strong fine:hover:bg-panel"
    >
      <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg">
        <GameCover
          name={entry.name}
          slug={entry.slug}
          image={entry.image}
          imageFallback={entry.imageFallback}
          width={160}
          sizes="48px"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{entry.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] uppercase tracking-[0.08em] text-faint">
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.released && (
            <span className="text-[11px] text-muted tabular-nums">
              {entry.released.slice(0, 4)}
            </span>
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          {owned.slice(0, 5).map((slug) => {
            const platform = OWNERSHIP_PLATFORMS.find((p) => p.slug === slug);
            return platform?.icon ? (
              <BrandIcon key={slug} name={platform.icon} size={12} title={platform.name} />
            ) : (
              <span key={slug} className="text-[10px] text-faint">
                {platform?.name ?? slug}
              </span>
            );
          })}
        </span>
      </span>

      <ScorePill score={entry.metacritic} />
    </Link>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-line py-16 text-center">
      <PackageOpen size={22} className="text-faint" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">{body}</p>
      <Button href={action.href} variant="secondary" size="sm" className="mt-5">
        {action.label}
      </Button>
    </div>
  );
}
