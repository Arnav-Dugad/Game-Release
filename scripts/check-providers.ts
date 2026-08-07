/**
 * Self-checks for the pure logic in the data layer.
 *
 * These functions decide what date a user is shown and which provider owns a
 * slug, and they cannot be exercised against the live APIs from every
 * environment. Everything here is deterministic, so it is worth pinning down.
 *
 * Run with:  npx tsx scripts/check-providers.ts
 */

import { appidFromSlug, parseSteamDate, steamSlug } from "../src/lib/games/providers/steam";
import { sizedImage } from "../src/lib/games/image";
import { platformKey, releaseLabel, isUnreleased } from "../src/lib/utils/format";
import { stripHtml, slugify } from "../src/lib/utils/html";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${b}\n         actual   ${a}`);
  }
}

console.log("\nSteam release-date parsing");
check("exact, day first", parseSteamDate("25 Feb, 2022"), {
  released: "2022-02-25",
  releaseWindow: null,
  tba: false,
});
check("exact, month first", parseSteamDate("Feb 25, 2022"), {
  released: "2022-02-25",
  releaseWindow: null,
  tba: false,
});
check("exact, full month name", parseSteamDate("3 September 2025"), {
  released: "2025-09-03",
  releaseWindow: null,
  tba: false,
});
check("quarter stays a window", parseSteamDate("Q4 2026"), {
  released: null,
  releaseWindow: "Q4 2026",
  tba: false,
});
check("month-year stays a window", parseSteamDate("March 2026"), {
  released: null,
  releaseWindow: "March 2026",
  tba: false,
});
check("bare year stays a window", parseSteamDate("2027"), {
  released: null,
  releaseWindow: "2027",
  tba: false,
});
check("marketing filler is TBA", parseSteamDate("Coming soon"), {
  released: null,
  releaseWindow: null,
  tba: true,
});
check("empty is TBA", parseSteamDate(undefined), {
  released: null,
  releaseWindow: null,
  tba: true,
});

console.log("\nSteam slug round-trip");
check("mints a readable slug", steamSlug("ELDEN RING", 1245620), "elden-ring-s1245620");
check("recovers the appid", appidFromSlug("elden-ring-s1245620"), 1245620);
check("punctuation is stripped", steamSlug("Baldur's Gate 3", 1086940), "baldurs-gate-3-s1086940");
check("recovers from punctuated slug", appidFromSlug("baldurs-gate-3-s1086940"), 1086940);
check("foreign slug is not claimed", appidFromSlug("the-witcher-3-wild-hunt"), null);
check("trailing digits alone are not an appid", appidFromSlug("half-life-2"), null);

console.log("\nPlatform vocabulary normalisation");
check("IGDB windows", platformKey("win"), "pc");
check("IGDB ps5", platformKey("ps5"), "playstation");
check("IGDB ps4 variant", platformKey("ps4--1"), "playstation");
check("IGDB series x|s", platformKey("series-x-s"), "xbox");
check("IGDB xbox one", platformKey("xboxone"), "xbox");
check("IGDB switch", platformKey("switch"), "nintendo");
check("IGDB n64", platformKey("n64"), "nintendo");
check("psp is playstation", platformKey("psp"), "playstation");
check("family slug maps to itself", platformKey("playstation"), "playstation");
check("mobile family", platformKey("mobile"), "mobile");
check("ios collapses to mobile", platformKey("ios"), "mobile");
check("unknown is dropped", platformKey("dreamcast"), null);

console.log("\nIGDB image resizing");
const cover = "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg";
check(
  "downsizes for a card",
  sizedImage(cover, 240),
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
);
check(
  "upsizes for a hero",
  sizedImage(cover, 1920),
  "https://images.igdb.com/igdb/image/upload/t_1080p/co4jni.jpg",
);
check(
  "non-IGDB host is untouched",
  sizedImage("https://cdn.cloudflare.steamstatic.com/steam/apps/1/header.jpg", 1920),
  "https://cdn.cloudflare.steamstatic.com/steam/apps/1/header.jpg",
);
check("null stays null", sizedImage(null, 800), null);

console.log("\nRelease labelling");
check(
  "exact date formats",
  releaseLabel({ released: "2022-02-25", releaseWindow: null, tba: false }),
  "Feb 25, 2022",
);
check(
  "window prints verbatim",
  releaseLabel({ released: null, releaseWindow: "Q4 2026", tba: false }),
  "Q4 2026",
);
check(
  "nothing known reads as TBA",
  releaseLabel({ released: null, releaseWindow: null, tba: true }),
  "Date TBA",
);
check(
  "a window counts as unreleased",
  isUnreleased({ released: null, releaseWindow: "Q4 2026", tba: false }),
  true,
);
check(
  "a past date is released",
  isUnreleased({ released: "2020-01-01", releaseWindow: null, tba: false }),
  false,
);

console.log("\nHTML handling");
check(
  // A closing </p> and a <br> each contribute a break, so the paragraph gap is
  // intentional — `whitespace-pre-wrap` renders it as a blank line.
  "tags removed, entities decoded",
  stripHtml("<p>Requires a 64-bit&nbsp;processor</p><br><strong>OS:</strong> Windows 10"),
  "Requires a 64-bit processor\n\nOS: Windows 10",
);
check(
  "runs of blank lines are capped",
  stripHtml("<p>A</p><br><br><br><br><p>B</p>"),
  "A\n\nB",
);
check("list markers survive", stripHtml("<ul><li>One</li><li>Two</li></ul>"), "• One\n• Two");
check("apostrophes decode", stripHtml("Baldur&#39;s Gate"), "Baldur's Gate");
check("slugify", slugify("Hack and slash/Beat 'em up"), "hack-and-slash-beat-em-up");

console.log(
  failures === 0
    ? "\nAll provider self-checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
