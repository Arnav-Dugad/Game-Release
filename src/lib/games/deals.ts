import type { DealListing } from "./types";

export type DealSort = "discount" | "price" | "name";

export interface DealFilters {
  query?: string;
  minimumDiscount?: number;
  sort?: DealSort;
}

/** Pure filtering shared by the page and provider checks. */
export function filterDeals(deals: DealListing[], filters: DealFilters): DealListing[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  const minimum = Math.max(0, filters.minimumDiscount ?? 0);
  const result = deals.filter(
    (deal) =>
      deal.price.discountPercent >= minimum &&
      (!query ||
        deal.game.name.toLocaleLowerCase().includes(query) ||
        deal.game.genres.some((genre) => genre.name.toLocaleLowerCase().includes(query))),
  );

  switch (filters.sort) {
    case "price":
      return result.sort(
        (a, b) => a.currentAmount - b.currentAmount || b.price.discountPercent - a.price.discountPercent,
      );
    case "name":
      return result.sort((a, b) => a.game.name.localeCompare(b.game.name));
    default:
      return result.sort(
        (a, b) => b.price.discountPercent - a.price.discountPercent || a.currentAmount - b.currentAmount,
      );
  }
}
