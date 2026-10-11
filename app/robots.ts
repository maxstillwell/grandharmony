import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/demo/portal", "/portal"] }, sitemap: "https://grandharmony.vercel.app/sitemap.xml" };
}
