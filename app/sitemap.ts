import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://grandharmony.vercel.app";
  return ["", "/projects/700-project", "/projects/strategic-land-assets"].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: path ? 0.8 : 1 }));
}
