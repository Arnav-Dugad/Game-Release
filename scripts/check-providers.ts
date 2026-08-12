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
import { classifyUrl, storeFromUrl } from "../src/lib/games/stores";
import { buildTasteProfile, MIN_TASTE_STRENGTH } from "../src/lib/games/taste";
import { buildDirectoryWhere, parseDirectorySearchParams } from "../src/lib/games/directory";
import { canonicalEntryHref, releaseNotifications } from "../src/lib/notifications/model";
import { groupSearchHits, hrefForSearchHit, type SearchHit } from "../src/lib/games/search";
import { buildDashboardSnapshot, daysUntilRelease } from "../src/lib/games/dashboard";
import { buildLibraryStats } from "../src/lib/games/stats";
import { releaseState } from "../src/lib/games/release-state";
import { fuzzyMatches, normaliseSearch, searchQueryVariants } from "../src/lib/games/fuzzy-search";
import type { WatchlistEntry } from "../src/lib/firebase/db";

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
  // 240px CSS is ~480px on a retina display, so the ladder deliberately stays
  // at the 528px asset rather than dropping to the 264px one.
  "card width keeps the retina-sized asset",
  sizedImage(cover, 240),
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
);
check(
  "thumbnail width does drop to the small asset",
  sizedImage(cover, 96),
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
);
check(
  "hero preserves the portrait cover transform",
  sizedImage(cover, 1920),
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
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
  "a future window counts as unreleased",
  isUnreleased({ released: null, releaseWindow: "Q4 2099", tba: false }),
  true,
);
check(
  "a past date is released",
  isUnreleased({ released: "2020-01-01", releaseWindow: null, tba: false }),
  false,
);
check(
  "missing provider dates stay unknown, not upcoming",
  releaseState({ released: null, releaseWindow: null, tba: true }, new Date("2026-08-12T12:00:00Z")),
  "unknown",
);
check(
  "an expired release window is released",
  releaseState({ released: null, releaseWindow: "Q4 2020", tba: false }, new Date("2026-08-12T12:00:00Z")),
  "released",
);
check(
  "a confirmed future quarter is upcoming",
  releaseState({ released: null, releaseWindow: "Q4 2026", tba: false }, new Date("2026-08-12T12:00:00Z")),
  "upcoming",
);

console.log("\nStore/link classification");
check(
  "steam store link yields the appid",
  classifyUrl("https://store.steampowered.com/app/1245620/ELDEN_RING/"),
  { slug: "steam", name: "Steam", domain: "store.steampowered.com", kind: "store", steamAppId: 1245620 },
);
check(
  "epic is a store",
  classifyUrl("https://store.epicgames.com/en-US/p/alan-wake-2")?.slug,
  "epic",
);
check("gog is a store", classifyUrl("https://www.gog.com/game/cyberpunk_2077")?.slug, "gog");
check(
  "playstation store",
  classifyUrl("https://store.playstation.com/en-us/product/UP9000-PPSA01284_00")?.slug,
  "playstation",
);
check("nintendo eshop", classifyUrl("https://www.nintendo.com/store/products/x/")?.slug, "nintendo");
check("youtube is social, not a store", classifyUrl("https://youtube.com/watch?v=x")?.kind, "social");
check("storeFromUrl rejects social links", storeFromUrl("https://twitter.com/fromsoftware"), null);
check("an official site matches nothing", classifyUrl("https://eldenring.bandainamco.com"), null);
check("garbage input is safe", classifyUrl("not a url"), null);

console.log("\nTaste profile");
{
  const now = Date.parse("2026-08-01T00:00:00Z");
  const recent = now - 1000 * 60 * 60 * 24 * 10;
  const old = now - 1000 * 60 * 60 * 24 * 900;

  const profile = buildTasteProfile(
    [
      // Finished recently — the strongest possible signal.
      { gameId: 1, genreIds: [12], platformSlugs: ["playstation"], status: "played",
        platform: "playstation", addedAt: recent, finishedAt: recent },
      { gameId: 2, genreIds: [12], platformSlugs: ["playstation"], status: "played",
        platform: "playstation", addedAt: recent, finishedAt: recent },
      // Wishlisted long ago — should barely register.
      { gameId: 3, genreIds: [15], platformSlugs: ["pc"], status: "want",
        platform: null, addedAt: old, finishedAt: null },
    ],
    { now },
  );
  check("strongest genre wins", profile.genreIds[0], 12);
  check("recorded play platform leads", profile.platformSlugs[0], "playstation");
  check("everything seen is excluded", profile.excludeIds.sort(), [1, 2, 3]);
  check("strength reflects real evidence", profile.strength > MIN_TASTE_STRENGTH, true);
}
{
  // A single stale wishlist entry is not a taste profile.
  const now = Date.parse("2026-08-01T00:00:00Z");
  const thin = buildTasteProfile(
    [
      {
        gameId: 9,
        genreIds: [4],
        platformSlugs: ["pc"],
        status: "want",
        platform: null,
        addedAt: now - 1000 * 60 * 60 * 24 * 1200,
        finishedAt: null,
      },
    ],
    { now },
  );
  check("thin evidence stays below the threshold", thin.strength < MIN_TASTE_STRENGTH, true);
}
check("no library yields no profile", buildTasteProfile([]).genreIds, []);

console.log("\nDirectory URL parsing");
check("defaults are stable", parseDirectorySearchParams({}), {
  query: "",
  page: 1,
  order: "name",
});
check("search, page and descending sort", parseDirectorySearchParams({
  q: "  CD Projekt  ",
  page: "4",
  sort: "desc",
}), {
  query: "CD Projekt",
  page: 4,
  order: "-name",
});
check("invalid page is bounded", parseDirectorySearchParams({ page: "not-a-page" }).page, 1);
check("negative page is bounded", parseDirectorySearchParams({ page: "-20" }).page, 1);
check("huge page is bounded", parseDirectorySearchParams({ page: "9000" }).page, 1000);
check(
  "directory text becomes a contains filter",
  buildDirectoryWhere("games != null", "Final Fantasy"),
  'games != null & name ~ *"Final Fantasy"*',
);
check(
  "directory operators cannot escape the filter",
  buildDirectoryWhere("games != null", 'Halo" | id > 0;'),
  'games != null & name ~ *"Halo id > 0"*',
);

console.log("\nNotification signals");
const notificationEntry = (overrides: Partial<WatchlistEntry> = {}): WatchlistEntry => ({
  gameId: 77,
  steamAppId: 124,
  slug: "signal-game",
  name: "Signal Game",
  image: null,
  imageFallback: null,
  released: "2026-08-15",
  releaseWindow: null,
  tba: false,
  metacritic: null,
  watchlisted: true,
  metadataVersion: 3,
  metadataUpdatedAt: 0,
  status: "want",
  platform: null,
  startedAt: null,
  finishedAt: null,
  genreIds: [],
  platformSlugs: [],
  ownedOn: [],
  addedAt: 0,
  ...overrides,
  following: overrides.following ?? true,
  subscriptionAccess: overrides.subscriptionAccess ?? [],
  followedReleases: overrides.followedReleases ?? [],
});
check(
  "release inside fourteen days alerts",
  releaseNotifications([notificationEntry()], Date.parse("2026-08-09T12:00:00Z"))[0]?.kind,
  "release-soon",
);
check(
  "distant release stays quiet",
  releaseNotifications([notificationEntry({ released: "2026-09-15" })], Date.parse("2026-08-09T12:00:00Z")),
  [],
);
check(
  "explicitly unfollowed games never alert",
  releaseNotifications([notificationEntry({ following: false })], Date.parse("2026-08-09T12:00:00Z")),
  [],
);
check(
  "a followed game's DLC alerts independently of the base release",
  releaseNotifications([notificationEntry({
    released: "2020-01-01",
    followedReleases: [{ gameId: 88, slug: "signal-dlc", name: "Signal DLC", kind: "dlc", released: "2026-08-10", releaseWindow: null, image: null, imageFallback: null }],
  })], Date.parse("2026-08-09T12:00:00Z"))[0]?.kind,
  "dlc-soon",
);
check(
  "Steam fallback entry routes to IGDB search",
  canonicalEntryHref(notificationEntry({ slug: "signal-game-s124" })),
  "/browse?search=Signal%20Game",
);

console.log("\nPersonal dashboard signals");
const dashboardNow = Date.parse("2026-08-09T12:00:00Z");
const dashboardSnapshot = buildDashboardSnapshot([
  notificationEntry({ gameId: 1, status: "want", released: "2026-08-25", addedAt: 10 }),
  notificationEntry({ gameId: 2, status: "playing", released: "2025-01-01", startedAt: 30, addedAt: 20, ownedOn: ["steam"] }),
  notificationEntry({ gameId: 3, status: "played", released: "2024-01-01", finishedAt: 40, addedAt: 30, ownedOn: ["physical"] }),
], dashboardNow);
check("currently playing leads the focus card", dashboardSnapshot.focus?.gameId, 2);
check("nearest future tracked release wins", dashboardSnapshot.nextRelease?.gameId, 1);
check("dashboard status counts are honest", [dashboardSnapshot.playing, dashboardSnapshot.played, dashboardSnapshot.wanted], [1, 1, 1]);
check("owned count ignores wishlist-only games", dashboardSnapshot.owned, 2);
check("thirty-day release window", dashboardSnapshot.releasesSoon, 1);
check("release countdown is day-stable", daysUntilRelease("2026-08-25", dashboardNow), 16);

console.log("\nFirebase library statistics");
const libraryStats = buildLibraryStats([
  notificationEntry({ gameId: 10, name: "Cross-platform", ownedOn: ["steam", "playstation"], status: "played" }),
  notificationEntry({ gameId: 10, name: "Cross-platform", ownedOn: ["xbox"], status: "played", addedAt: 2 }),
  notificationEntry({ gameId: 11, name: "One copy", ownedOn: ["steam"], status: "want", addedAt: 3 }),
]);
check("duplicate records merge by game id", libraryStats.uniqueGames, 2);
check("multi-platform ownership counts once", libraryStats.ownedGames, 2);
check("platform copies remain a separate metric", libraryStats.platformCopies, 4);
const statusStats = buildLibraryStats([
  notificationEntry({ gameId: 20, status: "none", released: "2025-01-01" }),
  notificationEntry({ gameId: 21, status: "played", released: "2025-01-01" }),
  notificationEntry({ gameId: 22, status: "want", released: "2030-01-01" }),
]);
check("no-status games remain deliberately unclassified", statusStats.noStatus, 1);
check("unreleased games stay outside the completion base", [statusStats.unreleasedGames, statusStats.completionBase], [1, 1]);
check("released completion rate remains honest", statusStats.completionRate, 100);
const repairedReleaseStats = buildLibraryStats([
  notificationEntry({ gameId: 30, status: "none", released: null, releaseWindow: null, tba: true }),
  notificationEntry({ gameId: 31, status: "played", released: null, releaseWindow: null, tba: true }),
]);
check("unknown dates never inflate upcoming", repairedReleaseStats.unreleasedGames, 0);
check("unknown dates are reported separately", repairedReleaseStats.unknownReleaseGames, 1);
check("played history proves a stale undated record is released", repairedReleaseStats.releasedGames, 1);
check(
  "cleared personal records do not inflate statistics",
  buildLibraryStats([notificationEntry({ watchlisted: false, following: false, status: "none" })]).uniqueGames,
  0,
);

console.log("\nHuman-friendly game search");
check("accents and Roman sequels normalise", normaliseSearch("Pokémon II"), "pokemon 2");
check("GTA abbreviation expands", searchQueryVariants("gta 5").includes("grand theft auto 5"), true);
check("abbreviation finds the full game title", fuzzyMatches("Grand Theft Auto V", "gta 5"), true);
check("transposed typo finds Cyberpunk", fuzzyMatches("Cyberpunk 2077", "cybperunk 2077"), true);
check("word-order changes still match", fuzzyMatches("The Legend of Zelda: Breath of the Wild", "zelda wild breath"), true);
check("unrelated titles stay out", fuzzyMatches("Stardew Valley", "cyberpunk"), false);

console.log("\nUniversal discovery routing");
const searchHit = (kind: SearchHit["kind"], slug: string): SearchHit => ({
  kind,
  id: 1,
  name: "Result",
  slug,
  subtitle: null,
  image: null,
});
check("franchise has its own route", hrefForSearchHit(searchHit("franchise", "cyberpunk")), "/franchise/cyberpunk");
check("genre routes to a genre filter", hrefForSearchHit(searchHit("genre", "role-playing-rpg")), "/browse?genres=role-playing-rpg");
check("exact platform routes to a platform filter", hrefForSearchHit(searchHit("platform", "ps5")), "/browse?platforms=ps5");
const groupedSearch = groupSearchHits([
  searchHit("franchise", "cyberpunk"),
  searchHit("genre", "cyberpunk"),
]);
check("genres never masquerade as franchises", [
  groupedSearch.get("franchise")?.length,
  groupedSearch.get("genre")?.length,
], [1, 1]);

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
