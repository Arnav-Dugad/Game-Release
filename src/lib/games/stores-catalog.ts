/**
 * The places a game can be owned, and the currencies Steam prices in.
 *
 * Kept separate from `stores.ts` (which classifies URLs found on a game
 * record) because this is a *user-facing vocabulary*: what someone picks when
 * saying "I own this on…", and what they pick in settings. The two overlap but
 * answer different questions — a game can link to a storefront the reader
 * doesn't own it on, and someone can own a game on a console that has no
 * store link at all.
 */

export interface OwnershipPlatform {
  slug: string;
  name: string;
  /** Brand icon key, when one exists in the generated set. */
  icon: string | null;
}

/**
 * Ordered by how commonly people actually own games there, so the most likely
 * answer is never buried.
 */
export const OWNERSHIP_PLATFORMS: OwnershipPlatform[] = [
  { slug: "steam", name: "Steam", icon: "steam" },
  { slug: "playstation", name: "PlayStation", icon: "playstation" },
  { slug: "xbox", name: "Xbox", icon: "xbox" },
  { slug: "nintendo", name: "Nintendo", icon: "nintendo" },
  { slug: "epic", name: "Epic Games", icon: "epic" },
  { slug: "gog", name: "GOG", icon: "gog" },
  { slug: "battlenet", name: "Battle.net", icon: "battlenet" },
  { slug: "ea", name: "EA App", icon: "ea" },
  { slug: "ubisoft", name: "Ubisoft Connect", icon: "ubisoft" },
  { slug: "itch", name: "itch.io", icon: "itch" },
  { slug: "googleplay", name: "Google Play", icon: "googleplay" },
  { slug: "appstore", name: "App Store", icon: "appstore" },
  { slug: "physical", name: "Physical copy", icon: null },
  { slug: "other", name: "Other", icon: null },
];

const OWNERSHIP_BY_SLUG = new Map(OWNERSHIP_PLATFORMS.map((p) => [p.slug, p]));

export function ownershipPlatform(slug: string): OwnershipPlatform | null {
  return OWNERSHIP_BY_SLUG.get(slug) ?? null;
}

/* ---------------------------------------------------------------------------
 * Steam storefront regions
 * ------------------------------------------------------------------------ */

export interface SteamRegion {
  /** Steam's `cc` country code. */
  cc: string;
  name: string;
  currency: string;
}

/**
 * Steam prices in the currency of the country code passed as `cc`, so picking
 * a region is really picking a currency. This is the subset Steam supports
 * with distinct pricing, which is what makes the choice meaningful.
 */
export const STEAM_REGIONS: SteamRegion[] = [
  { cc: "us", name: "United States", currency: "USD" },
  { cc: "gb", name: "United Kingdom", currency: "GBP" },
  { cc: "de", name: "Germany", currency: "EUR" },
  { cc: "fr", name: "France", currency: "EUR" },
  { cc: "in", name: "India", currency: "INR" },
  { cc: "ca", name: "Canada", currency: "CAD" },
  { cc: "au", name: "Australia", currency: "AUD" },
  { cc: "br", name: "Brazil", currency: "BRL" },
  { cc: "jp", name: "Japan", currency: "JPY" },
  { cc: "cn", name: "China", currency: "CNY" },
  { cc: "ru", name: "Russia", currency: "RUB" },
  { cc: "kr", name: "South Korea", currency: "KRW" },
  { cc: "mx", name: "Mexico", currency: "MXN" },
  { cc: "pl", name: "Poland", currency: "PLN" },
  { cc: "tr", name: "Türkiye", currency: "TRY" },
  { cc: "za", name: "South Africa", currency: "ZAR" },
  { cc: "sg", name: "Singapore", currency: "SGD" },
  { cc: "ar", name: "Argentina", currency: "ARS" },
];

export const DEFAULT_STEAM_REGION = "us";

/** Validates an untrusted region code before it reaches a Steam URL. */
export function isValidRegion(cc: string): boolean {
  return STEAM_REGIONS.some((region) => region.cc === cc);
}

export function steamRegion(cc: string): SteamRegion {
  return STEAM_REGIONS.find((region) => region.cc === cc) ?? STEAM_REGIONS[0];
}
