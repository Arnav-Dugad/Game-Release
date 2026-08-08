import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Footer } from "@/components/layout/Footer";

/**
 * Sora carries the display voice (tight, geometric, high contrast at large
 * sizes); Inter handles body copy where legibility at 13–16px matters more.
 * Both are loaded as variables so CSS decides which is used where.
 */
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_NAME = "LUDEX";
const SITE_DESCRIPTION =
  "Track every upcoming video game release, browse critic scores, platforms and screenshots, and build a watchlist of what you're waiting for.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL on Vercel so social cards resolve absolute URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${SITE_NAME} — Upcoming video game releases & database`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "video game releases",
    "upcoming games",
    "game release dates",
    "game database",
    "metacritic scores",
    "game watchlist",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Upcoming video game releases`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Upcoming video game releases`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#04040a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom — capping it fails WCAG 1.4.4.
  maximumScale: 5,
  viewportFit: "cover",
};

/*
 * Deliberately not `async`, and deliberately reads no cookies.
 *
 * The region preference used to be read here so the provider could be seeded
 * during SSR. `cookies()` in the *root layout* is the widest possible dynamic
 * opt-in: it forces every route in the application to be server-rendered on
 * demand, which cost the site all of its prerendering and ISR — the homepage,
 * browse, genres, platforms and all 60 prerendered game pages included.
 *
 * That is a very large bill for a very small benefit. The region only affects
 * Steam price formatting, `PreferencesProvider` already recovers it on mount
 * from localStorage and the cookie, and the one page where the price is shown
 * resolves it separately. So the read belongs there, not here.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh-safe bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[500] focus:rounded-full focus:bg-brand focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <Providers>
          <SiteChrome />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
