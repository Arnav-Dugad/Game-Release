/**
 * Generates `src/components/brand/brand-icons.ts` from Simple Icons.
 *
 * Why generate instead of importing at runtime: the icon packages carry ~3,400
 * icons and we need about two dozen. Extracting just those paths into a plain
 * module keeps them out of the dependency graph entirely — the client bundle
 * ships a few kilobytes of path data instead of a package.
 *
 * Two sources are used. Recent Simple Icons releases removed the Xbox and
 * Nintendo marks, so those come from `simple-icons-legacy` — an npm alias
 * pinning v11, which still carries them. Both are devDependencies used only
 * here and never reach the app's dependency graph.
 *
 * Run with: npm run icons
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const latest = require("simple-icons");
const legacy = require("simple-icons-legacy");

/** [outputKey, iconExport, source, displayName, fallbackHex] */
const ICONS = [
  // Platform families
  ["playstation", "siPlaystation", latest, "PlayStation"],
  ["xbox", "siXbox", legacy, "Xbox"],
  ["nintendo", "siNintendoswitch", legacy, "Nintendo"],
  ["linux", "siLinux", latest, "Linux"],
  ["mac", "siApple", latest, "macOS"],
  ["mobile", "siGoogleplay", latest, "Mobile"],

  // Storefronts
  ["steam", "siSteam", latest, "Steam"],
  ["epic", "siEpicgames", latest, "Epic Games Store"],
  ["gog", "siGogdotcom", latest, "GOG"],
  ["itch", "siItchdotio", latest, "itch.io"],
  ["ea", "siEa", latest, "EA"],
  ["ubisoft", "siUbisoft", latest, "Ubisoft"],
  ["battlenet", "siBattledotnet", latest, "Battle.net"],
  ["humble", "siHumblebundle", latest, "Humble"],
  ["googleplay", "siGoogleplay", latest, "Google Play"],
  ["appstore", "siAppstore", latest, "App Store"],

  // Social / reference
  ["youtube", "siYoutube", latest, "YouTube"],
  ["twitch", "siTwitch", latest, "Twitch"],
  ["discord", "siDiscord", latest, "Discord"],
  ["reddit", "siReddit", latest, "Reddit"],
  ["x", "siX", latest, "X"],
  ["wikipedia", "siWikipedia", latest, "Wikipedia"],
  ["fandom", "siFandom", latest, "Fandom"],
  ["metacritic", "siMetacritic", latest, "Metacritic"],
];

/**
 * Brand colours, overriding Simple Icons where its value is pure black.
 * A #000 mark is invisible on this app's near-black surfaces, so those get the
 * platform's secondary brand colour or a legible neutral instead.
 */
const COLOUR_OVERRIDES = {
  steam: "#c7d5e0",
  epic: "#ffffff",
  ea: "#ff4747",
  ubisoft: "#ffffff",
  x: "#ffffff",
  wikipedia: "#ffffff",
  mac: "#ffffff",
  xbox: "#107c10",
  nintendo: "#e60012",
};

const rows = [];
const missing = [];

for (const [key, exportName, source, label] of ICONS) {
  const icon = source[exportName];
  if (!icon) {
    missing.push(`${key} (${exportName})`);
    continue;
  }
  rows.push({
    key,
    label,
    path: icon.path,
    hex: COLOUR_OVERRIDES[key] ?? `#${icon.hex}`,
  });
}

if (missing.length > 0) {
  console.error("Missing icons:", missing.join(", "));
  process.exit(1);
}

const body = rows
  .map(
    (row) =>
      `  ${row.key}: {\n` +
      `    label: ${JSON.stringify(row.label)},\n` +
      `    colour: ${JSON.stringify(row.hex)},\n` +
      `    path: ${JSON.stringify(row.path)},\n` +
      `  },`,
  )
  .join("\n");

const output = `// GENERATED FILE — do not edit by hand. Run \`npm run icons\` to regenerate.
//
// Brand marks extracted from Simple Icons (icon paths are CC0). The trademarks
// themselves remain the property of their respective owners and are used here
// only to identify the platform or storefront a game is available on.

export interface BrandIcon {
  label: string;
  /** Official brand colour, adjusted where the true colour is unreadable on a dark surface. */
  colour: string;
  /** SVG path data, drawn in a 24x24 viewBox. */
  path: string;
}

export const BRAND_ICONS = {
${body}
} as const satisfies Record<string, BrandIcon>;

export type BrandKey = keyof typeof BRAND_ICONS;

export function brandIcon(key: string): BrandIcon | null {
  return (BRAND_ICONS as Record<string, BrandIcon>)[key] ?? null;
}
`;

mkdirSync("src/components/brand", { recursive: true });
writeFileSync("src/components/brand/brand-icons.ts", output);
console.log(`Wrote ${rows.length} brand icons to src/components/brand/brand-icons.ts`);
