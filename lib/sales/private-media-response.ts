import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import type { SalesDb } from "./db";
import { assertSales, isAgent } from "./permissions";
import { resolveSalesScope } from "./workspace-scope";
import { salesResidenceMedia } from "../db/schema";
import { bundledPreview } from "./bundled-media";
export async function privateMediaResponse(
  db: SalesDb,
  access: PortalAccess,
  projectId: string,
  sha256: string,
  demo = false,
) {
  try {
    assertSales(access, projectId, "inventory.edit");
    if (isAgent(access, projectId) || !/^[a-f0-9]{64}$/.test(sha256))
      throw Error("Not authorised");
    const scope = await resolveSalesScope(db, access, projectId, demo);
    const [version] = await db
      .select()
      .from(salesResidenceMedia)
      .where(
        and(
          eq(salesResidenceMedia.projectId, projectId),
          eq(salesResidenceMedia.scopeKey, scope),
          eq(salesResidenceMedia.sha256, sha256),
        ),
      )
      .limit(1);
    const item = version && bundledPreview(version);
    if (!item)
      return new Response("Registered asset unavailable", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const bytes = await readFile(item.filePath);
    if (createHash("sha256").update(bytes).digest("hex") !== sha256)
      throw Error("Source integrity failed");
    return new Response(bytes, {
      headers: {
        "Content-Type": item.mime,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self' data:; sandbox allow-same-origin",
      },
    });
  } catch {
    return new Response("Not authorised or source integrity failed", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
