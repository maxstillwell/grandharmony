"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { auditLogs, websitePublishEvents, websiteRevisions } from "@/lib/db/schema";
import { approvedStaticImageUrls, defaultWebsiteContent, type WebsiteContent } from "./types";

function checkedContent(content: WebsiteContent) {
  if (!content?.hero?.headline?.trim() || !content.hero.subtitle?.trim()) throw new Error("Hero headline and subtitle are required.");
  if (content.hero.mode !== "image" || content.hero.mediaUrl !== defaultWebsiteContent.hero.mediaUrl || content.hero.posterUrl !== defaultWebsiteContent.hero.posterUrl) {
    throw new Error("Hero media is managed separately. Keep the approved static image while uploads are unavailable.");
  }
  if (!["left", "center"].includes(content.hero.alignment) || !["light", "medium", "strong"].includes(content.hero.overlay)) throw new Error("Hero display settings are invalid.");
  const requiredSections = ["about", "experience", "construction", "expertise", "team", "developments", "contact"] as const;
  if (!content.sections || !requiredSections.every(key => {
    const section = content.sections[key];
    return typeof section?.heading === "string" && typeof section?.body === "string" && typeof section?.visible === "boolean" && section.heading.length <= 160 && section.body.length <= 5000;
  })) throw new Error("One or more website content fields are invalid or too long.");
  if (!Array.isArray(content.projects) || !Array.isArray(content.team) || content.projects.length > 40 || content.team.length > 40) throw new Error("The website gallery has an invalid number of items.");
  if (![...content.projects, ...content.team].every(item => approvedStaticImageUrls.has(item.imageUrl))) throw new Error("Only approved static images can be used while uploads are unavailable.");
  return content;
}

export async function saveWebsiteDraft(content: WebsiteContent, draftId?: string) {
  const access = await requireSuperAdmin(); const db = getDb(); const checked = checkedContent(content);
  const now = new Date();
  if (draftId) {
    const [updated] = await db.update(websiteRevisions).set({ content: checked, updatedAt: now }).where(and(eq(websiteRevisions.id, draftId), eq(websiteRevisions.status, "draft"))).returning();
    if (!updated) throw new Error("Draft was not found or is no longer editable.");
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  }
  const [created] = await db.insert(websiteRevisions).values({ content: checked, createdByUserId: access.userId, updatedAt: now }).returning();
  return { id: created.id, updatedAt: created.updatedAt.toISOString() };
}

export async function publishWebsiteDraft(revisionId: string) {
  const access = await requireSuperAdmin(); const db = getDb(); const now = new Date();
  const [draft] = await db.select().from(websiteRevisions).where(and(eq(websiteRevisions.id, revisionId), eq(websiteRevisions.status, "draft"))).limit(1);
  if (!draft) throw new Error("Save a draft before publishing.");
  checkedContent(draft.content as WebsiteContent);
  await db.transaction(async tx => {
    await tx.update(websiteRevisions).set({ status: "archived", updatedAt: now }).where(eq(websiteRevisions.status, "published"));
    await tx.update(websiteRevisions).set({ status: "published", publishedAt: now, publishedByUserId: access.userId, updatedAt: now }).where(eq(websiteRevisions.id, revisionId));
    await tx.insert(websitePublishEvents).values({ revisionId, action: "published", actorUserId: access.userId });
    await tx.insert(auditLogs).values({ actorUserId: access.userId, action: "website.publish", entityType: "website_revision", entityId: revisionId });
  });
  revalidatePath("/"); revalidatePath("/projects/[slug]", "page");
}

export async function restoreWebsiteRevision(revisionId: string) {
  const access = await requireSuperAdmin(); const db = getDb();
  const [source] = await db.select().from(websiteRevisions).where(eq(websiteRevisions.id, revisionId)).limit(1);
  if (!source || !["published", "archived"].includes(source.status)) throw new Error("Only a published website version can be restored.");
  const [draft] = await db.insert(websiteRevisions).values({ status: "draft", content: source.content, createdByUserId: access.userId }).returning();
  await db.insert(auditLogs).values({ actorUserId: access.userId, action: "website.restore_draft", entityType: "website_revision", entityId: draft.id, metadata: { sourceRevisionId: revisionId } });
  return { id: draft.id, content: draft.content as WebsiteContent, updatedAt: draft.updatedAt.toISOString() };
}

export async function createDefaultWebsiteDraft() {
  const result = await saveWebsiteDraft(defaultWebsiteContent);
  return { ...result, content: defaultWebsiteContent };
}
