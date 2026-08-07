import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // RAWG serves all media from these hosts. Remote patterns are required for
    // next/image optimisation to accept them.
    remotePatterns: [
      { protocol: "https", hostname: "media.rawg.io", pathname: "/**" },
      { protocol: "https", hostname: "api.rawg.io", pathname: "/**" },
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
