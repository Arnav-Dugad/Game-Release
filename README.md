# LUDEX

A release calendar and reference database for video games — upcoming releases with
live countdowns, critic scores, screenshots, platforms, and a personal watchlist.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Motion and Firebase.

---

## Runs with zero configuration

Clone, install, run. No API keys, no accounts, no network dependencies:

```bash
npm install
npm run dev
```

Every page renders immediately against a **bundled sample catalogue** of ~50 games.
Titles without artwork get procedurally generated cover art derived from the slug,
so nothing ever shows a broken image or an empty grid.

Adding keys upgrades the experience; nothing breaks without them.

| Without keys | With keys |
| --- | --- |
| ~50 bundled games, generated cover art | Full RAWG database, real artwork, screenshots, trailers, store links |
| Auth pages explain that sign-in is unconfigured | Email/password + Google sign-in, watchlists, reviews |

---

## Adding live data (free)

### 1. Game data — RAWG

Get a free key at [rawg.io/apidocs](https://rawg.io/apidocs) (20,000 requests/month,
far more than this app needs since every response is cached).

```bash
cp .env.local.example .env.local
# then set RAWG_API_KEY=your_key
```

The key is read server-side only and never reaches the browser.

### 2. Accounts & database — Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a **Web App**, copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables
3. **Authentication → Sign-in method** → enable *Email/Password* and *Google*
4. **Firestore Database** → create a database
5. **Firestore → Rules** → paste [`firestore.rules`](./firestore.rules) and publish
6. **Authentication → Settings → Authorised domains** → add your deployed domain

The `NEXT_PUBLIC_` prefix is correct here — Firebase web config is public by design.
Access is enforced by the Firestore rules, not by hiding these values.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new) — the framework is detected
   automatically, no build settings to change
3. Add your environment variables under **Settings → Environment Variables**
   (including `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app` for correct
   canonical URLs, sitemap and social cards)
4. Deploy

If you add Firebase after the first deploy, remember step 6 above — add the Vercel
domain to Firebase's authorised domains or Google sign-in will be rejected.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Auto-advancing featured hero, live stats, upcoming/trending/acclaimed/new rails, genre grid |
| `/upcoming` | Month-grouped release calendar with per-title countdowns |
| `/browse` | Full database with genre/platform filters, sorting and pagination — all URL-driven |
| `/game/[slug]` | Detail page: parallax hero, countdown, score ring, screenshots lightbox, trailers, system requirements, community reviews, related games |
| `/genres`, `/platforms` | Category browsing |
| `/login`, `/signup` | Split-screen auth with email/password and Google |
| `/watchlist` | Tracked games with play status (want / playing / played) |
| `/profile` | Identity, stats, review history, settings |

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
RAWG payload. `src/lib/games/source.ts` is the single entry point: it tries RAWG,
and on *any* failure — missing key, rate limit, timeout, outage — falls back to the
bundled catalogue. A degraded state is always a well-defined one, never a 500. Each
query returns its provenance so the UI can honestly badge sample data.

**Sample data is honest by construction.** Released titles carry real ship dates and
critic scores. Unreleased titles are marked TBA and carry no invented dates. A
visible notice labels sample mode wherever it appears.

**Firebase never blocks a render.** Config is validated up front and every accessor
short-circuits on the server. With no config the app reports `enabled: false` and
auth screens explain themselves rather than throwing.

**One watchlist subscription.** A single Firestore listener at the provider level
serves every card on a page, rather than one listener per card. Toggles are
optimistic and roll back on failure.

**Accessibility.** Skip link, focus-visible rings, `aria-live` toasts, keyboard-driven
palette and lightbox, 44px minimum touch targets, pinch-zoom never disabled, and
`prefers-reduced-motion` honoured both globally and per-component (components swap
to a static presentation rather than running the same animation instantly).

---

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

---

Game data by [RAWG](https://rawg.io). Not affiliated with any publisher or platform
holder.
