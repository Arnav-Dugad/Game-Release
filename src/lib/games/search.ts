export type SearchKind =
  | "game"
  | "franchise"
  | "company"
  | "character"
  | "genre"
  | "platform";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  name: string;
  slug: string;
  subtitle: string | null;
  image: string | null;
  /** Game-only release metadata; absent for every other entity kind. */
  released?: string | null;
  releaseWindow?: string | null;
  tba?: boolean;
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  game: "Games",
  franchise: "Franchises",
  company: "Studios",
  character: "Characters",
  genre: "Genres",
  platform: "Platforms",
};

export const SEARCH_KIND_ORDER: SearchKind[] = [
  "game",
  "franchise",
  "company",
  "character",
  "genre",
  "platform",
];

export function hrefForSearchHit(hit: SearchHit): string {
  switch (hit.kind) {
    case "franchise":
      return `/franchise/${hit.slug}`;
    case "company":
      return `/studio/${hit.slug}`;
    case "character":
      return `/character/${hit.slug}`;
    case "genre":
      return `/browse?genres=${encodeURIComponent(hit.slug)}`;
    case "platform":
      return `/browse?platforms=${encodeURIComponent(hit.slug)}`;
    default:
      return `/game/${hit.slug}`;
  }
}

export function groupSearchHits(hits: SearchHit[]): Map<SearchKind, SearchHit[]> {
  const groups = new Map<SearchKind, SearchHit[]>();
  for (const kind of SEARCH_KIND_ORDER) groups.set(kind, []);
  for (const hit of hits) groups.get(hit.kind)?.push(hit);
  return groups;
}
