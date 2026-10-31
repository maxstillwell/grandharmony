import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep ws optional native modules out of Next's server bundle. Bundling can
  // turn bufferutil into a stub and break Neon WebSocket frames in production.
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  outputFileTracingIncludes: {
    "/api/portal/projects/[projectId]/sales/media/assets/[sha256]": ["./assets/sales-media/golfview-unit02-v1/**/*"],
    "/api/portal/projects/[projectId]/sales/media/fixture/[file]": ["./assets/sales-media-test/*.svg"],
    "/api/portal/sales/[projectId]/drawing": [
      "./assets/sales/golfview-review/masterplan.svg",
    ],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
