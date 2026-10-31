const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const { PGlite } = require("@electric-sql/pglite");
const { drizzle } = require("drizzle-orm/pglite");
const { eq } = require("drizzle-orm");
const s = require("../lib/db/schema.ts");
const domain = require("../lib/sales/domain.ts");
const { salesDateInput } = require("../lib/sales/dates.ts");
const { createSalesService } = require("../lib/sales/service.ts");
const { canSales } = require("../lib/sales/permissions.ts");
const { effectiveRole } = require("../lib/auth/roles.ts");
const { canViewModel } = require("../lib/models/permissions.ts");
let pg, db, service;
before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  const journal = JSON.parse(
    fs.readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  for (const entry of journal.entries)
    await pg.exec(fs.readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  db = drizzle(pg, { schema: s });
  service = createSalesService(db);
});
after(async () => pg?.close());
async function fixture() {
  const projectId = randomUUID(),
    userId = randomUUID(),
    agentId = randomUUID(),
    outsiderId = randomUUID();
  await db
    .insert(s.projects)
    .values({ id: projectId, name: "Isolated sales test", slug: projectId });
  await db
    .insert(s.users)
    .values(
      [userId, agentId, outsiderId].map((id) => ({
        id,
        email: `${id}@example.invalid`,
        name: "Isolated test user",
      })),
    );
  await db.insert(s.projectMemberships).values([
    { projectId, userId, role: "super_admin" },
    { projectId, userId: agentId, role: "external_agent" },
    { projectId, userId: outsiderId, role: "external_agent" },
  ]);
  const access = (role, id = userId) => ({
    userId: id,
    email: `${id}@example.invalid`,
    name: null,
    role,
    roles: [role],
    projects: [
      {
        id: projectId,
        name: "Isolated",
        slug: projectId,
        membershipRole: role,
        canManage: role === "super_admin",
      },
    ],
  });
  const admin = access("super_admin");
  await service.configure(admin, projectId, {
    publicKey: projectId,
    expectedUnits: "47",
  });
  return {
    projectId,
    userId,
    agentId,
    outsiderId,
    admin,
    access,
    agent: access("external_agent", agentId),
  };
}
const input = (number = "LOCAL-01") => ({
  number,
  sourceDocument:
    "Isolated automated test document, never published to a live database",
  bedrooms: "4",
  landAreaSqm: "123.45",
  publicVisible: true,
});
const enquiry = () => ({
  name: "Local test customer",
  email: "customer@example.invalid",
  message: "Isolated integration test only",
  privacyVersion: "test-v1",
  consent: true,
  marketingConsent: false,
  unitIds: [],
});
async function unit(f, number) {
  return service.saveUnit(f.admin, f.projectId, input(number));
}
async function current(id) {
  return (
    await db.select().from(s.salesUnits).where(eq(s.salesUnits.id, id))
  )[0];
}

test("roles are deterministic and project permissions cannot be escalated by global roles or canManage", () => {
  assert.equal(
    effectiveRole(["external_agent", "finance", "super_admin"]),
    "super_admin",
  );
  assert.equal(effectiveRole(["sales_manager", "finance"]), "finance");
  assert.equal(effectiveRole(["unknown"]), null);
  const access = {
    userId: randomUUID(),
    role: "super_admin",
    roles: ["super_admin"],
    projects: [{ id: "p", membershipRole: "external_agent", canManage: true }],
  };
  assert.equal(canSales(access, "p", "prices.view"), false);
  assert.equal(canSales(access, "p", "inventory.edit"), false);
  assert.equal(canSales(access, "other", "inventory.view"), false);
  assert.equal(
    canViewModel(access, {
      projectId: "p",
      category: "financial_models",
      status: "active",
    }),
    false,
  );
});
test("decimal validation never accepts floating-point financial inputs; import rejects fixtures and formulas", () => {
  assert.equal(domain.decimal("999999999999.99"), "999999999999.99");
  assert.throws(() => domain.decimal(0.1 + 0.2));
  assert.throws(() => domain.decimal("-1"));
  assert.throws(() => domain.decimal("1.001"));
  assert.throws(() => domain.validateUnit(input(" TEST-001 ")));
  assert.throws(() =>
    domain.parseImport("number,sourceDocument\nA1,Doc\nA1,Doc"),
  );
  assert.throws(() =>
    domain.parseImport("number,sourceDocument,askingPrice\nA1,Doc,10"),
  );
  assert.match(
    domain.csvExport([{ name: '=HYPERLINK("x")' }], ["name"]),
    /'=HYPERLINK/,
  );
  assert.throws(() =>
    domain.validateUnit({
      ...input(),
      media: ["https://example.invalid/a?token=private"],
    }),
  );
});
test("47-unit import is dry-run first, atomic, capacity-limited and does not invent a price or publication", async () => {
  const f = await fixture();
  const csv =
    "number,sourceDocument\n" +
    Array.from({ length: 47 }, (_, i) => `LOCAL-${i + 1},Isolated source`).join(
      "\n",
    );
  assert.equal(
    (await service.importInventory(f.admin, f.projectId, csv)).count,
    47,
  );
  assert.equal((await service.workspace(f.admin, f.projectId)).units.length, 0);
  await service.importInventory(f.admin, f.projectId, csv, true);
  const w = await service.workspace(f.admin, f.projectId);
  assert.equal(w.units.length, 47);
  assert.ok(
    w.units.every(
      (u) =>
        u.status === "not_released" &&
        !u.publicVisible &&
        u.publicAskingPrice === null,
    ),
  );
  await assert.rejects(
    service.saveUnit(f.admin, f.projectId, input("EXTRA")),
    /capacity/,
  );
  await assert.rejects(
    service.importInventory(f.admin, f.projectId, csv, true),
    /existing/,
  );
});
test("construction and release stages are independent and cross-project assignment is rejected", async () => {
  const f = await fixture(),
    other = await fixture();
  for (const [kind, n] of [
    ["construction", 2],
    ["release", 4],
  ])
    for (let i = 1; i <= n; i++)
      await service.saveStage(f.admin, f.projectId, {
        kind,
        code: String(i),
        name: `${kind} ${i}`,
      });
  const w = await service.workspace(f.admin, f.projectId);
  const id = await service.saveUnit(f.admin, f.projectId, {
    ...input(),
    constructionStageId: w.construction[0].id,
    releaseStageId: w.release[3].id,
  });
  assert.equal((await current(id)).releaseStageId, w.release[3].id);
  await assert.rejects(
    service.saveUnit(other.admin, other.projectId, {
      ...input(),
      constructionStageId: w.construction[0].id,
    }),
    /another project/,
  );
});
test("unit edits use optimistic revisions and preserve original provenance", async () => {
  const f = await fixture(),
    id = await unit(f);
  await service.saveUnit(
    f.admin,
    f.projectId,
    { ...input(), bedrooms: "3", sourceDocument: "Isolated revised source" },
    id,
    1,
  );
  const row = await current(id);
  assert.equal(row.revision, 2);
  assert.equal(row.bedrooms, 3);
  assert.equal(row.provenance.length, 2);
  assert.match(row.provenance[0].source, /Isolated/);
  await assert.rejects(
    service.saveUnit(f.admin, f.projectId, input(), id, 1),
    /changed/,
  );
  const outsider = { ...f.admin, projects: [] };
  await assert.rejects(
    service.saveUnit(outsider, f.projectId, input("OTHER")),
    /authorised/,
  );
});
test("sales transitions validate workflow and record responsible user, reason and timestamp", async () => {
  const f = await fixture(),
    id = await unit(f);
  await assert.rejects(
    service.changeStatus(
      f.admin,
      f.projectId,
      id,
      1,
      "settled",
      "invalid skip",
    ),
    /Invalid/,
  );
  let revision = 1;
  for (const state of [
    "available",
    "reserved",
    "contract_issued",
    "contract_signed",
    "unconditional",
    "settled",
  ])
    await service.changeStatus(
      f.admin,
      f.projectId,
      id,
      revision++,
      state,
      "Isolated workflow test",
    );
  const row = await current(id);
  assert.equal(row.status, "settled");
  assert.ok(row.statusChangedAt instanceof Date);
  const events = await db
    .select()
    .from(s.salesEvents)
    .where(eq(s.salesEvents.unitId, id));
  assert.equal(events.filter((e) => e.action === "unit.status").length, 6);
  assert.ok(events.every((e) => e.actorUserId === f.userId));
});
test("private and public prices have separate permissions and saving never publishes", async () => {
  const f = await fixture(),
    id = await unit(f);
  const sales = f.access("sales_manager");
  await assert.rejects(
    service.savePrices(sales, f.projectId, id, 1, { minimumPrice: "1.00" }),
    /authorised/,
  );
  await service.savePrices(f.admin, f.projectId, id, 1, {
    askingPrice: "1100000",
    minimumPrice: "1000000",
    contractPrice: "900000",
    depositAmount: "90000",
    gstTreatment: "inclusive",
  });
  const w = await service.workspace(sales, f.projectId);
  assert.equal(w.prices.length, 0);
  assert.equal(w.financeReport.length, 0);
  assert.equal(JSON.stringify(w).includes("1000000"), false);
  await service.savePrices(
    sales,
    f.projectId,
    id,
    2,
    { publicAskingPrice: "1200000", publicPriceVisible: true },
    true,
  );
  assert.equal((await service.publicInventory(f.projectId)).units.length, 0);
  await assert.rejects(
    service.exportCsv(sales, f.projectId, "prices"),
    /authorised/,
  );
});
test("draft, exact preview approval, atomic publish, editing isolation and approved rollback work", async () => {
  const f = await fixture(),
    id = await unit(f);
  await service.savePrices(f.admin, f.projectId, id, 1, {
    minimumPrice: "876543.21",
    contractPrice: "900000",
    gstTreatment: "inclusive",
  });
  await service.savePrices(
    f.admin,
    f.projectId,
    id,
    2,
    { publicAskingPrice: "1200000", publicPriceVisible: true },
    true,
  );
  const draftId = await service.createDraft(f.admin, f.projectId);
  let w = await service.workspace(f.admin, f.projectId);
  const draft = w.publications.find((p) => p.id === draftId);
  const raw = JSON.stringify(draft.snapshot);
  assert.equal(raw.includes("minimumPrice"), false);
  assert.equal(raw.includes("876543"), false);
  assert.equal(raw.includes("internalNotes"), false);
  assert.equal(raw.includes("sourceDocument"), false);
  assert.equal(raw.includes("email"), false);
  assert.equal(draft.snapshot.units[0].priceDisplay, "AUD $1,200,000");
  await assert.rejects(
    service.publish(f.admin, f.projectId, draftId),
    /approved/,
  );
  await assert.rejects(
    service.approve(f.admin, f.projectId, draftId, "wrong digest"),
    /Preview/,
  );
  await assert.rejects(
    service.approve(
      f.access("sales_manager"),
      f.projectId,
      draftId,
      draft.digest,
    ),
    /authorised/,
  );
  await service.approve(f.admin, f.projectId, draftId, draft.digest);
  await service.publish(f.admin, f.projectId, draftId);
  assert.deepEqual(
    (await service.publicInventory(f.projectId)).units,
    draft.snapshot.units,
  );
  await service.saveUnit(
    f.admin,
    f.projectId,
    { ...input(), bedrooms: "2", internalNotes: "PRIVATE" },
    id,
    3,
  );
  assert.equal(
    (await service.publicInventory(f.projectId)).units[0].bedrooms,
    4,
  );
  const newer = await service.createDraft(f.admin, f.projectId);
  w = await service.workspace(f.admin, f.projectId);
  await service.approve(
    f.admin,
    f.projectId,
    newer,
    w.publications.find((p) => p.id === newer).digest,
  );
  await service.publish(f.admin, f.projectId, newer);
  assert.equal(
    (await service.publicInventory(f.projectId)).units[0].bedrooms,
    2,
  );
  const restored = await service.createDraft(f.admin, f.projectId, draftId);
  w = await service.workspace(f.admin, f.projectId);
  await service.approve(
    f.admin,
    f.projectId,
    restored,
    w.publications.find((p) => p.id === restored).digest,
  );
  await service.publish(f.admin, f.projectId, restored);
  assert.equal(
    (await service.publicInventory(f.projectId)).units[0].bedrooms,
    4,
  );
  await assert.rejects(
    db
      .update(s.salesPublications)
      .set({ snapshot: { ...draft.snapshot, units: [] } })
      .where(eq(s.salesPublications.id, draftId)),
  );
});
test("failed publication audit rolls back pointer and lifecycle changes together", async () => {
  const f = await fixture();
  await unit(f);
  const draft = await service.createDraft(f.admin, f.projectId);
  const w = await service.workspace(f.admin, f.projectId);
  await service.approve(f.admin, f.projectId, draft, w.publications[0].digest);
  await pg.exec(
    `CREATE FUNCTION test_reject_publish() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='sales.publication.published' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER test_reject_publish BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_publish();`,
  );
  try {
    await assert.rejects(service.publish(f.admin, f.projectId, draft));
    assert.equal((await service.publicInventory(f.projectId)).revision, 0);
    assert.equal(
      (await service.workspace(f.admin, f.projectId)).publications[0].status,
      "approved",
    );
  } finally {
    await pg.exec(
      "DROP TRIGGER test_reject_publish ON audit_logs; DROP FUNCTION test_reject_publish();",
    );
  }
});
test("CRM ownership remains with developer; assigned agents cannot read or reassign other leads", async () => {
  const f = await fixture();
  const id = await service.createLead(f.admin, f.projectId, enquiry());
  await assert.rejects(
    service.leadActivity(f.agent, f.projectId, id),
    /accessible/,
  );
  assert.equal((await service.workspace(f.agent, f.projectId)).leads.length, 0);
  await service.updateLead(f.admin, f.projectId, id, 1, {
    status: "contact_attempted",
    assignedAgentId: f.agentId,
    note: "Isolated assignment",
  });
  assert.equal((await service.workspace(f.agent, f.projectId)).leads.length, 1);
  await service.updateLead(f.agent, f.projectId, id, 2, {
    status: "contacted",
    note: "Isolated phone interaction",
    followUpAt: "2026-11-03T12:00:00Z",
  });
  await assert.rejects(
    service.updateLead(f.agent, f.projectId, id, 3, {
      status: "qualified",
      assignedAgentId: f.outsiderId,
    }),
    /authorised/,
  );
  await service.updateLead(f.admin, f.projectId, id, 3, {
    status: "qualified",
    assignedAgentId: f.outsiderId,
  });
  await assert.rejects(
    service.leadActivity(f.agent, f.projectId, id),
    /accessible/,
  );
  assert.equal(
    (await service.leadActivity(f.admin, f.projectId, id)).length,
    4,
  );
  await assert.rejects(
    service.exportCsv(f.agent, f.projectId, "leads"),
    /authorised/,
  );
});
test("enquiry storage checks privacy, published unit IDs, consent, honeypot and persistent rate limits", async () => {
  const f = await fixture(),
    hash = "a".repeat(64);
  await assert.rejects(
    service.createLead(null, f.projectId, enquiry(), hash),
    /not enabled/,
  );
  await service.configure(f.admin, f.projectId, {
    publicKey: f.projectId,
    expectedUnits: "47",
    enquiriesEnabled: true,
    privacyVersion: "test-v1",
    privacyNotice: "Isolated automated test policy. ".repeat(15),
  });
  await assert.rejects(
    service.createLead(
      null,
      f.projectId,
      { ...enquiry(), consent: false },
      hash,
    ),
    /Consent/,
  );
  await assert.rejects(
    service.createLead(
      null,
      f.projectId,
      { ...enquiry(), website: "bot" },
      hash,
    ),
    /Consent/,
  );
  await assert.rejects(
    service.createLead(
      null,
      f.projectId,
      { ...enquiry(), privacyVersion: "stale" },
      hash,
    ),
    /privacy/,
  );
  const unpublished = await unit(f);
  await assert.rejects(
    service.createLead(
      null,
      f.projectId,
      { ...enquiry(), unitIds: [unpublished] },
      hash,
    ),
    /published/,
  );
  for (let i = 0; i < 5; i++)
    await service.createLead(null, f.projectId, enquiry(), hash);
  await assert.rejects(
    service.createLead(null, f.projectId, enquiry(), hash),
    /Too many/,
  );
  const rows = (await service.workspace(f.admin, f.projectId)).leads;
  assert.equal(rows.length, 5);
  assert.ok(
    rows.every(
      (l) =>
        l.source === "golfview" && l.marketingConsent === false && l.consentAt,
    ),
  );
});
test("migration is additive and public API has no direct internal record projection", () => {
  const sql = fs.readFileSync("drizzle/0005_sales_platform.sql", "utf8");
  assert.doesNotMatch(sql, /\bDROP\b|TRUNCATE|DELETE FROM/i);
  assert.doesNotMatch(
    sql,
    /ALTER TABLE "(?:users|projects|model_scenarios|website_revisions)"/i,
  );
  assert.match(sql, /sales_publication_immutable_payload/);
});

test('real public route handlers expose only approved snapshots and persist validated enquiries', async () => {
  const Module = require('node:module');
  const path = require('node:path');
  const originalResolve = Module._resolveFilename;
  const dbPath = require.resolve('../lib/sales/db.ts');
  const previousDbModule = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getSalesDb: () => db } };
  Module._resolveFilename = function(request, parent, ...rest) {
    return originalResolve.call(this, request.startsWith('@/') ? path.resolve(request.slice(2)) : request, parent, ...rest);
  };
  let GET, POST;
  try {
    ({ GET } = require('../app/api/public/v1/sales/[key]/route.ts'));
    ({ POST } = require('../app/api/public/v1/sales/[key]/enquiries/route.ts'));
  } finally { Module._resolveFilename = originalResolve; }
  const previousToken = process.env.GOLFVIEW_ENQUIRY_TOKEN;
  const token = 'isolated-test-ingestion-credential-0000000000';
  process.env.GOLFVIEW_ENQUIRY_TOKEN = token;
  try {
    const f=await fixture(); const id=await unit(f);
    await service.savePrices(f.admin,f.projectId,id,1,{minimumPrice:'345678.90'});
    const draft=await service.createDraft(f.admin,f.projectId);const workspace=await service.workspace(f.admin,f.projectId);
    await service.approve(f.admin,f.projectId,draft,workspace.publications[0].digest);await service.publish(f.admin,f.projectId,draft);
    await service.configure(f.admin,f.projectId,{publicKey:f.projectId,expectedUnits:'47',enquiriesEnabled:true,privacyVersion:'test-v1',privacyNotice:'Isolated route integration policy. '.repeat(15)});
    const params={params:Promise.resolve({key:f.projectId})};
    const response=await GET(new Request('https://test.invalid/api'),params);const payload=await response.json();
    assert.equal(response.status,200);assert.equal(payload.units.length,1);assert.equal(payload.revision,1);assert.doesNotMatch(JSON.stringify(payload),/345678|minimumPrice|internalNotes|email/);
    const send=(body,authorised=true)=>POST(new Request('https://test.invalid/api',{method:'POST',headers:{'content-type':'application/json',...(authorised?{authorization:`Bearer ${token}`} : {}),'x-enquiry-client':'b'.repeat(64)},body:JSON.stringify(body)}),params);
    assert.equal((await send(enquiry(),false)).status,403);
    assert.equal((await send({...enquiry(),consent:false})).status,400);
    assert.equal((await send({...enquiry(),unitIds:[id]})).status,201);
    const stored=(await service.workspace(f.admin,f.projectId)).leads;assert.equal(stored.length,1);assert.equal(stored[0].source,'golfview');assert.deepEqual(stored[0].unitIds,[id]);
  } finally {
    if(previousToken===undefined)delete process.env.GOLFVIEW_ENQUIRY_TOKEN;else process.env.GOLFVIEW_ENQUIRY_TOKEN=previousToken;
    if(previousDbModule)require.cache[dbPath]=previousDbModule;else delete require.cache[dbPath];
  }
});

test('database constraints independently reject invalid areas and cross-project stages', async () => {
  const f=await fixture(), other=await fixture();
  await service.saveStage(other.admin,other.projectId,{kind:'construction',code:'X',name:'Isolated foreign stage'});
  const stage=(await service.workspace(other.admin,other.projectId)).construction[0];
  await assert.rejects(db.insert(s.salesUnits).values({...input(),projectId:f.projectId,updatedByUserId:f.userId,landAreaSqm:'-1.00'}));
  await assert.rejects(db.insert(s.salesUnits).values({...input(),projectId:f.projectId,updatedByUserId:f.userId,constructionStageId:stage.id}));
  assert.equal((await service.workspace(f.admin,f.projectId)).units.length,0);
});

test('concurrent writers cannot silently overwrite a unit revision', async () => {
  const f=await fixture(), id=await unit(f);
  const results=await Promise.allSettled([
    service.saveUnit(f.admin,f.projectId,{...input(),bedrooms:'3'},id,1),
    service.saveUnit(f.admin,f.projectId,{...input(),bedrooms:'2'},id,1),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await current(id)).revision,2);
  assert.ok((await current(id)).validationWarnings.length>0);
});

test('Sydney follow-ups and payment dates do not depend on server time zone', () => {
  assert.equal(domain.dateOrNull('2026-01-15T09:30').toISOString(), '2026-01-14T22:30:00.000Z');
  assert.equal(domain.dateOrNull('2026-07-15T09:30').toISOString(), '2026-07-14T23:30:00.000Z');
  assert.equal(salesDateInput('2026-01-14T22:30:17.123Z'), '2026-01-15T09:30');
  assert.equal(domain.dateOrNull('2026-04-05T02:30:00+10:00').toISOString(), '2026-04-04T16:30:00.000Z');
  assert.throws(() => domain.dateOrNull('2026-10-04T02:30'), /daylight saving/);
  assert.throws(() => domain.dateOrNull('2026-04-05T02:30'), /daylight saving/);
  assert.throws(() => domain.dateOrNull('2026-02-30T09:30'), /Invalid date/);
  assert.throws(() => domain.dateOrNull('2026-02-30T09:30:00Z'), /Invalid date/);
  assert.equal(domain.dateOrNull(''), null);
});
test('saving a newly created stage again edits the same register entry', async () => {
  const f=await fixture();
  const id=await service.saveStage(f.admin,f.projectId,{kind:'construction',code:'C1',name:'Isolated stage',sequence:'1'});
  assert.ok(domain.validId(id));
  assert.equal(await service.saveStage(f.admin,f.projectId,{id,kind:'construction',code:'C1',name:'Isolated revised stage',sequence:'2'}),id);
  const w=await service.workspace(f.admin,f.projectId);
  assert.equal(w.construction.length,1);
  assert.equal(w.construction[0].name,'Isolated revised stage');
  assert.equal(w.construction[0].sequence,2);
});
test('Sydney CRM follow-up persists the intended instant and can be cleared', async () => {
  const f=await fixture();const id=await service.createLead(f.admin,f.projectId,enquiry());
  await service.updateLead(f.admin,f.projectId,id,1,{status:'contacted',followUpAt:'2026-11-03T09:15'});
  assert.equal((await service.workspace(f.admin,f.projectId)).leads[0].followUpAt.toISOString(),'2026-11-02T22:15:00.000Z');
  await service.updateLead(f.admin,f.projectId,id,2,{status:'qualified',followUpAt:''});
  assert.equal((await service.workspace(f.admin,f.projectId)).leads[0].followUpAt,null);
});
test('status choices offer only server-valid transitions and none after settlement', () => {
  assert.deepEqual(domain.nextUnitStatuses('settled'),[]);
  assert.deepEqual(domain.nextUnitStatuses('available'),['on_hold','reserved','withdrawn']);
  assert.ok(!domain.nextUnitStatuses('not_released').includes('settled'));
});

test('sales selection defaults to Golfview while explicit inaccessible projects fail closed', () => {
  const {chooseSalesProject,salesProjectName} = require('../lib/sales/projects.ts');
  const future={id:'future',name:'Future development',slug:'future-development'};
  const legacy={id:'legacy',name:'700 Project',slug:'700-project'};
  assert.equal(chooseSalesProject([future,legacy]).id,'legacy');
  assert.equal(salesProjectName(legacy),'Golfview');
  assert.equal(legacy.name,'700 Project'); // no master-record rename or UUID change
  assert.equal(chooseSalesProject([future,legacy],'future').id,'future');
  assert.equal(chooseSalesProject([future],'legacy'),undefined);
  assert.equal(chooseSalesProject([]),undefined);
  assert.equal(salesProjectName(future),'Future development');
});

test('working inventory refresh changes map source but cannot silently mutate the live snapshot', async () => {
  const f=await fixture();const id=await unit(f,'MAPPED-01');
  await service.changeStatus(f.admin,f.projectId,id,1,'available','Isolated initial release');
  const draft=await service.createDraft(f.admin,f.projectId);
  let w=await service.workspace(f.admin,f.projectId);
  await service.approve(f.admin,f.projectId,draft,w.publications[0].digest);
  await service.publish(f.admin,f.projectId,draft);
  const before=await service.publicInventory(f.projectId);
  await service.changeStatus(f.admin,f.projectId,id,2,'reserved','Isolated reservation');
  let row=await current(id);
  await service.saveUnit(f.admin,f.projectId,{...row,publicVisible:false},id,row.revision);
  w=await service.workspace(f.admin,f.projectId);
  assert.equal(w.units.find(u=>u.id===id).status,'reserved');
  assert.equal(w.units.find(u=>u.id===id).publicVisible,false);
  assert.deepEqual((await service.publicInventory(f.projectId)).units,before.units);
  assert.ok(w.publicData.units.some(u=>u.id===id));
  const agent=await service.workspace(f.agent,f.projectId);
  assert.deepEqual(agent.units,[]);assert.deepEqual(agent.prices,[]);
});

test('draft map requires Golfview membership, intersected sales permissions and internal access', () => {
  const {canReviewSalesMap}=require('../lib/sales/projects.ts');
  const project={id:'golfview-id',name:'700 Project',slug:'700-project',membershipRole:'management',canManage:true};
  const a={userId:'local',role:'management',roles:['management'],projects:[project]};
  assert.equal(canReviewSalesMap(a,project.id),true);
  assert.equal(canReviewSalesMap(a,'another-project'),false);
  assert.equal(canReviewSalesMap({...a,projects:[{...project,slug:'future',name:'Future'}]},project.id),false);
  assert.equal(canReviewSalesMap({...a,role:'external_agent',roles:['external_agent']},project.id),false);
  assert.equal(canReviewSalesMap({...a,projects:[{...project,membershipRole:'external_agent'}]},project.id),false);
  assert.equal(canReviewSalesMap({...a,projects:[{...project,membershipRole:'unknown'}]},project.id),false);
});

test('design conflict imports privately but cannot enter a publication draft', async () => {
  const f=await fixture();
  const source='Owner CSV; DESIGN CONFLICT: architect/owner confirmation required';
  const csv=`number,housingType,sourceDocument\n1,A-1C,${source}`;
  await service.importInventory(f.admin,f.projectId,csv,false);
  await service.importInventory(f.admin,f.projectId,csv,true);
  const w=await service.workspace(f.admin,f.projectId),u=w.units[0];
  assert.equal(u.housingType,'A-1C');assert.equal(u.publicVisible,false);
  assert.ok(u.validationWarnings.some(x=>x.includes('DESIGN CONFLICT')));
  await assert.rejects(service.saveUnit(f.admin,f.projectId,{...u,publicVisible:true},u.id,u.revision),/DESIGN CONFLICT/);
  assert.throws(()=>domain.makeSnapshot('golfview',1,[{...u,publicVisible:true}]),/DESIGN CONFLICT/);
  assert.deepEqual(domain.makeSnapshot('golfview',1,[u]).units,[]);
});

test('inventory sorting handles exact decimals, nulls-last and natural stable ties without mutating rows', () => {
 const {sortInventory}=require('../lib/sales/inventory-sort.ts');
 const row=(number,patch={})=>({id:number,number,status:'available',releaseStageId:null,housingType:null,bedrooms:null,bathrooms:null,carSpaces:null,buildingAreaSqm:null,landAreaSqm:null,publicAskingPrice:null,features:[],...patch});
 const rows=[row('10',{bedrooms:3,buildingAreaSqm:'9.00',landAreaSqm:'100.00'}),row('2',{bedrooms:4,buildingAreaSqm:'100.00',landAreaSqm:'9.00'}),row('1',{bedrooms:2}),row('3',{bedrooms:4,buildingAreaSqm:'100.00'})];
 const order=(key,direction='asc',stages=[],prices=[])=>sortInventory(rows,{key,direction},stages,prices).map(u=>u.number);
 assert.deepEqual(order('number'),['1','2','3','10']);assert.deepEqual(order('number','desc'),['10','3','2','1']);
 assert.deepEqual(order('bedrooms','desc'),['2','3','10','1']);
 assert.deepEqual(order('buildingAreaSqm'),['10','2','3','1']);assert.deepEqual(order('buildingAreaSqm','desc'),['2','3','10','1']);
 assert.deepEqual(order('landAreaSqm'),['2','10','1','3']);
 const prices=[{unitId:'2',askingPrice:'999999999999.98',contractPrice:'100.00'},{unitId:'10',askingPrice:'999999999999.99',contractPrice:'9.00'}];
 assert.deepEqual(order('internalPrice','desc',[],prices),['10','2','1','3']);assert.deepEqual(order('contractPrice','asc',[],prices),['10','2','1','3']);
 assert.deepEqual(rows.map(r=>r.number),['10','2','1','3']);
});
test('inventory sorting uses business status and release sequence, plus all independent attributes',()=>{
 const {sortInventory}=require('../lib/sales/inventory-sort.ts');
 const base={status:'available',releaseStageId:null,housingType:'A2',bedrooms:3,bathrooms:2,carSpaces:1,buildingAreaSqm:'100.00',landAreaSqm:'90.00',publicAskingPrice:'100000.00',features:['Garden']};
 const rows=[{...base,id:'1',number:'1',status:'settled',releaseStageId:'early',housingType:'A10',bathrooms:3,carSpaces:2,publicAskingPrice:'90000.00',features:[]},{...base,id:'2',number:'2',releaseStageId:'late'}];
 const sort=(key,direction='asc')=>sortInventory(rows,{key,direction},[{id:'late',sequence:10},{id:'early',sequence:2}],[]).map(u=>u.number);
 for(const key of ['status','housingType','bathrooms','carSpaces','features'])assert.deepEqual(sort(key),['2','1']);
 assert.deepEqual(sort('releaseStageId'),['1','2']);assert.deepEqual(sort('releaseStageId','desc'),['2','1']);assert.deepEqual(sort('advertisingPrice'),['1','2']);
});

test('asking, advertising and contract prices stay independent and contract price cannot enter ordinary exports or snapshots',async()=>{
 const f=await fixture(),id=await unit(f,'PRICES-INDEPENDENT');
 await service.savePrices(f.admin,f.projectId,id,1,{askingPrice:'1100001.11'});
 let w=await service.workspace(f.admin,f.projectId);assert.equal(w.prices[0].contractPrice,null);assert.equal(w.units[0].publicAskingPrice,null);
 await service.savePrices(f.admin,f.projectId,id,2,{publicAskingPrice:'1200002.22',publicPriceVisible:true},true);
 w=await service.workspace(f.admin,f.projectId);assert.equal(w.prices[0].askingPrice,'1100001.11');assert.equal(w.prices[0].contractPrice,null);
 await service.savePrices(f.admin,f.projectId,id,3,{askingPrice:'1100001.11',contractPrice:'1000003.33'});
 const draft=await service.createDraft(f.admin,f.projectId);w=await service.workspace(f.admin,f.projectId);
 const snapshot=JSON.stringify(w.publications.find(p=>p.id===draft).snapshot);assert.ok(!snapshot.includes('1000003.33'));assert.ok(!snapshot.includes('1100001.11'));
 const exported=await service.exportCsv(f.admin,f.projectId,'inventory');assert.ok(!exported.includes('1000003.33'));assert.ok(!exported.includes('contractPrice'));assert.ok(!exported.includes('contract_price'));
 await assert.rejects(service.exportCsv(f.access('sales_manager'),f.projectId,'prices'),/authorised/);
});

test('residence activity enforces audit permission, exact project scope and no other residence history',async()=>{
 const f=await fixture(),a=await unit(f,'AUDIT-1'),b=await unit(f,'AUDIT-2');
 const events=await service.unitActivity(f.admin,f.projectId,a);assert.equal(events.length,1);assert.ok(events.every(e=>e.unitId===a && e.unitId!==b));
 await assert.rejects(service.unitActivity(f.access('sales_manager'),f.projectId,a),/authorised/);
 const other=await fixture();await assert.rejects(service.unitActivity(other.admin,other.projectId,a),/not found/);
});

const {createLifecycleService,lifecycleEnabled}=require('../lib/sales/lifecycle-service.ts');
const lifecycleDomain=require('../lib/sales/lifecycle-domain.ts');
async function lifecycleFixture(){const f=await fixture();const unitId=await service.saveUnit(f.admin,f.projectId,{...input('LIFE-1'),publicVisible:false});const leadId=await service.createLead(f.admin,f.projectId,enquiry());const lead2=await service.createLead(f.admin,f.projectId,{...enquiry(),name:'Second isolated buyer',email:'second@example.invalid'});return {...f,unitId,leadId,lead2,life:createLifecycleService(db)};}
const baseOffer=f=>({unitId:f.unitId,leadId:f.leadId,amount:'900123.45',offeredAt:'2026-10-01T09:00:00Z',notes:'Isolated lifecycle test'});
const transition=(revision,status,extra={})=>({revision,status,confirm:true,reason:'Isolated authorised test',...extra});
test('lifecycle is disabled by default and requires explicit project activation',()=>{
 const before=process.env.SALES_LIFECYCLE_ENABLED,projects=process.env.SALES_LIFECYCLE_PROJECT_IDS;
 try{delete process.env.SALES_LIFECYCLE_ENABLED;delete process.env.SALES_LIFECYCLE_PROJECT_IDS;assert.equal(lifecycleEnabled('x'),false);process.env.SALES_LIFECYCLE_ENABLED='true';assert.equal(lifecycleEnabled('x'),false);process.env.SALES_LIFECYCLE_PROJECT_IDS='x';assert.equal(lifecycleEnabled('x'),true);assert.equal(lifecycleEnabled('y'),false);}finally{if(before===undefined)delete process.env.SALES_LIFECYCLE_ENABLED;else process.env.SALES_LIFECYCLE_ENABLED=before;if(projects===undefined)delete process.env.SALES_LIFECYCLE_PROJECT_IDS;else process.env.SALES_LIFECYCLE_PROJECT_IDS=projects;}
});
test('multiple offers preserve history; acceptance requires management confirmation and never sells inventory',async()=>{
 const f=await lifecycleFixture();const first=await f.life.save(f.admin,f.projectId,'offer',baseOffer(f));const second=await f.life.save(f.admin,f.projectId,'offer',{...baseOffer(f),leadId:f.lead2,amount:'910111.22'});
 await f.life.transition(f.admin,f.projectId,'offer',first,transition(1,'submitted'));
 await assert.rejects(f.life.transition(f.access('sales_manager'),f.projectId,'offer',first,transition(2,'accepted')),/authorised/);
 await assert.rejects(f.life.transition(f.admin,f.projectId,'offer',first,{revision:2,status:'accepted',reason:'No confirmation'}),/confirmation/);
 await f.life.transition(f.admin,f.projectId,'offer',first,transition(2,'accepted'));assert.equal((await current(f.unitId)).status,'not_released');assert.equal((await f.life.workspace(f.admin,f.projectId)).offers.length,2);
 await f.life.transition(f.admin,f.projectId,'offer',second,transition(1,'submitted'));await f.life.transition(f.admin,f.projectId,'offer',second,transition(2,'rejected'));
 assert.equal((await service.publicInventory(f.projectId)).units.length,0);
});
test('reservation conflicts, explicit expiry, cancellation and inventory synchronisation are atomic',async()=>{
 const f=await lifecycleFixture();await service.changeStatus(f.admin,f.projectId,f.unitId,1,'available','Isolated release');
 const a=await f.life.save(f.admin,f.projectId,'reservation',{unitId:f.unitId,leadId:f.leadId,startsAt:'2026-10-01T09:00:00Z'});
 const b=await f.life.save(f.admin,f.projectId,'reservation',{unitId:f.unitId,leadId:f.lead2,startsAt:'2026-10-01T09:00:00Z',expiresAt:'2026-10-02T09:00:00Z'});
 await f.life.transition(f.admin,f.projectId,'reservation',a,transition(1,'active',{syncInventory:true,unitRevision:2}));assert.equal((await current(f.unitId)).status,'reserved');
 await assert.rejects(f.life.transition(f.admin,f.projectId,'reservation',b,transition(1,'active')),/Conflicting/);
 await f.life.transition(f.admin,f.projectId,'reservation',a,transition(2,'cancelled'));assert.equal((await current(f.unitId)).status,'reserved');
 await f.life.transition(f.admin,f.projectId,'reservation',b,transition(1,'active'));const w=await f.life.workspace(f.admin,f.projectId);assert.equal(w.reservations.find(r=>r.id===a).expiresAt,null);assert.equal(w.reservations.find(r=>r.id===b).status,'active');
});
test('contracts require entered evidence and price; signing preserves asking price and cash is separate',async()=>{
 const f=await lifecycleFixture();await service.savePrices(f.admin,f.projectId,f.unitId,1,{askingPrice:'1234567.89',minimumPrice:'1000000.00'});
 const c=await f.life.save(f.admin,f.projectId,'contract',{unitId:f.unitId,leadId:f.leadId});
 await assert.rejects(f.life.transition(f.admin,f.projectId,'contract',c,transition(1,'signed',{unitRevision:2})),/explicit agreed price/);
 await f.life.save(f.admin,f.projectId,'contract',{id:c,revision:1,unitId:f.unitId,leadId:f.leadId,contractDate:'2026-10-01T09:00:00Z',contractPrice:'900123.45',depositAmount:'90000.00',documentReference:'Private contract reference, isolated test',expectedSettlementAt:'2026-10-20T09:00:00Z'});
 await f.life.transition(f.admin,f.projectId,'contract',c,transition(2,'signed',{unitRevision:2}));
 const w=await service.workspace(f.admin,f.projectId);assert.equal(w.prices[0].askingPrice,'1234567.89');assert.equal(w.prices[0].minimumPrice,'1000000.00');assert.equal(w.prices[0].contractPrice,'900123.45');assert.equal((await current(f.unitId)).status,'not_released');
 const privateData=await f.life.workspace(f.admin,f.projectId),redacted=await f.life.workspace(f.access('sales_manager'),f.projectId);assert.equal(redacted.contracts[0].contractPrice,null);assert.ok(!JSON.stringify(redacted).includes('900123.45'));
 const summary=lifecycleDomain.settlementSummary(privateData.contracts,new Date('2026-10-31T00:00:00Z'));assert.equal(summary.contracted,'900123.45');assert.equal(summary.confirmedReceipts,'0.00');assert.equal(summary.overdueSettlements,1);
 await f.life.receipt(f.admin,f.projectId,c,{revision:3,kind:'deposit',amount:'90000.00',receivedAt:'2026-10-02T09:00:00Z',receiptReference:'Private deposit receipt',confirm:true});
 let cash=await f.life.workspace(f.admin,f.projectId);assert.equal(lifecycleDomain.settlementSummary(cash.contracts).confirmedReceipts,'90000.00');
 await assert.rejects(f.life.receipt(f.admin,f.projectId,c,{revision:4,kind:'settlement',amount:'900123.45',receivedAt:'2026-10-20T09:00:00Z',receiptReference:'Too much',confirm:true}),/exceed/);
 await f.life.receipt(f.admin,f.projectId,c,{revision:4,kind:'settlement',amount:'810123.45',receivedAt:'2026-10-20T09:00:00Z',receiptReference:'Private balance receipt',confirm:true});
 await f.life.transition(f.admin,f.projectId,'contract',c,transition(5,'unconditional'));await assert.rejects(f.life.transition(f.admin,f.projectId,'contract',c,transition(6,'completed')),/Actual settlement date/);
 await f.life.transition(f.admin,f.projectId,'contract',c,transition(6,'completed',{actualSettlementAt:'2026-10-20T09:00:00Z'}));cash=await f.life.workspace(f.admin,f.projectId);assert.equal(lifecycleDomain.settlementSummary(cash.contracts).outstandingContractBalance,'0.00');assert.equal(lifecycleDomain.settlementSummary(cash.contracts).completed,1);
 assert.ok(!(await service.exportCsv(f.admin,f.projectId,'inventory')).includes('900123.45'));assert.equal((await service.publicInventory(f.projectId)).units.length,0);
});
test('lifecycle project scope, external agents, revisions and private audit channels cannot be bypassed',async()=>{
 const f=await lifecycleFixture(),other=await lifecycleFixture();const id=await f.life.save(f.admin,f.projectId,'offer',baseOffer(f));
 await assert.rejects(f.life.workspace(f.agent,f.projectId),/authorised/);await assert.rejects(f.life.save(f.agent,f.projectId,'offer',baseOffer(f)),/authorised/);
 await assert.rejects(f.life.save(f.admin,f.projectId,'offer',{...baseOffer(f),unitId:other.unitId}),/belong/);
 await assert.rejects(f.life.transition(other.admin,other.projectId,'offer',id,transition(1,'submitted')),/not found/);
 await f.life.transition(f.admin,f.projectId,'offer',id,transition(1,'submitted'));await assert.rejects(f.life.transition(f.admin,f.projectId,'offer',id,transition(1,'accepted')),/changed/);
 await service.updateLead(f.admin,f.projectId,f.leadId,1,{status:'contacted',assignedAgentId:f.agentId});const history=await service.leadActivity(f.agent,f.projectId,f.leadId);assert.ok(history.every(e=>!e.action.startsWith('lifecycle.')));
 const logs=(await db.select().from(s.auditLogs)).filter(l=>l.action.startsWith('sales.lifecycle.'));assert.ok(logs.length>0);assert.ok(logs.every(l=>!JSON.stringify(l.metadata).includes('900123.45')));
});
test('buyer preferences and policy proposals are explicit, revisioned and never enable automatic rules',async()=>{
 const f=await lifecycleFixture();await f.life.buyerProfile(f.admin,f.projectId,{leadId:f.leadId,revision:0,preferredBedrooms:'4',budgetMin:'800000.00',budgetMax:'1000000.00',nextAction:'Owner-supplied next action'});
 await assert.rejects(f.life.buyerProfile(f.admin,f.projectId,{leadId:f.leadId,revision:0,nextAction:'Stale'}),/changed/);
 await assert.rejects(f.life.buyerProfile(f.admin,f.projectId,{leadId:f.leadId,revision:1,budgetMin:'2.00',budgetMax:'1.00'}),/reversed/);
 await f.life.policy(f.admin,f.projectId,{});let w=await f.life.workspace(f.admin,f.projectId);assert.equal(w.settings.proposedDurationHours,null);assert.equal(w.settings.proposedReservationFee,null);assert.equal(w.settings.automationEnabled,false);assert.equal(w.profiles[0].preferredBedrooms,4);
 await assert.rejects(f.life.policy(f.admin,f.projectId,{automationEnabled:true}),/not approved/);
});

test('cancelled contracts retain confirmed cash evidence and never imply refunds',()=>{
 const c={status:'cancelled',contractPrice:'100000.00',depositAmount:'10000.00',depositReceivedAmount:'10000.00',settlementReceivedAmount:null,expectedSettlementAt:null,actualSettlementAt:null};
 const r=lifecycleDomain.settlementSummary([c]);assert.equal(r.contracted,'0.00');assert.equal(r.confirmedReceipts,'10000.00');assert.equal(r.cancelledContractReceipts,'10000.00');assert.equal(r.outstandingContractBalance,'0.00');
});
test('0006 is additive and preserves a populated legacy 47-unit inventory including private asking prices',async()=>{
 const local=new PGlite();await local.waitReady;try{
 const journal=JSON.parse(fs.readFileSync('drizzle/meta/_journal.json','utf8'));for(const e of journal.entries.filter(e=>e.idx<6))await local.exec(fs.readFileSync(`drizzle/${e.tag}.sql`,'utf8'));
 const p=randomUUID(),u=randomUUID();await local.query('insert into users(id,email) values($1,$2)',[u,'migration-only@example.invalid']);await local.query('insert into projects(id,name,slug) values($1,$2,$3)',[p,'Migration fixture',p]);
 for(let n=1;n<=47;n++){const id=randomUUID();await local.query('insert into sales_units(id,project_id,number,source_document,updated_by_user_id) values($1,$2,$3,$4,$5)',[id,p,String(n),'Isolated migration preservation',u]);await local.query('insert into sales_private_prices(unit_id,asking_price) values($1,$2)',[id,'1234567.89']);}
 const hash=async()=>JSON.stringify((await local.query('select to_jsonb(u) as unit,to_jsonb(p) as price from sales_units u join sales_private_prices p on p.unit_id=u.id order by u.id')).rows);
 const before=await hash();await local.exec(fs.readFileSync('drizzle/0006_sales_lifecycle.sql','utf8'));assert.equal(await hash(),before);
 for(const name of ['sales_offers','sales_reservations','sales_contracts','sales_buyer_profiles','sales_lifecycle_settings'])assert.equal((await local.query(`select count(*)::int as n from ${name}`)).rows[0].n,0);
 }finally{await local.close();}
});

test('default-off server action rejects lifecycle writes before opening a production database',async()=>{
 const Module=require('node:module'),file=require('node:path').resolve('lib/sales/actions.ts'),f=await fixture();const m=new Module(file,module);m.filename=file;m.paths=module.paths;const normal=m.require.bind(m);let queries=0;
 m.require=(id)=>id==='../auth/guards'?{requirePortalAccess:async()=>f.admin}:id==='./db'?{getSalesDb:()=>{queries++;throw Error('Must not open a production connection')}}:id==='next/cache'?{revalidatePath:()=>{}}:normal(id);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;m._compile(code,file);
 const before=process.env.SALES_LIFECYCLE_ENABLED;try{delete process.env.SALES_LIFECYCLE_ENABLED;const result=await m.exports.salesAction(f.projectId,'lifecycle.save',{kind:'offer',...baseOffer(f)});assert.equal(result.ok,false);assert.match(result.error,/not activated/);assert.equal(queries,0);}finally{if(before===undefined)delete process.env.SALES_LIFECYCLE_ENABLED;else process.env.SALES_LIFECYCLE_ENABLED=before;}
});
test('invalid inventory synchronization rolls back contract signature, private prices, revisions and audit together',async()=>{
 const f=await lifecycleFixture();await service.savePrices(f.admin,f.projectId,f.unitId,1,{askingPrice:'1100000.00'});const c=await f.life.save(f.admin,f.projectId,'contract',{unitId:f.unitId,leadId:f.leadId,contractPrice:'900000.00',contractDate:'2026-10-01T09:00:00Z',documentReference:'Isolated document'});
 await assert.rejects(f.life.transition(f.admin,f.projectId,'contract',c,transition(1,'signed',{unitRevision:2,syncInventory:true})),/transition/);
 const w=await service.workspace(f.admin,f.projectId),l=await f.life.workspace(f.admin,f.projectId);assert.equal(w.prices[0].contractPrice,null);assert.equal(w.prices[0].askingPrice,'1100000.00');assert.equal(w.units[0].revision,2);assert.equal(w.units[0].status,'not_released');assert.equal(l.contracts[0].status,'draft');assert.equal(l.contracts[0].revision,1);assert.ok(!l.history.some(e=>e.action==='lifecycle.contract.status'));
});
