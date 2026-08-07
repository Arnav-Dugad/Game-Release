/**
 * Bundled sample catalogue.
 *
 * This exists so the app is fully populated and genuinely usable with zero
 * configuration — no API key, no network. When `RAWG_API_KEY` is set, live data
 * replaces this entirely and the UI drops the "sample data" badge.
 *
 * Editorial rules for this file, so it never misleads:
 *  - Released titles carry their real ship dates and critic scores.
 *  - Unreleased titles are marked `tba` and carry no invented date.
 *  - Ratings/counts are representative sample values, not scraped figures.
 */

import type { GameDetail, GameSummary, Ref } from "./types";

/* RAWG's real taxonomy ids, so filter links built from sample data stay valid
   after a key is added and live data takes over. */
const GENRES: Record<string, Ref> = {
  action: { id: 4, slug: "action", name: "Action" },
  indie: { id: 51, slug: "indie", name: "Indie" },
  adventure: { id: 3, slug: "adventure", name: "Adventure" },
  rpg: { id: 5, slug: "role-playing-games-rpg", name: "RPG" },
  strategy: { id: 10, slug: "strategy", name: "Strategy" },
  shooter: { id: 2, slug: "shooter", name: "Shooter" },
  casual: { id: 40, slug: "casual", name: "Casual" },
  simulation: { id: 14, slug: "simulation", name: "Simulation" },
  puzzle: { id: 7, slug: "puzzle", name: "Puzzle" },
  platformer: { id: 83, slug: "platformer", name: "Platformer" },
  racing: { id: 1, slug: "racing", name: "Racing" },
  fighting: { id: 6, slug: "fighting", name: "Fighting" },
  sports: { id: 15, slug: "sports", name: "Sports" },
  card: { id: 17, slug: "card", name: "Card" },
  mmo: { id: 59, slug: "massively-multiplayer", name: "Massively Multiplayer" },
};

const PLATFORMS: Record<string, Ref> = {
  pc: { id: 1, slug: "pc", name: "PC" },
  playstation: { id: 2, slug: "playstation", name: "PlayStation" },
  xbox: { id: 3, slug: "xbox", name: "Xbox" },
  nintendo: { id: 7, slug: "nintendo", name: "Nintendo" },
  ios: { id: 4, slug: "ios", name: "iOS" },
  mac: { id: 5, slug: "mac", name: "macOS" },
  linux: { id: 6, slug: "linux", name: "Linux" },
  android: { id: 8, slug: "android", name: "Android" },
};

export const SAMPLE_GENRES: Ref[] = Object.values(GENRES);
export const SAMPLE_PLATFORMS: Ref[] = Object.values(PLATFORMS);

interface Seed {
  n: string;
  s: string;
  /** ISO date, omitted for unreleased titles. */
  d?: string;
  mc?: number;
  r: number;
  rc: number;
  pt: number;
  add: number;
  g: (keyof typeof GENRES)[];
  p: (keyof typeof PLATFORMS)[];
  dev: string;
  pub: string;
  esrb?: string;
  tags?: string[];
  desc: string;
}

const SEEDS: Seed[] = [
  /* ---------------------------- Released ---------------------------- */
  {
    n: "Elden Ring", s: "elden-ring", d: "2022-02-25", mc: 96, r: 4.4, rc: 5820, pt: 62, add: 19800,
    g: ["action", "rpg"], p: ["pc", "playstation", "xbox"],
    dev: "FromSoftware", pub: "Bandai Namco Entertainment", esrb: "Mature",
    tags: ["Souls-like", "Open World", "Difficult", "Dark Fantasy", "Co-op"],
    desc: "An open-world action RPG set in the Lands Between, built by FromSoftware with worldbuilding from George R. R. Martin. It trades the corridor design of the Souls series for a vast, largely unguided world where exploration and build experimentation carry equal weight.",
  },
  {
    n: "Baldur's Gate 3", s: "baldurs-gate-3", d: "2023-08-03", mc: 96, r: 4.6, rc: 3410, pt: 95, add: 14200,
    g: ["rpg", "adventure", "strategy"], p: ["pc", "playstation", "xbox", "mac"],
    dev: "Larian Studios", pub: "Larian Studios", esrb: "Mature",
    tags: ["Turn-Based", "Party-Based", "Choices Matter", "Co-op", "D&D"],
    desc: "A turn-based RPG built on fifth-edition Dungeons & Dragons rules, where nearly every encounter has multiple valid solutions. Larian's reactivity is the headline: companions, factions and the world remember what you did and refuse to reset.",
  },
  {
    n: "The Legend of Zelda: Tears of the Kingdom", s: "the-legend-of-zelda-tears-of-the-kingdom",
    d: "2023-05-12", mc: 96, r: 4.5, rc: 1580, pt: 60, add: 6100,
    g: ["action", "adventure"], p: ["nintendo"],
    dev: "Nintendo EPD", pub: "Nintendo", esrb: "Everyone 10+",
    tags: ["Open World", "Physics", "Sandbox", "Exploration"],
    desc: "The follow-up to Breath of the Wild, layering sky islands and a vast underground beneath the same Hyrule. Its Ultrahand and Fuse abilities turn the world into a physics sandbox where players build their own solutions to almost every problem.",
  },
  {
    n: "Red Dead Redemption 2", s: "red-dead-redemption-2", d: "2018-10-26", mc: 96, r: 4.6, rc: 6240, pt: 66, add: 21400,
    g: ["action", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "Rockstar Games", pub: "Rockstar Games", esrb: "Mature",
    tags: ["Open World", "Story Rich", "Western", "Realistic"],
    desc: "A prequel following the Van der Linde gang through the closing years of the American frontier. Its systemic detail and deliberate pacing are as central to the experience as the story of Arthur Morgan's slow reckoning.",
  },
  {
    n: "The Witcher 3: Wild Hunt", s: "the-witcher-3-wild-hunt", d: "2015-05-18", mc: 92, r: 4.7, rc: 7150, pt: 46, add: 22900,
    g: ["rpg", "action", "adventure"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "CD PROJEKT RED", pub: "CD PROJEKT RED", esrb: "Mature",
    tags: ["Open World", "Story Rich", "Atmospheric", "Choices Matter"],
    desc: "Geralt of Rivia searches for Ciri across a war-scarred Northern Realms. Its side quests are the reason it is still cited as a benchmark — most are written with the care usually reserved for a main storyline.",
  },
  {
    n: "God of War Ragnarök", s: "god-of-war-ragnarok", d: "2022-11-09", mc: 94, r: 4.6, rc: 1290, pt: 26, add: 5400,
    g: ["action", "adventure", "rpg"], p: ["pc", "playstation"],
    dev: "Santa Monica Studio", pub: "Sony Interactive Entertainment", esrb: "Mature",
    tags: ["Story Rich", "Norse Mythology", "Cinematic", "Single Player"],
    desc: "Kratos and Atreus face the prophesied end of the Nine Realms. It closes the Norse arc with a wider spread of realms, a deeper combat kit and a heavier emphasis on the father-son relationship at its centre.",
  },
  {
    n: "Astro Bot", s: "astro-bot", d: "2024-09-06", mc: 94, r: 4.6, rc: 620, pt: 12, add: 2100,
    g: ["platformer", "action", "adventure"], p: ["playstation"],
    dev: "Team Asobi", pub: "Sony Interactive Entertainment", esrb: "Everyone 10+",
    tags: ["3D Platformer", "Family Friendly", "Haptics", "Colourful"],
    desc: "A 3D platformer built around inventive, single-use mechanics and dense DualSense haptic feedback. Widely regarded as the strongest first-party platformer PlayStation has produced.",
  },
  {
    n: "Metaphor: ReFantazio", s: "metaphor-refantazio", d: "2024-10-11", mc: 94, r: 4.5, rc: 540, pt: 80, add: 1900,
    g: ["rpg", "strategy"], p: ["pc", "playstation", "xbox"],
    dev: "Atlus", pub: "SEGA", esrb: "Mature",
    tags: ["JRPG", "Turn-Based", "Fantasy", "Story Rich"],
    desc: "A fantasy JRPG from the core Persona team, built around an Archetype class system and a calendar that pressures every decision. Its politics-driven plot follows a royal election in a kingdom without a king.",
  },
  {
    n: "Resident Evil 4", s: "resident-evil-4", d: "2023-03-24", mc: 93, r: 4.5, rc: 1120, pt: 17, add: 4300,
    g: ["action", "shooter", "adventure"], p: ["pc", "playstation", "xbox", "ios", "mac"],
    dev: "Capcom", pub: "Capcom", esrb: "Mature",
    tags: ["Horror", "Third Person", "Remake", "Survival Horror"],
    desc: "A ground-up remake of the 2005 original, rebuilt with modern controls, a parry system and reworked pacing. Leon's rescue mission into rural Spain keeps the original's structure while sharpening nearly every encounter.",
  },
  {
    n: "Hades", s: "hades", d: "2020-09-17", mc: 93, r: 4.4, rc: 2260, pt: 22, add: 9800,
    g: ["action", "indie", "rpg"], p: ["pc", "playstation", "xbox", "nintendo", "mac"],
    dev: "Supergiant Games", pub: "Supergiant Games", esrb: "Teen",
    tags: ["Roguelike", "Isometric", "Great Soundtrack", "Story Rich"],
    desc: "A roguelike in which Zagreus repeatedly attempts to escape the Underworld, with each failed run advancing the story rather than erasing it. Its fully-voiced, reactive dialogue system is what separates it from the genre.",
  },
  {
    n: "Animal Well", s: "animal-well", d: "2024-05-09", mc: 91, r: 4.4, rc: 380, pt: 9, add: 1400,
    g: ["indie", "platformer", "puzzle", "adventure"], p: ["pc", "playstation", "nintendo"],
    dev: "Billy Basso", pub: "Bigmode", esrb: "Everyone",
    tags: ["Metroidvania", "Puzzle", "Atmospheric", "Secrets"],
    desc: "A dense metroidvania built almost entirely by one developer, layering secrets several levels deeper than its surface map suggests. Its tools are all non-violent, and most progress comes from lateral thinking.",
  },
  {
    n: "Disco Elysium", s: "disco-elysium", d: "2019-10-15", mc: 91, r: 4.4, rc: 1210, pt: 21, add: 5200,
    g: ["rpg", "indie", "adventure"], p: ["pc", "playstation", "xbox", "nintendo", "mac"],
    dev: "ZA/UM", pub: "ZA/UM", esrb: "Mature",
    tags: ["Story Rich", "Isometric", "Choices Matter", "Detective", "Dialogue"],
    desc: "A detective RPG with no combat, where twenty-four skills argue with you as internal voices. Failure is authored as carefully as success, and the case is inseparable from the politics of the city it occurs in.",
  },
  {
    n: "Sekiro: Shadows Die Twice", s: "sekiro-shadows-die-twice", d: "2019-03-22", mc: 90, r: 4.4, rc: 2840, pt: 32, add: 11600,
    g: ["action", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "FromSoftware", pub: "Activision", esrb: "Mature",
    tags: ["Difficult", "Souls-like", "Stealth", "Third Person"],
    desc: "FromSoftware's take on Sengoku-era Japan, built around a posture and deflection system rather than stamina and dodging. It removes build variety in exchange for one deeply-tuned combat rhythm.",
  },
  {
    n: "Hollow Knight", s: "hollow-knight", d: "2017-02-24", mc: 90, r: 4.4, rc: 2010, pt: 27, add: 9100,
    g: ["action", "indie", "platformer", "adventure"], p: ["pc", "playstation", "xbox", "nintendo", "mac", "linux"],
    dev: "Team Cherry", pub: "Team Cherry", esrb: "Everyone 10+",
    tags: ["Metroidvania", "Atmospheric", "Difficult", "Hand-Drawn"],
    desc: "A hand-drawn metroidvania set in the ruined insect kingdom of Hallownest. Its map, lore and upgrade paths are all deliberately withheld, rewarding players who explore without direction.",
  },
  {
    n: "Balatro", s: "balatro", d: "2024-02-20", mc: 90, r: 4.5, rc: 720, pt: 30, add: 2600,
    g: ["card", "indie", "strategy", "casual"], p: ["pc", "playstation", "xbox", "nintendo", "ios", "android", "mac"],
    dev: "LocalThunk", pub: "Playstack", esrb: "Teen",
    tags: ["Roguelike", "Deckbuilder", "Poker", "Replay Value"],
    desc: "A roguelike deckbuilder that uses poker hands as its scoring engine and Jokers as its multiplier economy. Its difficulty comes from combinatorial depth rather than execution.",
  },
  {
    n: "Marvel's Spider-Man 2", s: "marvels-spider-man-2", d: "2023-10-20", mc: 90, r: 4.4, rc: 810, pt: 20, add: 3200,
    g: ["action", "adventure"], p: ["pc", "playstation"],
    dev: "Insomniac Games", pub: "Sony Interactive Entertainment", esrb: "Teen",
    tags: ["Open World", "Superhero", "Traversal", "Cinematic"],
    desc: "Peter Parker and Miles Morales share a doubled New York map, with web-wings added to the traversal kit. The symbiote storyline drives both the plot and a distinct second combat set.",
  },
  {
    n: "Persona 3 Reload", s: "persona-3-reload", d: "2024-02-02", mc: 87, r: 4.4, rc: 460, pt: 70, add: 1700,
    g: ["rpg"], p: ["pc", "playstation", "xbox"],
    dev: "Atlus", pub: "SEGA", esrb: "Mature",
    tags: ["JRPG", "Turn-Based", "Social Sim", "Anime"],
    desc: "A full remake of Persona 3, rebuilt in the visual and systems language of Persona 5 while keeping the original's structure and tone. Its calendar splits time between high-school social links and the Dark Hour.",
  },
  {
    n: "Like a Dragon: Infinite Wealth", s: "like-a-dragon-infinite-wealth", d: "2024-01-26", mc: 88, r: 4.4, rc: 390, pt: 65, add: 1500,
    g: ["rpg", "adventure", "action"], p: ["pc", "playstation", "xbox"],
    dev: "Ryu Ga Gotoku Studio", pub: "SEGA", esrb: "Mature",
    tags: ["Turn-Based", "JRPG", "Comedy", "Story Rich"],
    desc: "Ichiban Kasuga and Kazuma Kiryu share top billing across Yokohama and Hawaii. Its turn-based combat gains positioning, and its side content is as expansive as anything in the series.",
  },
  {
    n: "Dave the Diver", s: "dave-the-diver", d: "2023-06-28", mc: 89, r: 4.4, rc: 510, pt: 32, add: 2200,
    g: ["adventure", "indie", "simulation", "rpg"], p: ["pc", "playstation", "xbox", "nintendo", "mac"],
    dev: "MINTROCKET", pub: "MINTROCKET", esrb: "Teen",
    tags: ["Pixel Graphics", "Management", "Fishing", "Cosy"],
    desc: "Days are spent diving a procedurally shifting blue hole; nights are spent running a sushi restaurant with the catch. It keeps introducing new systems well past the point most games stop.",
  },
  {
    n: "Stardew Valley", s: "stardew-valley", d: "2016-02-26", mc: 89, r: 4.4, rc: 2380, pt: 95, add: 10400,
    g: ["indie", "rpg", "simulation", "casual"], p: ["pc", "playstation", "xbox", "nintendo", "ios", "android", "mac", "linux"],
    dev: "ConcernedApe", pub: "ConcernedApe", esrb: "Everyone 10+",
    tags: ["Farming Sim", "Pixel Graphics", "Relaxing", "Co-op", "Moddable"],
    desc: "A farming and life sim built almost entirely by one developer, covering crops, mining, fishing, combat and a full village of characters. Years of free content updates have steadily widened it.",
  },
  {
    n: "It Takes Two", s: "it-takes-two", d: "2021-03-26", mc: 89, r: 4.4, rc: 890, pt: 14, add: 3600,
    g: ["action", "adventure", "platformer"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "Hazelight Studios", pub: "Electronic Arts", esrb: "Teen",
    tags: ["Co-op", "Split Screen", "Local Multiplayer", "Puzzle"],
    desc: "A co-op-only platformer in which two players control a separated couple shrunk to doll size. Almost every level introduces a mechanic it then discards, so the pair rarely repeat a skill.",
  },
  {
    n: "Alan Wake 2", s: "alan-wake-2", d: "2023-10-27", mc: 89, r: 4.3, rc: 470, pt: 19, add: 1800,
    g: ["action", "adventure", "shooter"], p: ["pc", "playstation", "xbox"],
    dev: "Remedy Entertainment", pub: "Epic Games", esrb: "Mature",
    tags: ["Survival Horror", "Story Rich", "Atmospheric", "Live Action"],
    desc: "A survival horror sequel splitting two playable characters across a Pacific Northwest town and a nightmare version of New York. Remedy blends live action, musical sequences and a rewritable in-fiction manuscript.",
  },
  {
    n: "Hi-Fi Rush", s: "hi-fi-rush", d: "2023-01-25", mc: 88, r: 4.3, rc: 620, pt: 13, add: 2400,
    g: ["action", "platformer", "adventure"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "Tango Gameworks", pub: "Bethesda Softworks", esrb: "Teen",
    tags: ["Rhythm", "Character Action", "Cel-Shaded", "Great Soundtrack"],
    desc: "A character-action game where the whole world — combat, platforms, animation — moves on the beat. Its cel-shaded presentation and comic timing carry as much weight as its combo depth.",
  },
  {
    n: "Final Fantasy XVI", s: "final-fantasy-xvi", d: "2023-06-22", mc: 87, r: 4.2, rc: 580, pt: 40, add: 2300,
    g: ["rpg", "action", "adventure"], p: ["pc", "playstation"],
    dev: "Square Enix", pub: "Square Enix", esrb: "Mature",
    tags: ["Action RPG", "Story Rich", "Dark Fantasy", "Cinematic"],
    desc: "A fully action-driven Final Fantasy following Clive Rosfield through a war between nations over crystal-bearing Mothercrystals. Its Eikon battles are staged as large-scale set pieces.",
  },
  {
    n: "Street Fighter 6", s: "street-fighter-6", d: "2023-06-02", mc: 92, r: 4.3, rc: 540, pt: 22, add: 2100,
    g: ["fighting", "action"], p: ["pc", "playstation", "xbox"],
    dev: "Capcom", pub: "Capcom", esrb: "Teen",
    tags: ["Fighting", "Competitive", "eSports", "Local Multiplayer"],
    desc: "Capcom's fighter built around the Drive Gauge, a single resource feeding offence, defence and reversals. Its World Tour single-player mode and Modern controls make it unusually accessible for the genre.",
  },
  {
    n: "Silent Hill 2", s: "silent-hill-2-2024", d: "2024-10-08", mc: 86, r: 4.3, rc: 430, pt: 18, add: 1600,
    g: ["action", "adventure"], p: ["pc", "playstation"],
    dev: "Bloober Team", pub: "Konami", esrb: "Mature",
    tags: ["Psychological Horror", "Remake", "Atmospheric", "Story Rich"],
    desc: "A remake of the 2001 psychological horror game, rebuilt with an over-the-shoulder camera and reworked combat. James Sunderland's search for his late wife retains the original's ambiguity.",
  },
  {
    n: "Prince of Persia: The Lost Crown", s: "prince-of-persia-the-lost-crown", d: "2024-01-18", mc: 86, r: 4.3, rc: 340, pt: 22, add: 1300,
    g: ["action", "platformer", "adventure"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "Ubisoft Montpellier", pub: "Ubisoft", esrb: "Teen",
    tags: ["Metroidvania", "Precision Platformer", "Time Powers"],
    desc: "A 2D metroidvania with combat and traversal built for precision, plus a memory-shard system that photographs the map for you. Its time-based powers gate a genuinely intricate world.",
  },
  {
    n: "Returnal", s: "returnal", d: "2021-04-30", mc: 86, r: 4.2, rc: 490, pt: 25, add: 2000,
    g: ["action", "shooter", "adventure"], p: ["pc", "playstation"],
    dev: "Housemarque", pub: "Sony Interactive Entertainment", esrb: "Teen",
    tags: ["Roguelike", "Bullet Hell", "Third Person", "Sci-Fi"],
    desc: "A third-person roguelike shooter that fuses bullet-hell density with a time-looped alien planet. Selene's repeated deaths are woven into a story told in fragments.",
  },
  {
    n: "Armored Core VI: Fires of Rubicon", s: "armored-core-vi-fires-of-rubicon", d: "2023-08-25", mc: 86, r: 4.2, rc: 420, pt: 24, add: 1700,
    g: ["action", "shooter"], p: ["pc", "playstation", "xbox"],
    dev: "FromSoftware", pub: "Bandai Namco Entertainment", esrb: "Teen",
    tags: ["Mecha", "Difficult", "Customisation", "Boss Rush"],
    desc: "FromSoftware's return to mech combat, built on deep assembly customisation and fast three-dimensional movement. Loadout choice matters more than reflexes on most bosses.",
  },
  {
    n: "Cyberpunk 2077", s: "cyberpunk-2077", d: "2020-12-10", mc: 86, r: 4.2, rc: 3910, pt: 45, add: 16200,
    g: ["action", "rpg", "shooter"], p: ["pc", "playstation", "xbox"],
    dev: "CD PROJEKT RED", pub: "CD PROJEKT RED", esrb: "Mature",
    tags: ["Open World", "Cyberpunk", "Story Rich", "First Person"],
    desc: "An open-world RPG set in Night City, following the mercenary V and a construct of Johnny Silverhand. A long programme of patches and the 2.0 overhaul substantially reworked its progression and police systems.",
  },
  {
    n: "Pentiment", s: "pentiment", d: "2022-11-15", mc: 86, r: 4.2, rc: 260, pt: 16, add: 950,
    g: ["adventure", "indie", "rpg"], p: ["pc", "playstation", "xbox", "nintendo", "mac"],
    dev: "Obsidian Entertainment", pub: "Xbox Game Studios", esrb: "Teen",
    tags: ["Narrative", "Historical", "Choices Matter", "Hand-Drawn"],
    desc: "A narrative adventure set in 16th-century Bavaria, drawn in the style of illuminated manuscripts and woodcuts. Investigations span decades, and the game never confirms whether you accused the right person.",
  },
  {
    n: "Diablo IV", s: "diablo-iv", d: "2023-06-05", mc: 86, r: 3.9, rc: 680, pt: 40, add: 2900,
    g: ["action", "rpg", "mmo"], p: ["pc", "playstation", "xbox"],
    dev: "Blizzard Entertainment", pub: "Blizzard Entertainment", esrb: "Mature",
    tags: ["Hack and Slash", "Loot", "Isometric", "Online Co-op"],
    desc: "An open-world action RPG returning Sanctuary to a darker register, with shared zones and seasonal content. Its build depth sits in the Paragon board and skill-tree interactions.",
  },
  {
    n: "Neva", s: "neva", d: "2024-10-15", mc: 84, r: 4.2, rc: 190, pt: 5, add: 720,
    g: ["indie", "platformer", "adventure", "action"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "Nomada Studio", pub: "Devolver Digital", esrb: "Teen",
    tags: ["Hand-Drawn", "Emotional", "Atmospheric", "Short"],
    desc: "From the makers of GRIS, a hand-painted platformer about a woman and a young wolf crossing a dying world across four seasons. Combat is present but restrained, and the animation carries the story.",
  },
  {
    n: "Starfield", s: "starfield", d: "2023-09-06", mc: 83, r: 3.7, rc: 890, pt: 60, add: 3400,
    g: ["rpg", "action", "shooter"], p: ["pc", "xbox"],
    dev: "Bethesda Game Studios", pub: "Bethesda Softworks", esrb: "Mature",
    tags: ["Space", "Sci-Fi", "Exploration", "Ship Building"],
    desc: "Bethesda's space RPG, spanning hundreds of procedurally generated planets alongside handcrafted cities. Ship building and outpost construction sit alongside a faction-driven main campaign.",
  },
  {
    n: "Control", s: "control", d: "2019-08-27", mc: 82, r: 4.1, rc: 1340, pt: 17, add: 6800,
    g: ["action", "shooter", "adventure"], p: ["pc", "playstation", "xbox", "nintendo"],
    dev: "Remedy Entertainment", pub: "505 Games", esrb: "Mature",
    tags: ["Metroidvania", "Supernatural", "Brutalist", "Third Person"],
    desc: "Jesse Faden explores the Oldest House, a brutalist building whose interior rewrites itself. Its telekinetic combat and destructible environments are the studio's most physical work.",
  },
  {
    n: "Helldivers 2", s: "helldivers-2", d: "2024-02-08", mc: 82, r: 4.2, rc: 760, pt: 45, add: 2800,
    g: ["action", "shooter"], p: ["pc", "playstation"],
    dev: "Arrowhead Game Studios", pub: "Sony Interactive Entertainment", esrb: "Mature",
    tags: ["Co-op", "Third Person", "Friendly Fire", "Live Service"],
    desc: "A four-player co-op shooter where friendly fire is always on and stratagems are called in by directional input. A persistent galactic war shifts objectives for the whole player base at once.",
  },
  {
    n: "Black Myth: Wukong", s: "black-myth-wukong", d: "2024-08-20", mc: 81, r: 4.3, rc: 640, pt: 35, add: 2500,
    g: ["action", "rpg", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "Game Science", pub: "Game Science", esrb: "Mature",
    tags: ["Souls-like", "Mythology", "Boss Rush", "Third Person"],
    desc: "An action RPG drawing on Journey to the West, built around staff combat, transformations and a long roster of bosses. Its chapter-based structure moves between linear set pieces and wider explorable regions.",
  },
  {
    n: "Death Stranding", s: "death-stranding", d: "2019-11-08", mc: 82, r: 4.0, rc: 1180, pt: 39, add: 5900,
    g: ["action", "adventure", "simulation"], p: ["pc", "playstation", "xbox", "mac"],
    dev: "Kojima Productions", pub: "Sony Interactive Entertainment", esrb: "Mature",
    tags: ["Walking Sim", "Asynchronous Multiplayer", "Post-Apocalyptic", "Story Rich"],
    desc: "Sam Porter Bridges carries cargo across a fractured America, with terrain itself as the primary obstacle. Structures left by other players appear asynchronously in your world.",
  },
  {
    n: "Lies of P", s: "lies-of-p", d: "2023-09-19", mc: 80, r: 4.2, rc: 450, pt: 30, add: 1800,
    g: ["action", "rpg", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "Round8 Studio", pub: "NEOWIZ", esrb: "Mature",
    tags: ["Souls-like", "Belle Époque", "Difficult", "Weapon Crafting"],
    desc: "A souls-like retelling of Pinocchio set in a plague-stricken Belle Époque city. Its weapon assembly system lets blades and handles be mixed to build unusual movesets.",
  },

  /* --------------------------- Unreleased ---------------------------
     No dates are invented here. Every entry below is announced but had no
     confirmed release date at the time this catalogue was written, so each is
     marked TBA. Live RAWG data replaces all of it once a key is configured. */
  {
    n: "Grand Theft Auto VI", s: "grand-theft-auto-vi", r: 0, rc: 0, pt: 0, add: 24600,
    g: ["action", "adventure"], p: ["playstation", "xbox"],
    dev: "Rockstar Games", pub: "Rockstar Games",
    tags: ["Open World", "Crime", "Highly Anticipated"],
    desc: "Rockstar's return to Vice City, centred on the dual protagonists Lucia and Jason. Announced via trailer, with gameplay details still largely unrevealed.",
  },
  {
    n: "The Elder Scrolls VI", s: "the-elder-scrolls-vi", r: 0, rc: 0, pt: 0, add: 15800,
    g: ["rpg", "action", "adventure"], p: ["pc", "xbox"],
    dev: "Bethesda Game Studios", pub: "Bethesda Softworks",
    tags: ["Open World", "Fantasy", "Highly Anticipated"],
    desc: "The next mainline Elder Scrolls, confirmed to be in development following Starfield. Bethesda has released only a teaser and has not detailed setting or systems.",
  },
  {
    n: "Marvel's Wolverine", s: "marvels-wolverine", r: 0, rc: 0, pt: 0, add: 9200,
    g: ["action", "adventure"], p: ["playstation"],
    dev: "Insomniac Games", pub: "Sony Interactive Entertainment",
    tags: ["Superhero", "Third Person", "Mature"],
    desc: "A mature-rated Wolverine game from the studio behind Marvel's Spider-Man. Insomniac has shown a teaser and brief gameplay, with full details still pending.",
  },
  {
    n: "Fable", s: "fable", r: 0, rc: 0, pt: 0, add: 7400,
    g: ["rpg", "adventure", "action"], p: ["pc", "xbox"],
    dev: "Playground Games", pub: "Xbox Game Studios",
    tags: ["Open World", "Fantasy", "Reboot", "Humour"],
    desc: "A reboot of the Fable series from Playground Games, returning to Albion with the franchise's characteristic British comic tone. Shown in trailers ahead of a confirmed date.",
  },
  {
    n: "Judas", s: "judas", r: 0, rc: 0, pt: 0, add: 4100,
    g: ["shooter", "action", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "Ghost Story Games", pub: "Ghost Story Games",
    tags: ["Immersive Sim", "First Person", "Narrative", "Sci-Fi"],
    desc: "A narrative first-person shooter from Ken Levine's studio, set aboard a failing generation ship. Its pitch centres on shifting alliances between three antagonists reacting to player choices.",
  },
  {
    n: "Subnautica 2", s: "subnautica-2", r: 0, rc: 0, pt: 0, add: 5300,
    g: ["adventure", "indie", "simulation", "action"], p: ["pc", "playstation", "xbox"],
    dev: "Unknown Worlds Entertainment", pub: "Krafton",
    tags: ["Survival", "Underwater", "Co-op", "Crafting"],
    desc: "The next Subnautica, adding optional co-op to the series' underwater survival and base building on a new alien ocean world.",
  },
  {
    n: "Intergalactic: The Heretic Prophet", s: "intergalactic-the-heretic-prophet", r: 0, rc: 0, pt: 0, add: 6100,
    g: ["action", "adventure"], p: ["playstation"],
    dev: "Naughty Dog", pub: "Sony Interactive Entertainment",
    tags: ["Sci-Fi", "Third Person", "Story Rich"],
    desc: "Naughty Dog's first new franchise in over a decade, a science-fiction action game following the bounty hunter Jordan A. Mun. Announced with a cinematic reveal.",
  },
  {
    n: "Kingdom Hearts IV", s: "kingdom-hearts-iv", r: 0, rc: 0, pt: 0, add: 4800,
    g: ["rpg", "action", "adventure"], p: ["pc", "playstation", "xbox"],
    dev: "Square Enix", pub: "Square Enix",
    tags: ["Action RPG", "Disney", "Anime", "Crossover"],
    desc: "The next mainline Kingdom Hearts, opening with Sora in the realistic city of Quadratum. Announced with a reveal trailer and no date.",
  },
  {
    n: "Star Wars Eclipse", s: "star-wars-eclipse", r: 0, rc: 0, pt: 0, add: 3600,
    g: ["adventure", "action"], p: ["pc", "playstation", "xbox"],
    dev: "Quantic Dream", pub: "Quantic Dream",
    tags: ["Branching Narrative", "Cinematic", "High Republic"],
    desc: "A branching-narrative action adventure set in the High Republic era, following multiple playable characters. Revealed early in development.",
  },
  {
    n: "Physint", s: "physint", r: 0, rc: 0, pt: 0, add: 3900,
    g: ["action", "adventure"], p: ["playstation"],
    dev: "Kojima Productions", pub: "Sony Interactive Entertainment",
    tags: ["Stealth", "Espionage", "Cinematic"],
    desc: "An action espionage game from Hideo Kojima, described by the director as a spiritual successor to his earlier stealth work. Announced with no footage.",
  },
  {
    n: "Beyond Good and Evil 2", s: "beyond-good-and-evil-2", r: 0, rc: 0, pt: 0, add: 3100,
    g: ["action", "adventure", "rpg"], p: ["pc", "playstation", "xbox"],
    dev: "Ubisoft Montpellier", pub: "Ubisoft",
    tags: ["Space", "Open World", "Long Awaited"],
    desc: "A long-in-development prequel to Beyond Good & Evil, set across a space-faring System 3. Ubisoft has shown pre-alpha footage across several years.",
  },
];

/* ------------------------------------------------------------------------ */

function expand(seed: Seed, index: number): GameDetail {
  const genres = seed.g.map((k) => GENRES[k]);
  const platforms = seed.p.map((k) => PLATFORMS[k]);
  return {
    id: 900_000 + index,
    slug: seed.s,
    name: seed.n,
    released: seed.d ?? null,
    tba: !seed.d,
    image: null,
    rating: seed.r,
    ratingsCount: seed.rc,
    metacritic: seed.mc ?? null,
    platforms,
    parentPlatforms: platforms,
    genres,
    screenshots: [],
    esrb: seed.esrb ?? null,
    playtime: seed.pt,
    added: seed.add,
    description: seed.desc,
    website: null,
    developers: [{ id: 1_000 + index, slug: slugify(seed.dev), name: seed.dev }],
    publishers: [{ id: 2_000 + index, slug: slugify(seed.pub), name: seed.pub }],
    tags: (seed.tags ?? []).map((t, i) => ({
      id: 3_000 + index * 30 + i,
      slug: slugify(t),
      name: t,
    })),
    stores: [],
    requirements: [],
    trailers: [],
    redditUrl: null,
    metacriticUrl: null,
    alternativeNames: [],
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SAMPLE_GAMES: GameDetail[] = SEEDS.map(expand);

export const SAMPLE_BY_SLUG: ReadonlyMap<string, GameDetail> = new Map(
  SAMPLE_GAMES.map((g) => [g.slug, g]),
);

/**
 * Projects a detail record down to the summary shape list views expect.
 *
 * Built by naming the kept fields rather than destructuring away the dropped
 * ones — adding a field to `GameDetail` then fails to compile here if it should
 * have been included, instead of silently leaking into every list payload.
 */
export function toSummary(game: GameDetail): GameSummary {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    released: game.released,
    tba: game.tba,
    image: game.image,
    rating: game.rating,
    ratingsCount: game.ratingsCount,
    metacritic: game.metacritic,
    platforms: game.platforms,
    parentPlatforms: game.parentPlatforms,
    genres: game.genres,
    screenshots: game.screenshots,
    esrb: game.esrb,
    playtime: game.playtime,
    added: game.added,
  };
}
