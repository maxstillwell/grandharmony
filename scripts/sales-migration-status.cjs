// Read-only preflight. This command never applies or repairs migrations.
const fs = require("node:fs");
const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
async function main() {
  const url = process.env.DATABASE_URL ?? process.env.GH_DATABASE_URL;
  if (!url) {
    console.log(
      JSON.stringify(
        {
          verified: false,
          blocker:
            "DATABASE_URL/GH_DATABASE_URL unavailable; live schema and migration 0004 remain unverified.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }
  const sql = neon(url);
  const tables =
    await sql`select table_schema, table_name from information_schema.tables where table_schema in ('public','drizzle') order by table_schema, table_name`;
  const hasJournal = tables.some(
    (t) =>
      t.table_schema === "drizzle" && t.table_name === "__drizzle_migrations",
  );
  const applied = hasJournal
    ? await sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`
    : [];
  const journal = JSON.parse(
    fs.readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  const migrations = journal.entries.map((entry) => {
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(`drizzle/${entry.tag}.sql`))
      .digest("hex");
    return {
      tag: entry.tag,
      sha256: hash,
      recordedApplied: applied.some((row) => row.hash === hash),
    };
  });
  const columns =
    await sql`select table_name, column_name, data_type from information_schema.columns where table_schema='public' and (table_name like 'sales_%' or table_name in ('scenario_share_links','scenario_share_sessions')) order by table_name, ordinal_position`;
  console.log(
    JSON.stringify(
      {
        verified: true,
        journalPresent: hasJournal,
        migrations,
        observedTables: tables,
        observedColumns: columns,
        note: "Review discrepancies manually; presence of a SQL file or table is not proof that its entire migration was applied.",
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error(
    "Read-only migration preflight failed. Check connection access; no migration was applied.",
  );
  process.exitCode = 1;
});
