/** Shared human-friendly title matching for catalogue and Firebase lists. */

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5",
  vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
};

const STOP_WORDS = new Set(["a", "an", "and", "of", "the", "to"]);

const QUERY_ALIASES: Record<string, string[]> = {
  ac: ["assassins creed", "animal crossing"],
  cod: ["call of duty"],
  cs: ["counter strike"],
  ff: ["final fantasy"],
  fifa: ["ea sports fc"],
  gow: ["god of war", "gears of war"],
  gta: ["grand theft auto"],
  lol: ["league of legends"],
  nfs: ["need for speed"],
  pubg: ["playerunknowns battlegrounds"],
  rdr: ["red dead redemption"],
  re: ["resident evil"],
  tlou: ["the last of us"],
  tloz: ["the legend of zelda"],
  wow: ["world of warcraft"],
};

export const EDITION_MARKERS =
  /\b(collector|deluxe|ultimate|goty|game of the year|complete|definitive|remaster|bundle|edition|pack|season pass|demo|trial|beta)\b/;

/** Canonicalises punctuation, accents, ampersands, and Roman-numeral sequels. */
export function normaliseSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((token) => ROMAN[token] ?? token)
    .join(" ");
}

/** Expands common abbreviations without changing what the user typed. */
export function searchQueryVariants(query: string): string[] {
  const normalised = normaliseSearch(query);
  if (!normalised) return [];
  const variants = new Set([normalised]);
  const tokens = normalised.split(" ");
  for (const token of tokens) {
    for (const alias of QUERY_ALIASES[token] ?? []) {
      variants.add(normaliseSearch(tokens.map((part) => part === token ? alias : part).join(" ")));
    }
  }
  return [...variants];
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[left.length][right.length];
}

const ratio = (left: string, right: string) =>
  editDistance(left, right) / Math.max(left.length, right.length, 1);
const meaningful = (tokens: string[]) => tokens.filter((token) => !STOP_WORDS.has(token));
const compact = (tokens: string[]) => meaningful(tokens).join("");
const initials = (tokens: string[]) => meaningful(tokens)
  .map((token) => /^\d+$/.test(token) ? token : token[0])
  .join("");

function directTier(title: string, query: string): number {
  if (title === query) return 0;
  if (title.startsWith(`${query} `)) return 1;
  if (title.startsWith(query)) return 2;
  if (` ${title} `.includes(` ${query} `)) return 3;
  if (title.includes(query)) return 4;
  return 5;
}

/** Exact, acronym, reordered-token, alias, and typo-aware title score. */
export function fuzzyTitleScore(candidate: string, query: string): number {
  const title = normaliseSearch(candidate);
  if (!title) return 99;
  let best = 99;

  for (const variant of searchQueryVariants(query)) {
    const tier = directTier(title, variant);
    if (tier < 5) best = Math.min(best, tier);

    const titleTokens = title.split(" ");
    const queryTokens = variant.split(" ");
    if (compact(queryTokens).length >= 2 && initials(titleTokens) === compact(queryTokens)) {
      best = Math.min(best, 2.5);
    }

    const requested = meaningful(queryTokens);
    const available = meaningful(titleTokens);
    if (requested.length === 0 || available.length === 0) continue;
    const tokenCost = requested.reduce((sum, token) => sum + Math.min(
      ...available.map((titleToken) => {
        if (titleToken.startsWith(token) || token.startsWith(titleToken)) {
          const gap = Math.abs(titleToken.length - token.length);
          if (gap <= 2) return gap / Math.max(titleToken.length, token.length);
        }
        return ratio(titleToken, token);
      }),
    ), 0) / requested.length;
    const phraseCost = ratio(compact(available), compact(requested));
    const cost = Math.min(tokenCost, phraseCost);
    if (cost <= 0.48) best = Math.min(best, 6 + cost);
  }

  return best;
}

export function fuzzyMatches(candidate: string, query: string): boolean {
  return !query.trim() || fuzzyTitleScore(candidate, query) < 99;
}
