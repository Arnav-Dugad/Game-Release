/**
 * Classifies a URL into a known storefront or social platform by hostname.
 *
 * IGDB used to expose a `websites.category` enum, but that field has been
 * renamed across API revisions and requesting the wrong spelling fails the
 * whole query. Hostnames never change shape, so classifying the URL itself is
 * both more robust and more precise — it also recovers the Steam appid without
 * a second lookup.
 */

export type LinkKind = "store" | "social" | "wiki";

export interface LinkMatch {
  /** Stable key, also used to pick the brand icon. */
  slug: string;
  name: string;
  domain: string;
  kind: LinkKind;
  /** Only set for Steam store links. */
  steamAppId?: number;
}

interface Rule {
  slug: string;
  name: string;
  kind: LinkKind;
  /** Matched against the hostname with a suffix test, so subdomains count. */
  hosts: string[];
}

const RULES: Rule[] = [
  { slug: "steam", name: "Steam", kind: "store", hosts: ["steampowered.com", "steamcommunity.com"] },
  { slug: "epic", name: "Epic Games Store", kind: "store", hosts: ["epicgames.com"] },
  { slug: "gog", name: "GOG", kind: "store", hosts: ["gog.com"] },
  { slug: "playstation", name: "PlayStation Store", kind: "store", hosts: ["playstation.com"] },
  { slug: "xbox", name: "Xbox", kind: "store", hosts: ["xbox.com"] },
  { slug: "nintendo", name: "Nintendo eShop", kind: "store", hosts: ["nintendo.com", "nintendo.co.jp"] },
  { slug: "itch", name: "itch.io", kind: "store", hosts: ["itch.io"] },
  { slug: "ea", name: "EA App", kind: "store", hosts: ["ea.com", "origin.com"] },
  { slug: "ubisoft", name: "Ubisoft Store", kind: "store", hosts: ["ubisoft.com", "ubi.com"] },
  { slug: "battlenet", name: "Battle.net", kind: "store", hosts: ["battle.net", "blizzard.com"] },
  { slug: "humble", name: "Humble Store", kind: "store", hosts: ["humblebundle.com"] },
  { slug: "googleplay", name: "Google Play", kind: "store", hosts: ["play.google.com"] },
  { slug: "appstore", name: "App Store", kind: "store", hosts: ["apps.apple.com", "itunes.apple.com"] },

  { slug: "youtube", name: "YouTube", kind: "social", hosts: ["youtube.com", "youtu.be"] },
  { slug: "twitch", name: "Twitch", kind: "social", hosts: ["twitch.tv"] },
  { slug: "discord", name: "Discord", kind: "social", hosts: ["discord.gg", "discord.com"] },
  { slug: "reddit", name: "Reddit", kind: "social", hosts: ["reddit.com"] },
  { slug: "x", name: "X", kind: "social", hosts: ["twitter.com", "x.com"] },
  { slug: "instagram", name: "Instagram", kind: "social", hosts: ["instagram.com"] },
  { slug: "facebook", name: "Facebook", kind: "social", hosts: ["facebook.com"] },
  { slug: "bluesky", name: "Bluesky", kind: "social", hosts: ["bsky.app"] },

  { slug: "wikipedia", name: "Wikipedia", kind: "wiki", hosts: ["wikipedia.org"] },
  { slug: "fandom", name: "Fandom", kind: "wiki", hosts: ["fandom.com", "wikia.com"] },
];

/** `store.steampowered.com/app/1245620/Elden_Ring/` → 1245620 */
function steamAppIdFrom(url: URL): number | undefined {
  const match = url.pathname.match(/\/app\/(\d+)/);
  if (!match) return undefined;
  const appid = Number(match[1]);
  return Number.isFinite(appid) ? appid : undefined;
}

export function classifyUrl(raw: string): LinkMatch | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const rule of RULES) {
    const hit = rule.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
    if (!hit) continue;

    return {
      slug: rule.slug,
      name: rule.name,
      domain: host,
      kind: rule.kind,
      ...(rule.slug === "steam" ? { steamAppId: steamAppIdFrom(url) } : {}),
    };
  }

  return null;
}

/** Convenience wrapper for callers that only care about storefronts. */
export function storeFromUrl(raw: string): LinkMatch | null {
  const match = classifyUrl(raw);
  return match && match.kind === "store" ? match : null;
}
