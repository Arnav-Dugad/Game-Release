# LUDEX

A release calendar and reference database for video games — upcoming releases with
live countdowns, critic scores, screenshots, platforms, and a personal watchlist.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Motion and Firebase.

---

## No placeholder data — ever

Every game on this site is real, live data from IGDB or Steam. There is no
bundled sample catalogue — if neither provider can be reached, the site says
so honestly instead of showing invented games.

```bash
npm install
npm run dev
```

The data layer is a **provider chain** — each request takes the first backend
that can answer it:

| Priority | Provider | Needs | Covers |
| --- | --- | --- | --- |
| 1 | **IGDB** | Free Twitch client id + secret | ~300k games, every platform, covers, screenshots, trailers, critic scores, release windows |
| 2 | **Steam** | **Nothing** | PC titles from the live storefront, with screenshots, MP4 trailers, system requirements and Metacritic scores |

Because Steam needs no credentials, a fresh deploy shows **live data
immediately**, even with zero configuration. Adding IGDB credentials upgrades
it to full console coverage. Steam also stands in automatically if a specific
IGDB request fails, so a transient IGDB hiccup degrades to Steam's live
catalogue rather than to nothing.

A provider returning "I can't answer this" falls through to the next one. A
provider returning *zero results* does not — that's a real answer, so a genuine
"no matches" is never disguised as a data-source problem. If every configured
provider genuinely fails, pages render an honest "live data is unreachable"
notice rather than fabricating content.

---

## Adding IGDB (free, ~2 minutes)

IGDB is run by Twitch/Amazon. The free tier is generous and every response here
is cached, so this app uses a tiny fraction of it.

1. Sign in at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) →
   **Register Your Application**
2. Name it anything; OAuth Redirect URL `http://localhost`; Category *Website*
3. Copy the **Client ID**, then **New Secret** and copy that
4. Put both in `.env.local`:

```bash
cp .env.local.example .env.local
# IGDB_CLIENT_ID=...
# IGDB_CLIENT_SECRET=...
```

Credentials are read server-side only and never reach the browser. The app
handles the OAuth token exchange, caching and refresh itself.

---

## Accounts & database — Firebase (optional)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a **Web App**, copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables
3. **Authentication → Sign-in method** → enable *Email/Password* and *Google*
4. **Firestore Database** → create a database
5. **Firestore → Rules** → paste [`firestore.rules`](./firestore.rules) and publish
6. **Authentication → Settings → Authorised domains** → add your deployed domain

The `NEXT_PUBLIC_` prefix is correct here — Firebase web config is public by
design. Access is enforced by the Firestore rules, not by hiding these values.

Without Firebase the site still works; auth screens explain that sign-in isn't
configured instead of failing.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new) — the framework is detected
   automatically, no build settings to change
3. Add your environment variables under **Settings → Environment Variables**
4. Deploy

Every variable is optional — the site builds and runs with none of them set.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `IGDB_CLIENT_ID` | Full multi-platform game data | Server-only |
| `IGDB_CLIENT_SECRET` | Full multi-platform game data | Server-only |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, social cards | e.g. `https://ludex.vercel.app`, no trailing slash |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Accounts, watchlist, reviews | Public by design |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Accounts | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Accounts | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Accounts | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Accounts | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Accounts | |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | — | Unused; Analytics is not wired up |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Browser push | Firebase Cloud Messaging web-push certificate |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Scheduled notifications | Complete service-account JSON; use this or the three split variables |
| `FIREBASE_PROJECT_ID` | Scheduled notifications | Service-account project id |
| `FIREBASE_CLIENT_EMAIL` | Scheduled notifications | Service-account client email |
| `FIREBASE_PRIVATE_KEY` | Scheduled notifications | Service-account private key; escaped newlines are supported |
| `CRON_SECRET` | Scheduled notifications | Long random secret also used automatically by Vercel Cron |
| `RESEND_API_KEY` | Email notifications | Optional; device push works without it |
| `NOTIFICATION_FROM_EMAIL` | Email notifications | Verified sender, e.g. `LUDEX <alerts@example.com>` |

Set each for **Production, Preview and Development** unless you want them to
differ per environment.

If you add Firebase after the first deploy, remember step 6 above — add the Vercel
domain to Firebase's authorised domains or Google sign-in will be rejected.

### Scheduled notification delivery

`vercel.json` runs the protected dispatcher twice daily. To activate delivery,
configure Firebase Admin and `CRON_SECRET`; add the VAPID key for device push
and Resend variables for email. Users opt into each channel from Settings and
can choose a minimum discount plus local quiet hours. The dispatcher is
idempotent, records delivery receipts privately, and ignores direct requests
that do not carry the cron secret.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Cinematic hero plus a signed-in command center for current games, tracked releases, regional deal radar, taste signals and explained recommendations; live discovery rails remain for everyone |
| `/upcoming` | Month-grouped release calendar with per-title countdowns |
| `/browse` | Full database with genre/platform filters, sorting and pagination — all URL-driven |
| `/game/[slug]` | Cinematic game dossier: live hero media, active section dock, editorial gallery, distinct DLC/expansion/edition poster shelves, franchise portals, structured metadata, requirements, reviews and related games |
| `/genres`, `/platforms` | Category browsing |
| `/login`, `/signup` | Split-screen auth with email/password and Google |
| `/watchlist` | Tracked games with play status (want / playing / played) |
| `/planner` | Personal release runway with collision detection, weekly capacity, backlog guidance, a next-play decision, and private `.ics` calendar export |
| `/profile` | Identity, stats, review history, settings |

Every game page also generates its own social card at
`/game/[slug]/opengraph-image` — artwork, critic score and release date — so
shared links preview properly instead of falling back to plain text.

Search is a ⌘K command palette available from anywhere (also `/`, the header, and
the mobile Search tab).

---

## Mobile and desktop are designed separately

Not one layout scaled down. Two custom Tailwind variants — `fine:` (mouse) and
`coarse:` (touch) — drive genuinely different behaviour:

| | Desktop | Touch |
| --- | --- | --- |
| Navigation | Inline header nav with a spring-animated active pill | Bottom tab bar, thumb-reachable, safe-area aware |
| Cards | 3D pointer tilt, specular glare, hover-revealed metadata | No tilt, metadata always visible, press feedback |
| Rails | Arrow controls on hover | Native scroll-snap with momentum |
| Filters | Always-visible inline panel | Single button → drag-to-dismiss bottom sheet |
| Overlays | Centred dialogs that scale in | Bottom sheets with a drag handle |
| Cursor | Custom two-part cursor with contextual labels | Not mounted at all |
| Effects | Full aurora blur radius | Reduced blur radius (mobile GPU cost) |

Every heavy effect is gated behind `useRichMotion()` — precise pointer **and** no
`prefers-reduced-motion`. Touch devices attach zero pointer listeners for tilt,
magnetics, spotlight or cursor.

---

## Architecture notes

**Data layer.** Components only ever see a normalised `Game` shape, never a raw
provider payload. `src/lib/games/source.ts` walks the provider chain; each
provider in `src/lib/games/providers/` implements the same interface and returns
`null` rather than throwing when it can't help. Adding a fourth backend means
writing one file and appending it to the chain — no component changes.

**Providers are merged, not just chained.** When IGDB reports that a title has
a Steam listing (via `external_games`), the record is enriched with Steam's
current price and system requirements — data IGDB does not carry. The base
record wins every contested field; the merge only fills gaps and adds what
Steam uniquely has, and a failed lookup returns the original untouched.

**Posters degrade, they don't break.** Steam's portrait library capsule is a
proper 600x900 poster but 404s for a minority of apps, so `GameCover` tries it
first and swaps to the guaranteed 16:9 header on a load error, then to
generated art keyed off the slug. No grey boxes, no broken images.

**Release dates are never invented.** Providers distinguish an exact day from a
window ("Q4 2026") from genuinely unknown. Steam publishes dates as localised
human strings and IGDB stores a precision category alongside each date; both are
parsed so a quarter is shown as a quarter, not silently rounded to a day. The
release calendar groups exact dates by month, windows under their own heading,
and undated titles last.

**No data source, no page.** There is no bundled catalogue to fall back on. If
every configured provider fails on a given request, that request's data is
labelled `"unavailable"` and the page shows an honest outage notice rather than
inventing games to display. Successful requests carry a provider attribution
line instead.

**Firebase never blocks a render.** Config is validated up front and every accessor
short-circuits on the server. With no config the app reports `enabled: false` and
auth screens explain themselves rather than throwing.

**One watchlist subscription.** A single Firestore listener at the provider level
serves every card on a page, rather than one listener per card. Toggles are
optimistic and roll back on failure.

**Accessibility.** Skip link, focus-visible rings, `aria-live` toasts, keyboard-driven
palette and lightbox, trapped/restored dialog focus, 44px minimum touch targets,
pinch-zoom never disabled, and `prefers-reduced-motion` honoured both globally and
per-component (components swap to a static presentation rather than running the
same animation instantly).

**Quality fortress.** Every push and pull request runs type, lint, provider-contract,
production-build, Chromium, responsive, keyboard, image, canonical-link and Axe
accessibility checks. Failed browser runs preserve their trace, screenshot and video
for diagnosis. The dependency gate blocks high and critical advisories without
silently forcing unsafe major-version downgrades.

---

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # serve the production build
npm run check:types # TypeScript without emitting files
npm run lint        # eslint
npm run check:data  # self-checks for date parsing, slug round-trips, platform mapping
npm run quality:static  # types + lint + provider/domain contracts
npm run quality:runtime # audit a production server at http://127.0.0.1:3137
npm run test:e2e        # 24 Chromium, responsive, keyboard and Axe checks
npm run audit:security  # fail on high or critical dependency advisories
```

`check:data` exercises the pure logic in the data layer — Steam's human-readable
date parsing, provider slug round-trips, platform vocabulary normalisation and
IGDB image resizing. These decide what date a user is shown and which provider
owns a URL, so they are pinned down rather than assumed.

For the runtime audit, build and start LUDEX on port `3137` first. Set
`QUALITY_BASE_URL` to target another deployment, and `QUALITY_REQUIRE_PROVIDER=1`
when IGDB and storefront connectivity must be live rather than explicitly degraded.

---

Game data from [IGDB](https://www.igdb.com) and the
[Steam](https://store.steampowered.com) storefront. Not affiliated with any
publisher or platform holder.
