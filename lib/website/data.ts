import { desc, eq, inArray } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { websiteRevisions } from "@/lib/db/schema";
import { defaultWebsiteContent, type WebsiteContent } from "./types";

export async function getPublishedWebsiteContent(): Promise<WebsiteContent> {
  if (!isDatabaseConfigured()) return defaultWebsiteContent;
  try {
    const revision = await getDb().select().from(websiteRevisions).where(eq(websiteRevisions.status, "published")).orderBy(desc(websiteRevisions.publishedAt)).limit(1);
    return revision[0] ? revision[0].content as WebsiteContent : defaultWebsiteContent;
  } catch { return defaultWebsiteContent; }
}

export async function getWebsiteWorkspace() {
  const db = getDb();
  const [drafts, releases] = await Promise.all([
    db.select().from(websiteRevisions).where(eq(websiteRevisions.status, "draft")).orderBy(desc(websiteRevisions.updatedAt)).limit(1),
    db.select().from(websiteRevisions).where(inArray(websiteRevisions.status, ["published", "archived"])).orderBy(desc(websiteRevisions.publishedAt)).limit(8),
  ]);
  const draft = drafts[0]; const published = releases.find(item => item.status === "published");
  const revision = (item: typeof websiteRevisions.$inferSelect) => ({ id: item.id, content: item.content as WebsiteContent, updatedAt: item.updatedAt.toISOString(), publishedAt: item.publishedAt?.toISOString() ?? null, status: item.status });
  return { draft: draft ? revision(draft) : null, published: published ? revision(published) : null, releases: releases.map(revision) };
}
