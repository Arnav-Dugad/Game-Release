export type DirectorySearchParams = Record<string, string | string[] | undefined>;
export type DirectoryOrder = "name" | "-name";

export interface DirectoryQuery {
  query: string;
  page: number;
  order: DirectoryOrder;
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Turns a shareable directory URL into a bounded provider query. */
export function parseDirectorySearchParams(params: DirectorySearchParams): DirectoryQuery {
  const query = (first(params.q) ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    query,
    page: Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), 1000) : 1,
    order: first(params.sort) === "desc" ? "-name" : "name",
  };
}

/** Safely adds a case-insensitive name filter to an APICalypse where clause. */
export function buildDirectoryWhere(base: string, query: string): string {
  if (!query) return base;
  const safe = query.replace(/[\\"*;&|()]/g, " ").replace(/\s+/g, " ").trim();
  return safe ? `${base} & name ~ *"${safe}"*` : base;
}
