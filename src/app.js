import { validateFiles, planFiles, prettyBytes, fileIndex, handInNote, handInMessage, archiveName } from './core.js';
import { canOptimise, optimiseImage, demoFiles } from './images.js';
import { zipBlob } from './zip.js';

const $ = id => document.getElementById(id);
const state = { items: [], removed: null, busy: false, controller: null, demo: false };
const controls = ['file-input', 'subject', 'student', 'naming', 'order', 'group', 'target', 'edge', 'include-index'];

function options() {
  return { subject: $('subject').value, student: $('student').value, naming: $('naming').value,
    order: $('order').value, group: $('group').checked, includeIndex: $('include-index').checked };
}

function say(text, kind = 'note') {
  $('status').textContent = text;
  $('status').dataset.kind = kind;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function render() {
  const rows = planFiles(state.items, options());
  const original = rows.reduce((sum, row) => sum + row.file.size, 0);
  const prepared = rows.reduce((sum, row) => sum + row.blob.size, 0);
  const saved = Math.max(0, original - prepared);
  $('count').textContent = `${rows.length} ${rows.length === 1 ? 'file' : 'files'}`;
  $('empty').hidden = rows.length > 0;
  $('list-area').hidden = !rows.length;
  $('sample-label').hidden = !state.demo;
  $('original-size').textContent = prettyBytes(original);
  $('prepared-size').textContent = prettyBytes(prepared);
  $('saving').textContent = saved ? `${Math.round(saved / original * 100)}% less` : '—';
  $('saving-label').textContent = saved ? `${prettyBytes(saved)} saved` : rows.length ? 'No byte savings yet' : 'No files yet';
  $('message').value = rows.length ? handInMessage(rows, options()) : '';
  for (const id of controls) $(id).disabled = state.busy;
  $('dropzone').setAttribute('aria-disabled', String(state.busy));
  $('demo').disabled = state.busy || rows.length > 0;
  $('download').disabled = state.busy || !rows.length;
  $('copy').disabled = state.busy || !rows.length;
  $('clear').disabled = state.busy || !rows.length;
  $('undo').disabled = state.busy || !state.removed;
  $('optimise').disabled = state.busy || !state.items.some(item => canOptimise(item.file));
  $('restore').disabled = state.busy || !state.items.some(item => item.prepared);
  $('cancel').hidden = !state.busy;
  const list = $('file-list');
  list.replaceChildren();
  for (const row of rows) {
    const li = node('li', 'file-row');
    li.append(node('span', 'file-number', String(row.number).padStart(2, '0')));
    const detail = node('div', 'file-detail');
    detail.append(node('p', 'original-name', row.file.name), node('p', 'planned-path', row.path));
    const editor = node('input', 'name-editor');
    editor.type = 'text';
    editor.maxLength = 80;
    editor.placeholder = `Custom name (optional): ${row.stem}`;
    editor.value = row.customName || '';
    editor.setAttribute('aria-label', `Custom name for file ${row.number}, ${row.file.name}`);
    editor.disabled = state.busy;
    editor.addEventListener('input', () => {
      const originalItem = state.items.find(item => item.id === row.id);
      originalItem.customName = editor.value;
      // Keep the active input and caret in place while updating every collision-resolved path.
      const updated = planFiles(state.items, options());
      for (let index = 0; index < updated.length; index++) {
        const element = list.children[index];
        element.querySelector('.planned-path').textContent = updated[index].path;
        element.querySelector('.name-editor').placeholder = `Custom name (optional): ${updated[index].stem}`;
      }
      $('message').value = handInMessage(updated, options());
      say('Filename preview updated. Duplicate names receive a safe suffix.');
    });
    detail.append(editor);
    if (row.note) detail.append(node('p', 'file-note', row.note));
    const meta = node('div', 'file-meta');
    if (row.prepared) meta.append(node('del', '', prettyBytes(row.file.size)));
    meta.append(node('strong', '', prettyBytes(row.blob.size)));
    const remove = node('button', 'remove-file', 'Remove');
    remove.setAttribute('aria-label', `Remove file ${row.number}, ${row.file.name}`);
    remove.disabled = state.busy;
    remove.addEventListener('click', () => {
      state.removed = { item: state.items.find(item => item.id === row.id), index: state.items.findIndex(item => item.id === row.id) };
      state.items = state.items.filter(item => item.id !== row.id);
      render();
      say('Removed from this pack. Your device file is unchanged. Undo is available.');
      $('undo').focus();
    });
    meta.append(remove);
    li.append(detail, meta);
    list.append(li);
  }
  return rows;
}

function addFiles(files, demo = false) {
  if (state.busy) return;
  const incoming = Array.from(files);
  const error = validateFiles(state.items, incoming);
  if (error) { say(error, 'error'); return; }
  state.items.push(...incoming.map(file => ({ id: crypto.randomUUID(), file })));
  state.demo = demo || (state.demo && !incoming.length);
  render();
  say(`${incoming.length} ${incoming.length === 1 ? 'file added' : 'files added'}. Review the planned names; originals stay unchanged.`, 'success');
}

function busyStart() {
  state.busy = true;
  state.controller = new AbortController();
  render();
  return state.controller.signal;
}

function busyEnd() { state.busy = false; state.controller = null; render(); }

$('file-input').addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
$('dropzone').addEventListener('keydown', event => {
  if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!state.busy) $('file-input').click(); }
});
$('dropzone').addEventListener('click', event => { if (state.busy) event.preventDefault(); });
for (const type of ['dragenter', 'dragover']) $('dropzone').addEventListener(type, event => {
  event.preventDefault(); if (!state.busy) $('dropzone').classList.add('dragging');
});
for (const type of ['dragleave', 'drop']) $('dropzone').addEventListener(type, event => {
  event.preventDefault(); $('dropzone').classList.remove('dragging');
  if (type === 'drop') addFiles(event.dataTransfer.files);
});
document.addEventListener('paste', event => {
  if (event.target.closest('input, textarea') || state.busy) return;
  const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
  if (files.length) { event.preventDefault(); addFiles(files); }
});
for (const id of ['subject', 'student', 'naming', 'order', 'group', 'include-index']) $(id).addEventListener('input', () => render());

$('demo').addEventListener('click', async () => {
  if (state.items.length) return;
  busyStart();
  say('Making fictional sample scans on this device…');
  try {
    const files = await demoFiles();
    const cancelled = state.controller.signal.aborted;
    busyEnd();
    if (cancelled) { say('Sample generation cancelled.'); return; }
    addFiles(files, true);
  } catch { busyEnd(); say('Could not generate samples in this browser. You can still choose your own files.', 'error'); }
});

$('optimise').addEventListener('click', async () => {
  const signal = busyStart();
  const candidates = state.items.filter(item => canOptimise(item.file));
  let changed = 0;
  let skipped = 0;
  try {
    for (let index = 0; index < candidates.length; index++) {
      const item = candidates[index];
      say(`Preparing scan ${index + 1} of ${candidates.length}…`);
      try {
        const result = await optimiseImage(item.file, { targetKB: Number($('target').value), maxEdge: Number($('edge').value), signal });
        if (result.changed) { item.prepared = result; changed++; }
        else { item.prepared = null; skipped++; }
        item.note = result.note;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        skipped++;
        item.prepared = null;
        item.note = 'Could not prepare this image. Original kept; other files are still usable.';
      }
    }
    say(`${changed} smaller ${changed === 1 ? 'copy' : 'copies'} ready${skipped ? `; ${skipped} kept unchanged` : ''}. Check small writing before sending.`, 'success');
  } catch (error) {
    say(error.name === 'AbortError' ? 'Processing cancelled. Completed copies remain; the rest are unchanged.' : 'Processing stopped. Originals are still available.', 'note');
  } finally { busyEnd(); }
});

$('restore').addEventListener('click', () => {
  for (const item of state.items) { item.prepared = null; item.note = ''; }
  render();
  say('Original images restored in this pack. Your device files were never changed.');
});
$('undo').addEventListener('click', () => {
  if (!state.removed) return;
  const error = validateFiles(state.items, [state.removed.item.file]);
  if (error) { say(error, 'error'); return; }
  state.items.splice(state.removed.index, 0, state.removed.item);
  state.removed = null;
  render();
  say('Removed file restored.', 'success');
});
$('clear').addEventListener('click', () => {
  state.items = []; state.removed = null; state.demo = false;
  render(); say('Pack cleared. Files on your device are unchanged.'); $('demo').focus();
});
$('cancel').addEventListener('click', () => { state.controller?.abort(); say('Cancelling after the current image or file…'); });

$('download').addEventListener('click', async () => {
  const signal = busyStart();
  const settings = options();
  const rows = planFiles(state.items, settings);
  const entries = rows.map(row => ({ path: row.path, blob: row.blob, lastModified: row.file.lastModified }));
  entries.push({ path: 'hand-in-note.txt', blob: new Blob([handInNote(rows, settings)], { type: 'text/plain;charset=utf-8' }) });
  if (settings.includeIndex) entries.push({ path: 'file-index.csv', blob: new Blob([fileIndex(rows)], { type: 'text/csv;charset=utf-8' }) });
  try {
    const zip = await zipBlob(entries, { signal, onProgress: (done, total) => say(`Packing ${done} of ${total} files…`) });
    const url = URL.createObjectURL(zip);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = archiveName(settings.subject);
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    say(`ZIP download started (${prettyBytes(zip.size)}). Open it and check the attachments before sending.`, 'success');
  } catch (error) { say(error.name === 'AbortError' ? 'Packing cancelled. No partial ZIP was downloaded.' : 'Could not make the ZIP. Your files remain available.', 'error'); }
  finally { busyEnd(); }
});

$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('message').value); say('Message copied. Edit it as needed; nothing was sent.', 'success'); }
  catch { $('message').focus(); $('message').select(); say('Message selected. Use your browser’s copy command; nothing was sent.'); }
});

render();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $('offline-status').textContent = navigator.onLine ? 'Available offline after this visit' : 'Offline · local processing works'; })
    .catch(() => { $('offline-status').textContent = 'Local processing · offline cache unavailable'; });
}
window.addEventListener('offline', () => { $('offline-status').textContent = 'Offline · local processing works'; });
window.addEventListener('online', () => { $('offline-status').textContent = 'Local processing · no analytics'; });
