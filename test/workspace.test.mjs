import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_RECIPES, validateRecipe, parseRecipe, requirementResults, filterRecipes } from '../src/recipes.js';
import { appearance, moveItem, packEntries, zipBytes, findDuplicates, fileMatches, packReport } from '../src/workbench.js';
import { planFiles } from '../src/core.js';
import { imageDimensions } from '../src/images.js';
import { zipBlob } from '../src/zip.js';

const item = (id, name, content = 'example', type = 'text/plain') => ({ id, file: new File([content], name, { type }) });
const settings = { subject: 'विज्ञान', naming: 'keep', group: true, includeIndex: true };
const base = () => ({ ...BUILT_IN_RECIPES[1], requirements: [{ kind: 'PDF', min: 1 }] });

test('recipe import round-trips settings while dropping extra data and code fields', () => {
  const imported = parseRecipe(JSON.stringify({ ...base(), student: 'not-exported', attachments: ['private.pdf'], url: 'javascript:alert(1)', __proto__: { unsafe: true } }));
  assert.equal(imported.title, base().title);
  assert.equal(imported.student, undefined);
  assert.equal(imported.attachments, undefined);
  assert.equal(imported.url, undefined);
  assert.equal(imported.id, undefined);
  assert.equal({}.unsafe, undefined);
  for (const recipe of BUILT_IN_RECIPES) assert.deepEqual(parseRecipe(JSON.stringify(recipe)), validateRecipe(recipe));
});

test('recipe validation rejects malformed versions, rules, settings and oversized UTF-8 input', () => {
  for (const changed of [{ version: 2 }, { title: '' }, { targetKB: 75 }, { budgetMB: 81 }, { group: 'true' },
    { requirements: [{ kind: 'script', min: 1 }] }, { requirements: [{ kind: 'PDF', min: 0 }] }, { requirements: [{ kind: 'all', min: 1.5 }] }]) {
    assert.throws(() => validateRecipe({ ...base(), ...changed }));
  }
  assert.throws(() => parseRecipe('{bad'), /valid JSON/);
  assert.throws(() => parseRecipe('क'.repeat(12_000)), /32 KB/);
  assert.throws(() => validateRecipe({ ...base(), requirements: Array(9).fill({ kind: 'all', min: 1 }) }));
});

test('marketplace search is case-insensitive, category aware, and has a valid empty result', () => {
  assert.deepEqual(filterRecipes(BUILT_IN_RECIPES, 'LAB', 'School').map(recipe => recipe.id), ['lab-record']);
  assert.equal(filterRecipes(BUILT_IN_RECIPES, 'LAB', 'Creative').length, 0);
  assert.equal(filterRecipes(BUILT_IN_RECIPES, '', 'all').length, 7);
});

test('checklist counts original types without pretending to read document contents', () => {
  const rows = planFiles([item('a', 'proof.PNG', 'a', 'image/png'), item('b', 'work.PDF', 'not-a-real-pdf', 'application/pdf'), item('c', 'notes.txt')], settings);
  const checks = requirementResults(rows, [{ kind: 'PDF', min: 1 }, { kind: 'Images', min: 2 }, { kind: 'all', min: 3 }]);
  assert.deepEqual(checks.map(rule => [rule.count, rule.met]), [[1, true], [1, false], [3, true]]);
  assert.equal(fileMatches(rows[1], 'WORK', 'PDF'), true);
  assert.equal(fileMatches(rows[1], 'WORK', 'Images'), false);
});

test('manual ordering is reversible and rejects missing IDs and boundary moves', () => {
  const items = [item('a', 'a.txt'), item('b', 'b.txt'), item('c', 'c.txt')];
  assert.deepEqual(moveItem(items, 'c', -1).map(row => row.id), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(moveItem(items, 'c', -1), 'c', 1), items);
  assert.deepEqual(moveItem(items, 'a', -1), items);
  assert.deepEqual(moveItem(items, 'unknown', 1), items);
  assert.deepEqual(items.map(row => row.id), ['a', 'b', 'c']);
});

test('folder routing never accepts an arbitrary path or shadows the pack note', () => {
  const rows = planFiles([{ ...item('a', 'hand-in-note.txt'), folder: 'root' }, { ...item('b', 'same.txt'), folder: 'References' },
    { ...item('c', 'same.txt'), folder: 'References' }, { ...item('d', 'x.txt'), folder: '../secret' }], settings);
  assert.deepEqual(rows.map(row => row.path), ['hand-in-note-2.txt', 'References/same.txt', 'References/same-2.txt', 'Documents/x.txt']);
});

test('budget includes exact ZIP overhead, Hindi paths, note and optional CSV', async () => {
  const rows = planFiles([item('a', 'अभ्यास.txt', 'नमस्ते'), item('b', 'empty.txt', '')], settings);
  const entries = packEntries(rows, settings);
  assert.equal(zipBytes(entries), (await zipBlob(entries)).size);
  const withoutIndex = packEntries(rows, { ...settings, includeIndex: false });
  assert.ok(zipBytes(withoutIndex) < zipBytes(entries));
  const report = packReport(rows, settings, [], 'Lab record');
  assert.equal(report.archiveBytes, zipBytes(entries));
  assert.equal(report.files[0].originalName, 'अभ्यास.txt');
  assert.equal(JSON.stringify(report).includes('नमस्ते'), false);
});

test('duplicate check compares exact bytes even when names differ and supports cancellation', async () => {
  const items = [item('a', 'first.txt', 'same'), item('b', 'second.txt', 'same'), item('c', 'first.txt', 'other')];
  assert.deepEqual(await findDuplicates(items), [{ id: 'b', originalId: 'a' }]);
  const controller = new AbortController();
  await assert.rejects(findDuplicates(items, { signal: controller.signal, onProgress: () => controller.abort() }), { name: 'AbortError' });
  assert.equal(items.length, 3);
});

test('appearance loading accepts only supported values, including malformed stored data', () => {
  assert.deepEqual(appearance(null), { theme: 'paper', accent: 'rust', density: 'comfortable' });
  assert.deepEqual(appearance({ theme: 'night', accent: 'blue', density: 'compact', style: 'url(...)' }), { theme: 'night', accent: 'blue', density: 'compact' });
  assert.equal(appearance({ theme: '<script>' }).theme, 'paper');
});

function pngHeader(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); bytes.set(new TextEncoder().encode('IHDR'), 12);
  view.setUint32(16, width); view.setUint32(20, height);
  return new Blob([bytes]);
}

test('image header preflight rejects huge and damaged scans before any pixel decoding', async () => {
  assert.deepEqual(await imageDimensions(pngHeader(850, 1150)), { width: 850, height: 1150 });
  await assert.rejects(imageDimensions(pngHeader(30_000, 30_000)), /24 megapixels/);
  await assert.rejects(imageDimensions(pngHeader(0, 40)), /dimensions/);
  await assert.rejects(imageDimensions(new Blob(['not an image'])), /dimensions/);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 0x04, 0x7e, 0x03, 0x52, 1]);
  assert.deepEqual(await imageDimensions(new Blob([jpeg])), { width: 850, height: 1150 });
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'), 0); webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  webp[24] = 0x51; webp[25] = 3; webp[27] = 0x7d; webp[28] = 4;
  assert.deepEqual(await imageDimensions(new Blob([webp])), { width: 850, height: 1150 });
});
