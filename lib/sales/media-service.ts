import {
  bundledSource,
  bundledPreview,
  unit02SourcePackage,
  sourceFloorEvidence,
} from "./bundled-media";
import { createHash } from "node:crypto";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import type { SalesDb } from "./db";
import * as s from "../db/schema";
import { assertSales, isAgent } from "./permissions";
import { assertScope } from "./workspace-scope";
import { record, text, validId } from "./domain";
import { recordSalesEvent, createSalesService } from "./service";
import {
  fixtureHashes,
  mediaKinds,
  mediaUrl,
  sourceComparison,
} from "./media-domain";
const slug = (v: unknown) =>
  typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(v);
export function createResidenceMediaService(
  db: SalesDb,
  scopeKey = "real",
  options: { publicPublication?: boolean } = {},
) {
  const scope = (pid: string) =>
    and(
      eq(s.salesResidenceMedia.projectId, pid),
      eq(s.salesResidenceMedia.scopeKey, scopeKey),
    );
  function access(a: PortalAccess, pid: string) {
    assertScope(a, pid, scopeKey);
    assertSales(a, pid, "inventory.edit");
    if (isAgent(a, pid))
      throw Error("Draft media is internal management information.");
  }
  async function workspace(a: PortalAccess, pid: string) {
    access(a, pid);
    const versions = await db
      .select()
      .from(s.salesResidenceMedia)
      .where(scope(pid))
      .orderBy(desc(s.salesResidenceMedia.createdAt));
    const current = await db
      .select()
      .from(s.salesResidenceMediaCurrent)
      .where(
        and(
          eq(s.salesResidenceMediaCurrent.projectId, pid),
          eq(s.salesResidenceMediaCurrent.scopeKey, scopeKey),
        ),
      );
    return {
      sourceSampleAvailable:
        (
          await db
            .select()
            .from(s.salesProjects)
            .where(eq(s.salesProjects.projectId, pid))
        )[0]?.publicKey === "golfview",
      versions: versions.map((v) => ({
        ...v,
        previewUrl: v.synthetic
          ? `/api/portal/projects/${pid}/sales/media/fixture/${v.url.slice(8)}.svg?demo=1`
          : bundledPreview(v)
            ? `/api/portal/projects/${pid}/sales/media/assets/${v.sha256}${scopeKey === "real" ? "" : "?demo=1"}`
            : v.url,
      })),
      current,
      publicPublicationEnabled:
        scopeKey !== "real" ||
        options.publicPublication === true ||
        process.env.SALES_MEDIA_PUBLICATION_ENABLED === "true",
    };
  }
  async function execute(
    a: PortalAccess,
    pid: string,
    operation: string,
    input: unknown,
  ): Promise<unknown> {
    access(a, pid);
    const r = record(input);
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${pid + ":" + scopeKey}))`,
      );
      const audit = async (
        action: string,
        unitId: string,
        details: Record<string, unknown>,
      ) =>
        recordSalesEvent(
          tx,
          pid,
          a.userId,
          "media." + action,
          { unitId },
          details,
          scopeKey,
        );
      if (operation === "importManifest") {
        const unitId = String(r.unitId);
        if (
          !validId(unitId) ||
          typeof r.manifest !== "string" ||
          r.manifest.length > 500000
        )
          throw Error("Choose a residence and bounded manifest JSON.");
        const manifest = JSON.parse(r.manifest),
          [unit] = await tx
            .select()
            .from(s.salesUnits)
            .where(
              and(eq(s.salesUnits.projectId, pid), eq(s.salesUnits.id, unitId)),
            );
        if (
          !unit ||
          manifest.contractVersion !== 1 ||
          !Array.isArray(manifest.assets) ||
          manifest.assets.length < 1 ||
          manifest.assets.length > 100
        )
          throw Error("Invalid selected residence or manifest.");
        const [settings] = await tx
          .select()
          .from(s.salesProjects)
          .where(eq(s.salesProjects.projectId, pid));
        const key =
            settings.publicKey === "golfview" ? "700" : settings.publicKey,
          seen = new Set<string>(),
          entries = [],
          changes = [];
        for (const a of manifest.assets) {
          if (
            a.residenceKey !== `${key}:${Number(unit.number)}` ||
            !slug(a.floorId) ||
            !slug(a.slot) ||
            !mediaKinds.includes(a.kind) ||
            ![
              "image/svg+xml",
              "image/png",
              "image/jpeg",
              "image/webp",
              "application/pdf",
            ].includes(a.mime) ||
            !/^[a-f0-9]{64}$/.test(a.sha256)
          )
            throw Error(
              "Manifest residence/floor/slot/type does not match the canonical selection.",
            );
          const slot = a.floorId + ":" + a.slot;
          if (seen.has(slot))
            throw Error(
              "Import one current asset per floor/slot in a package.",
            );
          seen.add(slot);
          if (typeof a.synthetic !== "boolean")
            throw Error("Manifest synthetic flag must be explicit.");
          if (a.synthetic && scopeKey === "real")
            throw Error("Synthetic manifests are Demo-only.");
          const registeredUrl = mediaUrl(a.url, a.synthetic === true);
          if (
            a.synthetic &&
            a.sha256 !==
              fixtureHashes[
                registeredUrl.slice(8) as keyof typeof fixtureHashes
              ]
          )
            throw Error("Fixture checksum mismatch.");
          if (
            a.bytes != null &&
            (!Number.isSafeInteger(a.bytes) ||
              a.bytes < 1 ||
              a.bytes > 100000000)
          )
            throw Error("Invalid asset size.");
          text(a.sourceFloorId, 120);
          text(
            a.sourceDocument ??
              `Adapter package ${a.version ?? "unversioned"} / ${a.sourceFile ?? a.title}`,
            2000,
            true,
          );
          for (const field of ["floorLabel", "title", "sourceRevision"])
            text(a[field], 300, true);
          const [previous] = await tx
            .select()
            .from(s.salesResidenceMedia)
            .where(
              and(
                scope(pid),
                eq(s.salesResidenceMedia.unitId, unitId),
                eq(s.salesResidenceMedia.floorId, a.floorId),
                eq(s.salesResidenceMedia.slot, a.slot),
              ),
            )
            .orderBy(desc(s.salesResidenceMedia.versionNumber))
            .limit(1);
          const unchanged = Boolean(
            previous &&
              previous.sha256 === a.sha256 &&
              previous.sourceRevision === a.sourceRevision &&
              previous.url === a.url &&
              previous.mime === a.mime &&
              previous.kind === a.kind &&
              previous.floorLabel === a.floorLabel,
          );
          const entry = {
            ...a,
            unitId,
            sourceDocument:
              a.sourceDocument ??
              `Adapter package ${a.version ?? "unversioned"} / ${a.sourceFile ?? a.title}`,
            previousId: previous?.id ?? null,
          };
          entries.push(entry);
          changes.push({
            previousRevision: previous?.revision ?? 0,
            floorId: a.floorId,
            slot: a.slot,
            previousId: previous?.id ?? null,
            changeStatus: unchanged
              ? "unchanged"
              : sourceComparison(previous, a.sha256, a.changeStatus),
            unchanged,
          });
        }
        const digest = createHash("sha256")
          .update(JSON.stringify({ entries, changes }))
          .digest("hex");
        if (r.commit !== true)
          return { count: entries.length, changes, digest, committed: false };
        if (r.digest !== digest)
          throw Error(
            "Manifest or prior versions changed. Validate again before committing.",
          );
        for (let i = 0; i < entries.length; i++)
          if (!changes[i].unchanged)
            await createResidenceMediaService(
              tx as unknown as SalesDb,
              scopeKey,
            ).execute(a, pid, "register", entries[i]);
        await audit("package-imported", unitId, {
          count: entries.length,
          changed: changes.filter((c) => !c.unchanged).length,
          digest,
        });
        return { count: entries.length, changes, digest, committed: true };
      }
      if (operation === "register") {
        const unitId = String(r.unitId);
        if (
          !validId(unitId) ||
          !slug(r.floorId) ||
          !slug(r.slot) ||
          !mediaKinds.includes(r.kind as (typeof mediaKinds)[number])
        )
          throw Error(
            "Choose a canonical residence, stable floor and media slot.",
          );
        const [unit] = await tx
          .select()
          .from(s.salesUnits)
          .where(
            and(eq(s.salesUnits.projectId, pid), eq(s.salesUnits.id, unitId)),
          );
        if (!unit) throw Error("Residence is not in this project.");
        const synthetic = r.synthetic === true;
        if (synthetic && scopeKey === "real")
          throw Error(
            "Synthetic media can only be registered in your Demo workspace.",
          );
        const url = mediaUrl(r.url, synthetic),
          mime = String(r.mime),
          sha256 = String(r.sha256);
        if (
          ![
            "image/svg+xml",
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/pdf",
          ].includes(mime) ||
          !/^[a-f0-9]{64}$/.test(sha256)
        )
          throw Error("A supported MIME and SHA-256 are required.");
        if (
          synthetic &&
          (!url.startsWith("fixture:") ||
            sha256 !==
              fixtureHashes[url.slice(8) as keyof typeof fixtureHashes])
        )
          throw Error(
            "Synthetic fixture checksum does not match the bundled abstract test asset.",
          );
        const bound = bundledSource(url);
        if (bound) {
          const [settings] = await tx
            .select()
            .from(s.salesProjects)
            .where(eq(s.salesProjects.projectId, pid));
          if (
            settings?.publicKey !== "golfview" ||
            Number(unit.number) !== 2 ||
            bound.floorId !== r.floorId ||
            bound.slot !== r.slot ||
            bound.sha256 !== sha256 ||
            bound.mime !== mime ||
            bound.kind !== r.kind ||
            bound.sourceRevision !== r.sourceRevision
          )
            throw Error(
              "Bundled source asset does not match this canonical residence, floor or source revision.",
            );
        }
        const rows = await tx
          .select()
          .from(s.salesResidenceMedia)
          .where(
            and(
              scope(pid),
              eq(s.salesResidenceMedia.unitId, unitId),
              eq(s.salesResidenceMedia.floorId, String(r.floorId)),
              eq(s.salesResidenceMedia.slot, String(r.slot)),
            ),
          )
          .orderBy(desc(s.salesResidenceMedia.versionNumber));
        const previous = rows[0];
        if ((r.previousId || null) !== (previous?.id ?? null))
          throw Error(
            "The previous version changed. Reload the selected residence/floor before registering.",
          );
        const bytes =
          r.bytes == null || r.bytes === "" ? null : Number(r.bytes);
        if (
          bytes !== null &&
          (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 100000000)
        )
          throw Error("Invalid asset size.");
        const [v] = await tx
          .insert(s.salesResidenceMedia)
          .values({
            projectId: pid,
            scopeKey,
            unitId,
            floorId: String(r.floorId),
            floorLabel: text(r.floorLabel, 120, true)!,
            slot: String(r.slot),
            kind: String(r.kind),
            versionNumber: (previous?.versionNumber ?? 0) + 1,
            title: text(r.title, 300, true)!,
            url,
            mime,
            sha256,
            bytes,
            sourceRevision: text(r.sourceRevision, 300, true)!,
            sourceDocument: text(r.sourceDocument, 2000, true)!,
            sourceFloorId: text(r.sourceFloorId, 120),
            previousId: previous?.id ?? null,
            changeStatus: sourceComparison(previous, sha256, r.changeStatus),
            comparisonEvidence: text(r.comparisonEvidence, 3000),
            synthetic,
            createdByUserId: a.userId,
          })
          .returning();
        await audit("registered", unitId, {
          id: v.id,
          floorId: v.floorId,
          slot: v.slot,
          previousId: v.previousId,
          changeStatus: v.changeStatus,
          sourceRevision: v.sourceRevision,
          synthetic,
        });
        return v.id;
      }
      if (operation === "seedUnit02Demo") {
        if (scopeKey === "real")
          throw Error("Source change test is Demo-only.");
        const [unit] = await tx
          .select()
          .from(s.salesUnits)
          .where(
            and(
              eq(s.salesUnits.projectId, pid),
              eq(s.salesUnits.id, String(r.unitId)),
            ),
          );
        const [settings] = await tx
          .select()
          .from(s.salesProjects)
          .where(eq(s.salesProjects.projectId, pid));
        if (
          !unit ||
          Number(unit.number) !== 2 ||
          settings?.publicKey !== "golfview"
        )
          throw Error(
            "Select Golfview Residence 02 for the source package demonstration.",
          );
        if (
          (
            await tx
              .select()
              .from(s.salesResidenceMedia)
              .where(and(scope(pid), eq(s.salesResidenceMedia.unitId, unit.id)))
          ).length
        )
          throw Error(
            "This Demo residence already has media. Use its versions or reset your own Demo first.",
          );
        const service = createResidenceMediaService(
          tx as unknown as SalesDb,
          scopeKey,
        );
        let first: string | null = null;
        for (const asset of unit02SourcePackage.manifest.assets) {
          const id = await service.execute(a, pid, "register", {
            ...asset,
            unitId: unit.id,
          });
          if (asset.floorId === "first") first = String(id);
        }
        const firstAsset = unit02SourcePackage.manifest.assets.find(
          (a) => a.floorId === "first",
        )!;
        await service.execute(a, pid, "register", {
          ...firstAsset,
          bytes: null,
          unitId: unit.id,
          previousId: first,
          url: "fixture:unit02-first-change",
          sha256: fixtureHashes["unit02-first-change"],
          sourceRevision: "TEST first-floor wall +150mm — NOT REAL REVISION",
          sourceDocument:
            "Controlled copy of genuine B source; isolated Demo; original source unchanged",
          title: "TEST ONLY — first-floor source change, not real architecture",
          synthetic: true,
          changeStatus: "manual-review",
          comparisonEvidence: sourceFloorEvidence("first"),
        });
        return {
          baselineAssets: 6,
          changedFloors: ["first"],
          unchangedFloors: ["ground", "second"],
          testOnly: true,
        };
      }
      if (operation === "seedDemo") {
        if (scopeKey === "real")
          throw Error("Load test fixtures only in Demo mode.");
        const unitId = String(r.unitId);
        const existing = await tx
          .select()
          .from(s.salesResidenceMedia)
          .where(and(scope(pid), eq(s.salesResidenceMedia.unitId, unitId)));
        if (existing.length)
          throw Error(
            "This residence already has media in your Demo. Use the existing versions or reset your Demo.",
          );
        const service = createResidenceMediaService(
          tx as unknown as SalesDb,
          scopeKey,
        );
        let previousId: string | null = null;
        for (const [floorId, floorLabel, fixture] of [
          ["ground", "Ground Floor", "a"],
          ["ground", "Ground Floor", "b"],
          ["first", "First Floor", "a"],
          ["second", "Second Floor", "a"],
        ]) {
          const id = await service.execute(a, pid, "register", {
            unitId,
            floorId,
            floorLabel,
            slot: "floor-plan",
            kind: "floor-plan",
            title: "SYNTHETIC ADAPTER TEST — NOT PROJECT ARCHITECTURE",
            url: "fixture:" + fixture,
            mime: "image/svg+xml",
            sha256: fixtureHashes[fixture as "a" | "b"],
            sourceRevision: "TEST " + fixture.toUpperCase(),
            sourceDocument:
              "Bundled abstract fixture; not an architectural drawing",
            synthetic: true,
            previousId: floorId === "ground" ? previousId : null,
          });
          if (floorId === "ground") previousId = String(id);
        }
        return true;
      }
      if (!validId(r.id)) throw Error("Choose a media version.");
      const [v] = await tx
        .select()
        .from(s.salesResidenceMedia)
        .where(and(scope(pid), eq(s.salesResidenceMedia.id, r.id)))
        .for("update");
      if (!v || v.revision !== Number(r.revision))
        throw Error(
          "Media version changed or is not in this workspace. Reload.",
        );
      const [unit] = await tx
        .select()
        .from(s.salesUnits)
        .where(
          and(eq(s.salesUnits.projectId, pid), eq(s.salesUnits.id, v.unitId)),
        )
        .for("update");
      if (
        operation === "review" ||
        operation === "approve" ||
        operation === "reject"
      ) {
        if (r.confirm !== true)
          throw Error("Explicit review confirmation is required.");
        const evidence = text(r.evidence, 3000, true)!;
        if (operation === "approve") {
          assertSales(a, pid, "publication.approve");
          if (v.status !== "reviewed")
            throw Error("Review the version before approval.");
          if (
            scopeKey === "real" &&
            unit.validationWarnings.some((x) => x.includes("DESIGN CONFLICT"))
          )
            throw Error(
              "Residence design conflict blocks publication approval.",
            );
        } else if (operation === "review" && v.status !== "draft")
          throw Error("Only a draft can enter reviewed status.");
        else if (
          operation === "reject" &&
          !["draft", "reviewed"].includes(v.status)
        )
          throw Error(
            "Approved versions remain immutable; register a replacement.",
          );
        const status =
          operation === "approve"
            ? "approved"
            : operation === "reject"
              ? "rejected"
              : "reviewed";
        await tx
          .update(s.salesResidenceMedia)
          .set({
            status,
            revision: v.revision + 1,
            updatedAt: new Date(),
            ...(operation === "approve"
              ? {
                  approvedByUserId: a.userId,
                  approvedAt: new Date(),
                  approvalEvidence: evidence,
                }
              : {
                  reviewedByUserId: a.userId,
                  reviewedAt: new Date(),
                  approvalEvidence: evidence,
                }),
          })
          .where(eq(s.salesResidenceMedia.id, v.id));
        await audit(status, v.unitId, {
          id: v.id,
          from: v.status,
          to: status,
          evidence,
          synthetic: v.synthetic,
        });
        return v.id;
      }
      if (operation === "publish" || operation === "restore") {
        assertSales(a, pid, "publication.publish");
        if (r.confirm !== true || !text(r.evidence, 3000, true))
          throw Error(
            "Confirm the exact approved version and publication reason.",
          );
        if (v.status !== "approved")
          throw Error("Only an approved version can be promoted or restored.");
        if (scopeKey === "real") {
          if (
            options.publicPublication !== true &&
            process.env.SALES_MEDIA_PUBLICATION_ENABLED !== "true"
          )
            throw Error(
              "Public media release is disabled for this unfinished sales experience. Approval is retained privately.",
            );
          if (
            v.synthetic ||
            unit.validationWarnings.some((x) => x.includes("DESIGN CONFLICT"))
          )
            throw Error(
              "Synthetic content and design conflicts cannot be published.",
            );
          const url = new URL(v.url);
          if (
            /^\/(?:internal(?:\/|$)|api\/portal(?:\/|$))/.test(
              decodeURIComponent(url.pathname),
            )
          )
            throw Error(
              "Draft/private assets cannot be promoted as public media.",
            );
          const [settings] = await tx
            .select()
            .from(s.salesProjects)
            .where(eq(s.salesProjects.projectId, pid));
          const [pub] = settings?.publishedPublicationId
            ? await tx
                .select()
                .from(s.salesPublications)
                .where(
                  and(
                    eq(s.salesPublications.projectId, pid),
                    eq(s.salesPublications.id, settings.publishedPublicationId),
                    eq(s.salesPublications.status, "published"),
                  ),
                )
            : [];
          if (!pub?.snapshot.units.some((u) => u.id === v.unitId))
            throw Error(
              "Residence is not in the current approved public inventory snapshot.",
            );
        }
        const t = s.salesResidenceMediaCurrent,
          [old] = await tx
            .select()
            .from(t)
            .where(
              and(
                eq(t.projectId, pid),
                eq(t.scopeKey, scopeKey),
                eq(t.unitId, v.unitId),
                eq(t.floorId, v.floorId),
                eq(t.slot, v.slot),
              ),
            )
            .for("update");
        if (Number(r.currentRevision ?? 0) !== (old?.revision ?? 0))
          throw Error("Current public version changed. Reload.");
        await tx
          .insert(t)
          .values({
            projectId: pid,
            scopeKey,
            unitId: v.unitId,
            floorId: v.floorId,
            slot: v.slot,
            mediaId: v.id,
            publishedByUserId: a.userId,
            revision: (old?.revision ?? 0) + 1,
          })
          .onConflictDoUpdate({
            target: [t.projectId, t.scopeKey, t.unitId, t.floorId, t.slot],
            set: {
              mediaId: v.id,
              publishedByUserId: a.userId,
              revision: (old?.revision ?? 0) + 1,
              updatedAt: new Date(),
            },
          });
        await audit(operation, v.unitId, {
          id: v.id,
          previousId: old?.mediaId ?? null,
          floorId: v.floorId,
          slot: v.slot,
          evidence: r.evidence,
          synthetic: v.synthetic,
        });
        return v.id;
      }
      throw Error("Unknown media operation.");
    });
  }
  async function publicManifest(key: string, residenceId?: string | null) {
    if (
      options.publicPublication !== true &&
      process.env.SALES_MEDIA_PUBLICATION_ENABLED !== "true"
    )
      return { contractVersion: 1, assets: [] };
    const publication = await createSalesService(db).publicInventory(key),
      [project] = await db
        .select()
        .from(s.salesProjects)
        .where(eq(s.salesProjects.publicKey, key));
    if (!project) return { contractVersion: 1, assets: [] };
    const ids = publication.units
      .filter((u) => !residenceId || u.id === residenceId)
      .map((u) => u.id);
    if (!ids.length) return { contractVersion: 1, assets: [] };
    const rows = await db
      .select({ media: s.salesResidenceMedia })
      .from(s.salesResidenceMediaCurrent)
      .innerJoin(
        s.salesResidenceMedia,
        eq(s.salesResidenceMedia.id, s.salesResidenceMediaCurrent.mediaId),
      )
      .where(
        and(
          eq(s.salesResidenceMediaCurrent.projectId, project.projectId),
          eq(s.salesResidenceMediaCurrent.scopeKey, "real"),
          eq(s.salesResidenceMedia.status, "approved"),
          eq(s.salesResidenceMedia.synthetic, false),
          inArray(s.salesResidenceMedia.unitId, ids),
        ),
      );
    return {
      contractVersion: 1,
      assets: rows.map(({ media: m }) => ({
        id: m.id,
        residenceKey: `${key === "golfview" ? "700" : key}:${publication.units.find((u) => u.id === m.unitId)!.number.replace(/^0+(?=\d)/, "")}`,
        floorId: m.floorId,
        floorLabel: m.floorLabel,
        slot: m.slot,
        kind: m.kind,
        title: m.title,
        url: m.url,
        mime: m.mime,
        sourceRevision: m.sourceRevision,
        sha256: m.sha256,
        version: String(m.versionNumber),
        previousId: null,
        synthetic: false,
        approval: "approved",
        sourceFloorId: m.sourceFloorId,
      })),
    };
  }
  return { workspace, execute, publicManifest };
}
export type ResidenceMediaData = Awaited<
  ReturnType<ReturnType<typeof createResidenceMediaService>["workspace"]>
>;
