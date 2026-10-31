const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {migrationEvidence}=require('../scripts/lib/migration-evidence.cjs');
test('read-only preflight recognises historical CRLF hashes without rewriting migration records',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gh-migration-evidence-'));
 try{
  fs.mkdirSync(path.join(dir,'meta'));const source='CREATE TABLE "example" (\n "id" uuid\n);\n';fs.writeFileSync(path.join(dir,'0000_example.sql'),source);fs.writeFileSync(path.join(dir,'meta/_journal.json'),JSON.stringify({entries:[{tag:'0000_example',when:100}]}));
  const hash=crypto.createHash('sha256').update(source.replace(/\n/g,'\r\n')).digest('hex');
  const observed={tables:[{table_schema:'public',table_name:'example'}],columns:[{table_name:'example',column_name:'id'}],indexes:[],constraints:[],triggers:[],enums:[],applied:[{hash,created_at:'100'}]};
  const report=migrationEvidence(observed,dir);assert.equal(report.baselineConsistent,true);assert.equal(report.migrations[0].state,'recorded-equivalent-line-endings');assert.equal(report.migrations[0].recordedApplied,false);assert.deepEqual(report.unknownJournalHashes,[]);
  observed.applied[0].created_at='101';assert.equal(migrationEvidence(observed,dir).baselineConsistent,false);
  observed.applied[0].created_at='100';observed.columns=[];assert.equal(migrationEvidence(observed,dir).migrations[0].state,'journal-schema-mismatch');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('an owner-unapproved additive migration is reported pending rather than corrupting the corporate baseline',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gh-pending-migration-'));try{fs.mkdirSync(path.join(dir,'meta'));const sql='CREATE TABLE "later" (\n "id" uuid\n);\n';fs.writeFileSync(path.join(dir,'0006_later.sql'),sql);fs.writeFileSync(path.join(dir,'meta/_journal.json'),JSON.stringify({entries:[{tag:'0006_later',when:123}]}));const result=migrationEvidence({tables:[],columns:[],indexes:[],constraints:[],triggers:[],enums:[],applied:[]},dir);assert.equal(result.baselineConsistent,true);assert.equal(result.appliedConsistent,true);assert.deepEqual(result.pendingMigrations,['0006_later']);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
