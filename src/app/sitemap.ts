import type { MetadataRoute } from "next";
import { sampleSlugs } from "@/lib/games/source";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Static routes plus the pre-rendered game pages. Live RAWG titles are rendered
 * on demand and intentionally left out — enumerating half a million slugs would
 * produce a sitemap no crawler would thank us for.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/upcoming`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/genres`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/platforms`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const gameRoutes: MetadataRoute.Sitemap = sampleSlugs().map((slug) => ({
    url: `${BASE}/game/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...gameRoutes];
}
