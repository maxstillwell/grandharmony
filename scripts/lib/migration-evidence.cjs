const fs = require('node:fs');
const crypto = require('node:crypto');

function expectedObjects(source) {
  const tables=[], columns=[], indexes=[], constraints=[], triggers=[], enums=[];
  for (const statement of source.split('--> statement-breakpoint')) {
    const table=statement.match(/CREATE TABLE "([^"]+)"\s*\(([\s\S]*?)\n\);/i);
    if(table){ tables.push(table[1]);for(const match of table[2].matchAll(/^\s*"([^"]+)"\s+/gm))columns.push(`${table[1]}.${match[1]}`); }
    for(const match of statement.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/g))columns.push(`${match[1]}.${match[2]}`);
    for(const match of statement.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g))indexes.push(match[1]);
    for(const match of statement.matchAll(/CONSTRAINT "([^"]+)"/g))constraints.push(match[1].slice(0,63));
    for(const match of statement.matchAll(/CREATE TRIGGER\s+([a-z0-9_]+)/gi))triggers.push(match[1]);
    for(const match of statement.matchAll(/CREATE TYPE "public"\."([^"]+)" AS ENUM/g))enums.push(match[1]);
  }
  return {tables,columns,indexes,constraints,triggers,enums};
}
function migrationEvidence(observed, directory='drizzle') {
  const journal=JSON.parse(fs.readFileSync(`${directory}/meta/_journal.json`,'utf8'));
  const sets={tables:new Set(observed.tables.filter(t=>t.table_schema==='public').map(t=>t.table_name)),columns:new Set(observed.columns.map(c=>`${c.table_name}.${c.column_name}`)),indexes:new Set(observed.indexes.map(i=>i.indexname)),constraints:new Set(observed.constraints.map(c=>c.conname)),triggers:new Set(observed.triggers.map(t=>t.tgname)),enums:new Set(observed.enums.map(e=>e.typname))};
  const applied=observed.applied??[];
  const migrations=journal.entries.map(entry=>{
    const source=fs.readFileSync(`${directory}/${entry.tag}.sql`,'utf8');
    const hash=crypto.createHash('sha256').update(source).digest('hex');const expected=expectedObjects(source);
    const missing=Object.fromEntries(Object.entries(expected).map(([kind,names])=>[kind,names.filter(name=>!sets[kind].has(name))]));
    const present=Object.values(expected).flat().length-Object.values(missing).flat().length;
    const missingCount=Object.values(missing).flat().length;
    const recordedApplied=applied.some(row=>row.hash===hash);
    const crlfHash=crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')).digest('hex');
    const equivalent=!recordedApplied&&applied.some(row=>row.hash===crlfHash&&String(row.created_at)===String(entry.when));
    const state=recordedApplied||equivalent?(missingCount?'journal-schema-mismatch':equivalent?'recorded-equivalent-line-endings':'recorded-and-observed'):(present?'objects-without-matching-journal':'not-applied');
    return {tag:entry.tag,sha256:hash,recordedApplied,recordedHash:recordedApplied?hash:equivalent?crlfHash:null,lineEndingEquivalent:equivalent,state,missing};
  });
  return {migrations,unknownJournalHashes:applied.filter(row=>!migrations.some(m=>m.recordedHash===row.hash)).map(row=>row.hash),baselineConsistent:migrations.filter(m=>!m.tag.startsWith('0005')).every(m=>['recorded-and-observed','recorded-equivalent-line-endings'].includes(m.state))};
}
module.exports={expectedObjects,migrationEvidence};
