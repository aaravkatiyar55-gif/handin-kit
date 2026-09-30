import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanStem, planFiles, validateFiles, LIMITS, csvCell, fileIndex, archiveName, handInMessage } from '../src/core.js';
import { crc32, zipBlob, validateZipPath } from '../src/zip.js';

const item = (name, content = 'example') => ({ id: name + content, file: new File([content], name, { type: 'text/plain' }) });

test('filename cleanup preserves Hindi and prevents unsafe Windows names', () => {
  assert.equal(cleanStem('../../my: notes?'), 'my-notes');
  assert.equal(cleanStem('CON'), 'file-CON');
  assert.equal(cleanStem('   '), 'file');
  assert.equal(cleanStem('विज्ञान अभ्यास'), 'विज्ञान-अभ्यास');
  assert.ok(cleanStem('x'.repeat(200)).length <= 80);
});

test('duplicate names, letter case and reserved pack files cannot overwrite one another', () => {
  const rows = planFiles([item('Note.TXT'), item('note.txt', 'other'), item('hand-in-note.txt')], { naming: 'keep' });
  assert.deepEqual(rows.map(row => row.path), ['Note.txt', 'note-2.txt', 'hand-in-note-2.txt']);
});

test('numbering follows chosen order; optimisation determines extension and bytes', () => {
  const a = item('scan10.png');
  a.prepared = { blob: new Blob(['small'], { type: 'image/jpeg' }), extension: 'jpg' };
  const rows = planFiles([a, item('scan2.txt')], { subject: 'Science', student: '10B 07', order: 'name', group: true });
  assert.deepEqual(rows.map(row => row.path), ['Documents/science-10b-07-01.txt', 'Images/science-10b-07-02.jpg']);
  assert.equal(rows[1].blob.size, 5);
});

test('custom names are safe and collision resolved even for Hindi names', () => {
  const rows = planFiles([{ ...item('a.txt'), customName: 'अभ्यास' }, { ...item('b.txt'), customName: 'अभ्यास' }]);
  assert.deepEqual(rows.map(row => row.path), ['अभ्यास.txt', 'अभ्यास-2.txt']);
});

test('batch limits reject whole selection without accepting a partial pack', () => {
  assert.match(validateFiles([], Array.from({ length: LIMITS.count + 1 }, () => ({ size: 1 }))), /40 files/);
  assert.match(validateFiles([], [{ name: 'large.pdf', size: LIMITS.file + 1 }]), /25 MB/);
  assert.match(validateFiles([], Array.from({ length: 4 }, () => ({ size: LIMITS.file }))), /80 MB/);
  assert.equal(validateFiles([], [new File([''], 'empty.txt')]), '');
});

test('CSV index quotes commas and neutralises spreadsheet formula filenames', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.match(csvCell('  @cmd'), /^"'/);
  assert.match(fileIndex(planFiles([item('=SUM(1).txt')])), /'=SUM/);
});

test('archive and hand-in message do not invent an author story', () => {
  assert.equal(archiveName('Science / Lab'), 'hand-in-science-lab.zip');
  assert.match(handInMessage(planFiles([item('a.txt')]), { subject: 'Science' }), /1 file for Science/);
});

test('ZIP CRC matches the standard test vector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('ZIP rejects traversal, absolute paths and duplicate names', async () => {
  for (const path of ['../x', '/x', 'C:/x', 'x\\y', 'x/../y', 'x//y', 'x.']) assert.throws(() => validateZipPath(path));
  await assert.rejects(zipBlob([{ path: 'a.txt', blob: new Blob(['a']) }, { path: 'A.txt', blob: new Blob(['b']) }]), /duplicate/);
});

test('ZIP cancellation stops before returning a partial archive', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(zipBlob([{ path: 'a.txt', blob: new Blob(['a']) }], { signal: controller.signal }), { name: 'AbortError' });
});

test('ZIP stores UTF-8 names, contents and an empty file with a valid directory', async () => {
  const zip = await zipBlob([{ path: 'Documents/अभ्यास.txt', blob: new Blob(['नमस्ते']) }, { path: 'empty.txt', blob: new Blob([]) }]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x0800);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 2);
  const centralOffset = view.getUint32(bytes.length - 6, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
});
