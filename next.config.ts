import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // One entry per media host the data providers can hand back. next/image
    // refuses any origin not listed here, so a missing entry shows up as a
    // broken image rather than a silent fallback.
    remotePatterns: [
      // IGDB artwork (covers, screenshots).
      { protocol: "https", hostname: "images.igdb.com", pathname: "/**" },
      // Steam capsules, headers and screenshots. Valve rotates between several
      // CDN fronts for the same asset, so all of them have to be allowed.
      { protocol: "https", hostname: "cdn.cloudflare.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "shared.cloudflare.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "shared.akamai.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "shared.fastly.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net", pathname: "/**" },
      // YouTube thumbnails for IGDB trailers (the poster only — the player
      // itself is not loaded until the user presses play).
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
    // Tuned to the breakpoints the grid actually renders at, so the optimiser
    // never generates sizes nothing requests.
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 320, 384],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
};

export default nextConfig;
