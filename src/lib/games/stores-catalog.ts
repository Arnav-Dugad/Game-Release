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

/**
 * Where a play session actually happens.
 *
 * PC launchers are deliberately separate: "PC" loses the useful distinction
 * between Steam, Epic, GOG, Game Pass, and publisher launchers. Console,
 * mobile, cloud, and browser targets remain in the same vocabulary so the
 * watchlist never needs a second incompatible field.
 */
export interface PlayingLocation extends OwnershipPlatform {
  group: "PC launchers" | "Consoles & handhelds" | "Mobile & desktop" | "Cloud & other";
}

export const PLAYING_LOCATIONS: PlayingLocation[] = [
  { slug: "steam", name: "PC · Steam", icon: "steam", group: "PC launchers" },
  { slug: "epic", name: "PC · Epic Games", icon: "epic", group: "PC launchers" },
  { slug: "gog", name: "PC · GOG", icon: "gog", group: "PC launchers" },
  { slug: "xbox-pc", name: "PC · Xbox app / Game Pass", icon: "xbox", group: "PC launchers" },
  { slug: "ea", name: "PC · EA app", icon: "ea", group: "PC launchers" },
  { slug: "ubisoft", name: "PC · Ubisoft Connect", icon: "ubisoft", group: "PC launchers" },
  { slug: "battlenet", name: "PC · Battle.net", icon: "battlenet", group: "PC launchers" },
  { slug: "itch", name: "PC · itch.io", icon: "itch", group: "PC launchers" },
  { slug: "amazon-games", name: "PC · Amazon Games", icon: "amazon", group: "PC launchers" },
  { slug: "rockstar", name: "PC · Rockstar Launcher", icon: "rockstar", group: "PC launchers" },
  { slug: "riot", name: "PC · Riot Client", icon: "riot", group: "PC launchers" },
  { slug: "direct-pc", name: "PC · Direct / standalone", icon: null, group: "PC launchers" },
  { slug: "ps5", name: "PlayStation 5", icon: "playstation", group: "Consoles & handhelds" },
  { slug: "ps4", name: "PlayStation 4", icon: "playstation", group: "Consoles & handhelds" },
  { slug: "playstation", name: "PlayStation · Other generation", icon: "playstation", group: "Consoles & handhelds" },
  { slug: "xbox-series", name: "Xbox Series X|S", icon: "xbox", group: "Consoles & handhelds" },
  { slug: "xbox-one", name: "Xbox One", icon: "xbox", group: "Consoles & handhelds" },
  { slug: "xbox", name: "Xbox · Other generation", icon: "xbox", group: "Consoles & handhelds" },
  { slug: "switch-2", name: "Nintendo Switch 2", icon: "nintendo", group: "Consoles & handhelds" },
  { slug: "nintendo", name: "Nintendo Switch", icon: "nintendo", group: "Consoles & handhelds" },
  { slug: "steam-deck", name: "Steam Deck", icon: "steam", group: "Consoles & handhelds" },
  { slug: "windows-handheld", name: "Windows handheld", icon: null, group: "Consoles & handhelds" },
  { slug: "mac", name: "macOS", icon: "mac", group: "Mobile & desktop" },
  { slug: "linux", name: "Linux", icon: "linux", group: "Mobile & desktop" },
  { slug: "googleplay", name: "Android · Google Play", icon: "googleplay", group: "Mobile & desktop" },
  { slug: "appstore", name: "iPhone/iPad · App Store", icon: "appstore", group: "Mobile & desktop" },
  { slug: "geforce-now", name: "Cloud · GeForce NOW", icon: "nvidia", group: "Cloud & other" },
  { slug: "xbox-cloud", name: "Cloud · Xbox Cloud Gaming", icon: "xbox", group: "Cloud & other" },
  { slug: "amazon-luna", name: "Cloud · Amazon Luna", icon: "amazonluna", group: "Cloud & other" },
  { slug: "browser", name: "Web browser", icon: null, group: "Cloud & other" },
  { slug: "other", name: "Another platform", icon: null, group: "Cloud & other" },
];

const PLAYING_BY_SLUG = new Map(PLAYING_LOCATIONS.map((location) => [location.slug, location]));

export function playingLocation(slug: string): OwnershipPlatform | null {
  return PLAYING_BY_SLUG.get(slug) ?? null;
}

/* ---------------------------------------------------------------------------
 * Steam storefront regions
 * ------------------------------------------------------------------------ */
