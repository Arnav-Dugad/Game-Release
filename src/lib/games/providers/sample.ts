/**
 * Sample provider — the last link in the chain.
 *
 * Serves the bundled catalogue with no network access at all, so the site is
 * always renderable: fresh clone with no credentials, provider outage, rate
 * limit, or offline development. It mirrors the query semantics of the live
 * providers so components behave identically whichever one answers.
 */

import {
  SAMPLE_BY_SLUG,
  SAMPLE_GAMES,
  SAMPLE_GENRES,
  SAMPLE_PLATFORMS,
  toSummary,
} from "../catalogue";
import type { BrowseFilters, GameDetail, GameSummary, Page, SortKey } from "../types";
import type { GameProvider } from "./types";

function sortGames(list: GameSummary[], ordering: SortKey | undefined): GameSummary[] {
  const out = [...list];
  const time = (game: GameSummary) => (game.released ? Date.parse(game.released) : Number.NaN);

  switch (ordering) {
    case "released":
      // Ascending, with undated titles pushed to the end rather than sorted as 0.
      return out.sort((a, b) => {
        const [x, y] = [time(a), time(b)];
        if (Number.isNaN(x) && Number.isNaN(y)) return b.added - a.added;
        if (Number.isNaN(x)) return 1;
        if (Number.isNaN(y)) return -1;
        return x - y;
      });
    case "-released":
      return out.sort((a, b) => {
        const [x, y] = [time(a), time(b)];
        if (Number.isNaN(x) && Number.isNaN(y)) return b.added - a.added;
        if (Number.isNaN(x)) return 1;
        if (Number.isNaN(y)) return -1;
        return y - x;
      });
    case "-rating":
      return out.sort((a, b) => b.rating - a.rating || b.added - a.added);
    case "-metacritic":
      return out.sort((a, b) => (b.metacritic ?? 0) - (a.metacritic ?? 0) || b.added - a.added);
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out.sort((a, b) => b.added - a.added);
  }
}

function filterGames(filters: BrowseFilters): GameSummary[] {
  let list = SAMPLE_GAMES.map(toSummary);

  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase();
    const terms = query.split(/\s+/);
    list = list.filter((game) => {
      const haystack = `${game.name} ${game.genres.map((g) => g.name).join(" ")}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
    // Prefix matches on the title are far more likely to be what was meant.
    list.sort((a, b) => {
      const rank = (game: GameSummary) => (game.name.toLowerCase().startsWith(query) ? 0 : 1);
      return rank(a) - rank(b) || b.added - a.added;
    });
  }

  if (filters.genres) {
    const wanted = new Set(filters.genres.split(",").filter(Boolean));
    list = list.filter((game) =>
      game.genres.some((genre) => wanted.has(genre.slug) || wanted.has(String(genre.id))),
    );
  }

  if (filters.platforms) {
    const wanted = new Set(filters.platforms.split(",").filter(Boolean));
    list = list.filter((game) =>
      game.parentPlatforms.some((p) => wanted.has(p.slug) || wanted.has(String(p.id))),
    );
  }

  if (filters.dates) {
    const [from, to] = filters.dates.split(",");
    list = list.filter(
      (game) => game.released !== null && game.released >= from && game.released <= to,
    );
  }

  if (filters.metacritic) {
    const [lo, hi] = filters.metacritic.split(",").map(Number);
    list = list.filter(
      (game) => game.metacritic !== null && game.metacritic >= lo && game.metacritic <= hi,
    );
  }

  // Search results keep their relevance order; everything else gets sorted.
  return filters.search?.trim() && !filters.ordering ? list : sortGames(list, filters.ordering);
}

function paginate(list: GameSummary[], page: number, pageSize: number): Page<GameSummary> {
  const start = (page - 1) * pageSize;
  return {
    results: list.slice(start, start + pageSize),
    count: list.length,
    hasNext: start + pageSize < list.length,
    page,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

const shiftDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const sampleProvider: GameProvider = {
  id: "sample",

  isConfigured() {
    return true;
  },

  async browse(filters: BrowseFilters) {
    return paginate(
      filterGames(filters),
      Math.max(1, filters.page ?? 1),
      filters.pageSize ?? 24,
    );
  },

  async upcoming(pageSize: number, page: number) {
    const upcoming = SAMPLE_GAMES.map(toSummary).filter(
      (game) => game.tba || Boolean(game.releaseWindow) || (game.released ?? "") >= today(),
    );
    return paginate(sortGames(upcoming, "released"), page, pageSize);
  },

  async trending(pageSize: number) {
    const released = SAMPLE_GAMES.map(toSummary).filter((game) => game.released !== null);
    return sortGames(released, "-added").slice(0, pageSize);
  },

  async topRated(pageSize: number) {
    const scored = SAMPLE_GAMES.map(toSummary).filter((game) => (game.metacritic ?? 0) >= 88);
    return sortGames(scored, "-metacritic").slice(0, pageSize);
  },

  async newReleases(pageSize: number) {
    const recent = SAMPLE_GAMES.map(toSummary).filter((game) => game.released !== null);
    return sortGames(recent, "-released").slice(0, pageSize);
  },

  async detail(slug: string) {
    return SAMPLE_BY_SLUG.get(slug) ?? null;
  },

  async related(game: GameDetail, limit: number) {
    const wanted = new Set(game.genres.map((genre) => genre.slug));
    return SAMPLE_GAMES.map(toSummary)
      .filter((candidate) => candidate.slug !== game.slug)
      .map((candidate) => ({
        candidate,
        score: candidate.genres.filter((genre) => wanted.has(genre.slug)).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.candidate.added - a.candidate.added)
      .slice(0, limit)
      .map((entry) => entry.candidate);
  },

  async genres() {
    return SAMPLE_GENRES;
  },

  async platforms() {
    return SAMPLE_PLATFORMS;
  },
};

/** Kept for the date-window helpers used by callers building browse filters. */
export const sampleDateHelpers = { today, shiftDays };
