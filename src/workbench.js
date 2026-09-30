import { handInNote, fileIndex, fileParts } from './core.js';

export const FOLDERS = Object.freeze(['', 'Images', 'Documents', 'Other', 'Work', 'References', 'Extras', 'root']);
export const DEFAULT_APPEARANCE = Object.freeze({ theme: 'paper', accent: 'rust', density: 'comfortable' });

export function appearance(value = {}) {
  return { theme: ['paper', 'mint', 'night'].includes(value?.theme) ? value.theme : 'paper',
    accent: ['rust', 'blue', 'berry'].includes(value?.accent) ? value.accent : 'rust',
    density: ['comfortable', 'compact'].includes(value?.density) ? value.density : 'comfortable' };
}

export function moveItem(items, id, direction) {
  const index = items.findIndex(item => item.id === id);
  const next = index + direction;
  if (![-1, 1].includes(direction) || index < 0 || next < 0 || next >= items.length) return [...items];
  const result = [...items];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function packEntries(rows, settings) {
  const entries = rows.map(row => ({ path: row.path, blob: row.blob, lastModified: row.file.lastModified }));
  entries.push({ path: 'hand-in-note.txt', blob: new Blob([handInNote(rows, settings)], { type: 'text/plain;charset=utf-8' }) });
  if (settings.includeIndex) entries.push({ path: 'file-index.csv', blob: new Blob([fileIndex(rows)], { type: 'text/csv;charset=utf-8' }) });
  return entries;
}

// Exact size for this app's store-only ZIP format, including notes and UTF-8 paths.
export function zipBytes(entries) {
  return 22 + entries.reduce((total, entry) => total + entry.blob.size + 76 + 2 * new TextEncoder().encode(entry.path).length, 0);
}

export async function findDuplicates(items, { signal, onProgress = () => {} } = {}) {
  if (!globalThis.crypto?.subtle) throw new Error('Duplicate checking needs a secure browser context.');
  const hashes = new Map();
  const duplicates = [];
  for (let index = 0; index < items.length; index++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const item = items[index];
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await item.file.arrayBuffer()));
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const fingerprint = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
    if (hashes.has(fingerprint)) duplicates.push({ id: item.id, originalId: hashes.get(fingerprint) });
    else hashes.set(fingerprint, item.id);
    onProgress(index + 1, items.length);
  }
  return duplicates;
}

export function fileMatches(row, query, kind) {
  const needle = query.trim().toLocaleLowerCase();
  return (kind === 'all' || (kind === 'PDF' ? row.extension === 'pdf' : kind === row.kind))
    && `${row.file.name} ${row.path}`.toLocaleLowerCase().includes(needle);
}

export function packReport(rows, settings, requirements, recipeTitle) {
  return { format: 'handin-kit-report', version: 1, recipe: recipeTitle,
    attachmentCount: rows.length, archiveBytes: zipBytes(packEntries(rows, settings)),
    requirements: requirements.map(rule => ({ kind: rule.kind, minimum: rule.min, found: rule.count, met: rule.met })),
    files: rows.map(row => ({ originalName: row.file.name, packPath: row.path, originalBytes: row.file.size,
      preparedBytes: row.blob.size, extension: fileParts(row.path).extension, changed: Boolean(row.prepared) })),
    note: 'This report lists filenames and sizes, not contents. It does not verify readability or submission rules.' };
}
