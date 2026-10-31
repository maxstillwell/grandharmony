// Read-only preflight; never applies, repairs or marks a migration as applied.
const fs = require('node:fs');
const { neon } = require('@neondatabase/serverless');
const { migrationEvidence } = require('./lib/migration-evidence.cjs');

const metadataQueries = {
  runtime: "select current_database() as database, current_setting('transaction_read_only') as read_only, current_setting('server_version') as postgres_version",
  tables: "select table_schema, table_name from information_schema.tables where table_schema in ('public','drizzle') order by table_schema, table_name",
  columns: "select table_name, column_name, data_type, udt_name, is_nullable from information_schema.columns where table_schema='public' order by table_name, ordinal_position",
  indexes: "select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by indexname",
  constraints: "select c.conname, c.contype, t.relname as table_name, pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' order by c.conname",
  triggers: "select t.tgname, c.relname as table_name, pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by t.tgname",
  enums: "select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype='e' and n.nspname='public' order by t.typname",
};
async function inspect(sql) {
  const names=Object.keys(metadataQueries);
  const rows=await sql.transaction(names.map(key=>sql.query(metadataQueries[key])),{readOnly:true,isolationLevel:'RepeatableRead'});
  const observed=Object.fromEntries(names.map((name,i)=>[name,rows[i]]));
  const hasJournal=observed.tables.some(t=>t.table_schema==='drizzle'&&t.table_name==='__drizzle_migrations');
  observed.applied=hasJournal?(await sql.transaction([sql.query('select hash, created_at from drizzle.__drizzle_migrations order by created_at')],{readOnly:true}))[0]:[];
  return observed;
}
async function main() {
  const fileIndex=process.argv.indexOf('--evidence-file');
  let observed,source,endpoint;
  if(fileIndex>=0){observed=JSON.parse(fs.readFileSync(process.argv[fileIndex+1],'utf8'));source='captured-Neon-read-only-evidence';}
  else {
    const url=process.env.DATABASE_URL??process.env.GH_DATABASE_URL;
    if(!url){console.log(JSON.stringify({verified:false,blocker:'DATABASE_URL/GH_DATABASE_URL unavailable; no live query was made.'}));process.exitCode=2;return;}
    const parsed=new URL(url);endpoint=parsed.hostname;source='live-Neon-HTTP-read-only-transactions';
    observed=await inspect(neon(url));
  }
  if(observed.runtime[0]?.read_only!=='on')throw new Error('Read-only transaction evidence is missing.');
  const report={verified:true,source,endpoint,observedAt:new Date().toISOString(),runtime:observed.runtime[0],...migrationEvidence(observed),observedTables:observed.tables};
  if(process.env.DB_STATUS_FULL==='true')report.schema=observed;
  console.log(JSON.stringify(report,null,process.env.DB_STATUS_FORMAT==='compact'?0:2));
}
if(require.main===module)main().catch(()=>{console.error('Read-only preflight failed; credentials and SQL parameter values were not logged. No migration was applied.');process.exitCode=1;});
module.exports={metadataQueries,inspect};
