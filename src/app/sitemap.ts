import type { MetadataRoute } from "next";
import { popularSlugs } from "@/lib/games/source";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Static routes plus a sample of currently popular game pages. Enumerating
 * every live-provider slug would mean hundreds of thousands of entries for a
 * catalogue that changes constantly, so this lists what's trending, top rated
 * and upcoming right now — the titles most worth a crawler's attention —
 * rather than attempting completeness.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/upcoming`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/genres`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/platforms`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const slugs = await popularSlugs(200);
  const gameRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/game/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...gameRoutes];
}
