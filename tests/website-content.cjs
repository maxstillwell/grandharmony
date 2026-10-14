const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const actions = read('lib/website/actions.ts');
const manager = read('components/website/website-manager.tsx');
const types = read('lib/website/types.ts');

test('website changes remain guarded by the Super Admin server check', () => {
  for (const action of ['saveWebsiteDraft', 'publishWebsiteDraft', 'restoreWebsiteRevision']) {
    const start = actions.indexOf(`export async function ${action}`);
    assert.ok(start >= 0, `${action} exists`);
    assert.match(actions.slice(start, start + 750), /requireSuperAdmin\(\)/, `${action} requires Super Admin`);
  }
  assert.match(actions, /db\.transaction/, 'publishing is transactional');
  assert.match(actions, /revalidatePath\("\/"\)/, 'published website cache is invalidated');
});

test('no-Blob editing permits only approved existing static assets', () => {
  assert.match(types, /approvedStaticImageOptions/);
  assert.match(actions, /approvedStaticImageUrls\.has\(item\.imageUrl\)/);
  assert.match(manager, /Approved static image/);
  assert.doesNotMatch(manager, /mediaUrl}\s+onChange/);
  assert.doesNotMatch(manager, /posterUrl}\s+onChange/);
});

test('management workflow surfaces private draft, preview, publish and restore controls', () => {
  for (const label of ['Overview', 'Hero', 'Page Content', 'Team', 'Developments', 'Preview & Publish', 'Unsaved changes', 'Restore to draft']) {
    assert.match(manager, new RegExp(label.replace(/[&/]/g, '\\$&')));
  }
});
