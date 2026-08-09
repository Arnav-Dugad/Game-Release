/**
 * The places a game can be owned.
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
