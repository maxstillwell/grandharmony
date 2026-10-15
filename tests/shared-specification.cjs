const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { hashShareSecret, newShareSecret, shareSessionCookieName } = require('../lib/models/share-security.ts');

test('collaboration secrets are random, hashable and link-scoped in cookies', () => {
  const first = newShareSecret();
  const second = newShareSecret();
  assert.notEqual(first, second);
  assert.equal(hashShareSecret(first).length, 64);
  assert.notEqual(hashShareSecret(first), first);
  assert.equal(shareSessionCookieName('link-123'), 'gh_spec_share_link-123');
});

test('shared specification collaboration is server-authorised and keeps contributors separate', () => {
  const source = fs.readFileSync('lib/models/share-actions.ts', 'utf8');
  const migration = fs.readFileSync('drizzle/0004_handy_morlun.sql', 'utf8');
  assert.match(source, /tokenHash: hashShareSecret\(token\)/);
  assert.match(source, /link\.status !== "active" \|\| link\.expiresAt <= new Date\(\)/);
  assert.match(source, /session\.contributorUserId/);
  assert.match(source, /scenarioShareSessions\)\.values/);
  assert.match(source, /httpOnly: true/);
  assert.match(source, /secure: process\.env\.NODE_ENV === "production"/);
  assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE FROM|ALTER TABLE "users"/i);
  assert.match(migration, /CREATE TABLE "scenario_share_links"/);
  assert.match(migration, /CREATE TABLE "scenario_share_sessions"/);
});
