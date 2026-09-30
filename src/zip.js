const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function validateZipPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\')
    || /[\u0000-\u001f<>:"|?*]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) {
    throw new Error('The pack contains an unsafe filename. Rename it before downloading.');
  }
  if (encoder.encode(path).length > 65535) throw new Error('A filename is too long for this ZIP.');
}

function dosTime(timestamp) {
  const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.UTC(2026, 0, 1));
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2)
  };
}

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

// Store-only ZIP: image optimisation handles the useful byte reduction. PDFs are not recompressed.
export async function zipBlob(entries, { onProgress = () => {}, signal } = {}) {
  if (!entries.length || entries.length > 100) throw new Error('Choose between 1 and 100 pack entries.');
  if (entries.reduce((sum, entry) => sum + entry.blob.size, 0) > 100 * 1024 * 1024) throw new Error('This ZIP is too large for the browser packer.');
  const paths = new Set();
  for (const entry of entries) {
    validateZipPath(entry.path);
    const key = entry.path.normalize('NFC').toLowerCase();
    if (paths.has(key)) throw new Error('The ZIP contains duplicate paths.');
    paths.add(key);
  }
  const files = [];
  const directory = [];
  let offset = 0;
  for (let index = 0; index < entries.length; index++) {
    checkAbort(signal);
    const entry = entries[index];
    const name = encoder.encode(entry.path);
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    checkAbort(signal);
    const crc = crc32(bytes);
    const stamp = dosTime(entry.lastModified);
    const local = new Uint8Array(30 + name.length);
    const head = new DataView(local.buffer);
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(10, stamp.time, true);
    head.setUint16(12, stamp.date, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, bytes.length, true);
    head.setUint32(22, bytes.length, true);
    head.setUint16(26, name.length, true);
    local.set(name, 30);
    files.push(local, entry.blob);

    const central = new Uint8Array(46 + name.length);
    const record = new DataView(central.buffer);
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true);
    record.setUint16(6, 20, true);
    record.setUint16(8, 0x0800, true);
    record.setUint16(12, stamp.time, true);
    record.setUint16(14, stamp.date, true);
    record.setUint32(16, crc, true);
    record.setUint32(20, bytes.length, true);
    record.setUint32(24, bytes.length, true);
    record.setUint16(28, name.length, true);
    record.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + bytes.length;
    onProgress(index + 1, entries.length);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, directory.reduce((sum, record) => sum + record.length, 0), true);
  view.setUint32(16, offset, true);
  return new Blob([...files, ...directory, end], { type: 'application/zip' });
}
