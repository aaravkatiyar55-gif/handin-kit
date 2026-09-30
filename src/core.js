export const LIMITS = Object.freeze({ count: 40, file: 25 * 1024 * 1024, total: 80 * 1024 * 1024 });

export function prettyBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 * 1024 ? 1024 : 1024 * 1024;
  return `${(bytes / unit).toFixed(bytes / unit < 10 ? 1 : 0)} ${unit === 1024 ? 'KB' : 'MB'}`;
}

export function cleanStem(value, fallback = 'file') {
  let name = String(value ?? '').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.\- ]+|[.\- ]+$/g, '');
  name = Array.from(name).slice(0, 80).join('').replace(/[. ]+$/g, '');
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `file-${name}`;
  return name;
}

export function fileParts(name) {
  const index = String(name).lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) return { stem: name, extension: '' };
  const extension = name.slice(index + 1).toLowerCase();
  if (!/^[a-z0-9]{1,12}$/.test(extension)) return { stem: name, extension: '' };
  return { stem: name.slice(0, index), extension };
}

export function category(file, extension) {
  if (file.type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(extension)) return 'Images';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(extension)) return 'Documents';
  return 'Other';
}

export function validateFiles(existing, incoming) {
  if (!incoming.length) return 'Choose at least one file.';
  if (existing.length + incoming.length > LIMITS.count) return `Use up to ${LIMITS.count} files per pack. Nothing from this selection was added.`;
  const oversized = incoming.find(file => file.size > LIMITS.file);
  if (oversized) return `${oversized.name} is larger than 25 MB. Nothing from this selection was added.`;
  const total = [...existing.map(item => item.file), ...incoming].reduce((sum, file) => sum + file.size, 0);
  if (total > LIMITS.total) return 'This pack would exceed 80 MB. Nothing from this selection was added.';
  return '';
}

function plannedStem(item, originalStem, subject, student, number, naming) {
  if (item.customName) return cleanStem(item.customName);
  if (naming === 'keep') return cleanStem(originalStem);
  return cleanStem([subject, student, String(number).padStart(2, '0')].filter(Boolean).join('-'));
}

function plannedFolder(item, blob, extension, group) {
  if (item.folder === 'root') return '';
  const folders = ['Images', 'Documents', 'Other', 'Work', 'References', 'Extras'];
  if (folders.includes(item.folder)) return `${item.folder}/`;
  if (group) return `${category(blob, extension)}/`;
  return '';
}

export function planFiles(items, options = {}) {
  const subject = cleanStem(options.subject || 'assignment').toLowerCase();
  const student = options.student?.trim() ? cleanStem(options.student).toLowerCase() : '';
  const ordered = [...items];
  if (options.order === 'name') ordered.sort((a, b) => a.file.name.localeCompare(b.file.name, 'en', { numeric: true }));
  const taken = new Set(['hand-in-note.txt', 'file-index.csv']);
  return ordered.map((item, index) => {
    const parts = fileParts(item.file.name);
    const extension = item.prepared?.extension ?? parts.extension;
    const blob = item.prepared?.blob ?? item.file;
    const stem = plannedStem(item, parts.stem, subject, student, index + 1, options.naming);
    const folder = plannedFolder(item, blob, extension, options.group);
    const suffix = extension ? `.${extension}` : '';
    let filename = `${stem}${suffix}`;
    let path = `${folder}${filename}`;
    let duplicate = 2;
    while (taken.has(path.normalize('NFC').toLowerCase())) {
      filename = `${stem}-${duplicate++}${suffix}`;
      path = `${folder}${filename}`;
    }
    taken.add(path.normalize('NFC').toLowerCase());
    return { ...item, blob, filename, path, stem, extension, kind: category(blob, extension), number: index + 1 };
  });
}

export function csvCell(value) {
  let text = String(value);
  // A filename must not become a formula when the optional index is opened in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(text) || /^\s+[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function fileIndex(rows) {
  const data = [['Original filename', 'Pack path', 'Original bytes', 'Packed bytes'],
    ...rows.map(row => [row.file.name, row.path, row.file.size, row.blob.size])];
  return '\ufeff' + data.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function handInNote(rows, options) {
  return [
    'Hand-in Kit — attachment list',
    `Subject: ${options.subject?.trim() || 'Assignment'}`,
    ...(options.student?.trim() ? [`Name / roll: ${options.student.trim()}`] : []),
    '',
    ...rows.map(row => `${String(row.number).padStart(2, '0')}. ${row.path}`),
    '',
    'Prepared locally in the browser. Original files were not changed.',
    'Check the contents and your submission instructions before sending.',
    ''
  ].join('\n');
}

export function archiveName(subject) {
  return `hand-in-${cleanStem(subject || 'assignment').toLowerCase()}.zip`;
}

export function handInMessage(rows, options) {
  return `Attached: ${archiveName(options.subject)}\n${rows.length} ${rows.length === 1 ? 'file' : 'files'} for ${options.subject?.trim() || 'the assignment'}.\nPlease let me know if any attachment needs to be sent separately.`;
}
