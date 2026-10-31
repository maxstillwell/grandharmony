import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep ws optional native modules out of Next's server bundle. Bundling can
  // turn bufferutil into a stub and break Neon WebSocket frames in production.
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
};

export default nextConfig;
