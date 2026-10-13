import { and, desc, eq } from "drizzle-orm";
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
  const [draft] = await db.select().from(websiteRevisions).where(eq(websiteRevisions.status, "draft")).orderBy(desc(websiteRevisions.updatedAt)).limit(1);
  const [published] = await db.select().from(websiteRevisions).where(eq(websiteRevisions.status, "published")).orderBy(desc(websiteRevisions.publishedAt)).limit(1);
  return { draft: draft ? { id: draft.id, content: draft.content as WebsiteContent, updatedAt: draft.updatedAt.toISOString() } : null, published: published ? { id: published.id, content: published.content as WebsiteContent, publishedAt: published.publishedAt?.toISOString() ?? null } : null };
}
