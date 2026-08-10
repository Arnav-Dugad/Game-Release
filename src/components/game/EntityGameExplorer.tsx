"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { GameGrid } from "./GameGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GameSummary } from "@/lib/games/types";
import { fuzzyMatches } from "@/lib/games/fuzzy-search";

type EntitySort = "featured" | "newest" | "oldest" | "name" | "critic" | "audience" | "anticipated";

export function EntityGameExplorer({
  games,
  kind,
}: {
  games: GameSummary[];
  kind: "company" | "character" | "franchise";
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<EntitySort>(
    kind === "franchise" ? "newest" : "featured",
  );
  const [visibleCount, setVisibleCount] = useState(60);
  const normalised = query.trim();

  const filtered = useMemo(() => {
    const matches = normalised
      ? games.filter((game) => fuzzyMatches(game.name, normalised))
      : [...games];

    if (sort === "name") return matches.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "newest") {
      return matches.sort((a, b) => (b.released ?? "0000").localeCompare(a.released ?? "0000"));
    }
    if (sort === "oldest") {
      return matches.sort((a, b) => (a.released ?? "9999").localeCompare(b.released ?? "9999"));
    }
    if (sort === "critic") return matches.sort((a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1));
    if (sort === "audience") return matches.sort((a, b) => b.ratingsCount - a.ratingsCount);
    if (sort === "anticipated") return matches.sort((a, b) => b.added - a.added);
    return matches;
  }, [games, normalised, sort]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:p-4">
        <label className="relative min-w-0 flex-1">
          <Search aria-hidden size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <span className="sr-only">Search this collection</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              kind === "company"
                ? "Search this studio’s games…"
                : "Search this franchise…"
            }
            className="h-12 w-full rounded-xl border border-line bg-bg/55 py-2 pl-11 pr-11 text-sm text-text outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.06] hover:text-text"
            >
              <X size={15} />
            </button>
          )}
        </label>

        <label className="relative shrink-0">
          <SlidersHorizontal aria-hidden size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <span className="sr-only">Sort games</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as EntitySort)}
            className="h-12 min-w-40 appearance-none rounded-xl border border-line bg-bg/55 py-2 pl-10 pr-9 text-sm text-text outline-none transition-colors hover:border-line-strong focus:border-brand"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="critic">Best critic score</option>
            <option value="audience">Largest audience</option>
            <option value="anticipated">Most popular</option>
            <option value="name">A–Z</option>
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-faint">▾</span>
        </label>
      </div>

      <p aria-live="polite" className="text-sm text-muted">
        Showing <span className="font-semibold text-text tabular-nums">{visible.length}</span> of{" "}
        <span className="tabular-nums">{filtered.length}</span> matching games
      </p>

      {filtered.length > 0 ? (
        <>
          <GameGrid games={visible} priorityCount={5} />
          {visible.length < filtered.length && (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-line bg-white/[0.025] p-5 text-center">
              <p className="text-xs text-muted"><span className="font-semibold text-text tabular-nums">{filtered.length - visible.length}</span> more games remain in this complete catalogue.</p>
              <button type="button" onClick={() => setVisibleCount((count) => count + 60)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-5 text-sm font-bold text-brand-soft transition-colors hover:border-brand/50 hover:text-white">Load 60 more <ChevronDown size={15} /></button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Search size={23} />}
          title="No matching games"
          body={`Nothing in this collection matches “${query.trim()}”.`}
          action={{ onClick: () => setQuery(""), label: "Clear search" }}
        />
      )}
    </div>
  );
}
