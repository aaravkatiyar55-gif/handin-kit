function aborted(signal) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

export function canOptimise(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    || /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function supportedSignature(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10)
    || (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP');
}

export async function imageDimensions(file) {
  // Read a bounded header before asking the browser to allocate decoded pixels.
  const b = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let width = 0;
  let height = 0;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
      && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10
      && view.getUint32(8) === 13 && String.fromCharCode(...b.slice(12, 16)) === 'IHDR') {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (b.length >= 12 && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= b.length) {
      if (b[offset++] !== 0xff) break;
      while (offset < b.length && b[offset] === 0xff) offset++;
      const marker = b[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > b.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > b.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  } else if (b.length >= 30 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === 'VP8X') {
      width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
      height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    } else if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 1 && b[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    } else if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff);
    }
  }
  if (!width || !height) throw new Error('Could not safely read this scan’s dimensions. Original kept.');
  if (width * height > 24_000_000) throw new Error('Images above 24 megapixels are kept unchanged.');
  return { width, height };
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('This browser could not encode the image.')), type, quality));
}

export async function optimiseImage(file, { targetKB = 150, maxEdge = 1600, signal } = {}) {
  aborted(signal);
  if (!await supportedSignature(file)) throw new Error('Not a supported scan image; the original is kept.');
  await imageDimensions(file);
  if (typeof createImageBitmap !== 'function') throw new Error('Image processing is not available in this browser; the original is kept.');
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (!image.width || !image.height || image.width * image.height > 24_000_000) throw new Error('Images above 24 megapixels are kept unchanged.');
    const target = Math.max(30, Math.min(2000, Number(targetKB) || 150)) * 1024;
    const ratio = Math.min(1, (Number(maxEdge) || 1600) / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * ratio));
    let height = Math.max(1, Math.round(image.height * ratio));
    let best;
    for (let pass = 0; pass < 4; pass++) {
      aborted(signal);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Image canvas is unavailable; the original is kept.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      let low = .38;
      let high = .88;
      let fitting;
      for (let attempt = 0; attempt < 7; attempt++) {
        aborted(signal);
        const quality = (low + high) / 2;
        const blob = await canvasBlob(canvas, 'image/jpeg', quality);
        if (blob.type !== 'image/jpeg') throw new Error('JPEG copies are not supported by this browser; the original is kept.');
        if (!best || blob.size < best.blob.size) best = { blob, width, height };
        if (blob.size <= target) { fitting = { blob, width, height }; low = quality; }
        else high = quality;
      }
      if (fitting) { best = fitting; break; }
      if (Math.max(width, height) <= 900) break;
      width = Math.max(1, Math.round(width * .8));
      height = Math.max(1, Math.round(height * .8));
    }
    aborted(signal);
    if (!best || best.blob.size >= file.size) return { changed: false, note: 'The original is already smaller than the prepared copy; kept unchanged.' };
    return {
      ...best, extension: 'jpg', changed: true,
      note: `${best.width} × ${best.height} px JPEG copy${best.blob.size > target ? ' · above target; best effort' : ''}. Check small writing before sending.`
    };
  } finally { image.close(); }
}

export async function demoFiles() {
  const canvas = document.createElement('canvas');
  canvas.width = 850;
  canvas.height = 1150;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  let seed = 73;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 225 + (seed >>> 24) % 30;
    pixels.data[offset] = value;
    pixels.data[offset + 1] = value;
    pixels.data[offset + 2] = value - 8;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  context.strokeStyle = '#b6b29e';
  for (let y = 210; y < 1040; y += 52) { context.beginPath(); context.moveTo(70, y); context.lineTo(780, y); context.stroke(); }
  context.fillStyle = '#3b493b';
  context.font = '34px Georgia';
  context.fillText('SCIENCE / PRACTICE SHEET', 70, 115);
  context.font = '19px sans-serif';
  context.fillText('FICTIONAL DEMO — no real student records', 70, 160);
  context.fillText('Observation: a useful demo has readable text.', 70, 247);
  context.fillText('The image copy should be smaller than this scan.', 70, 300);
  const first = await canvasBlob(canvas, 'image/png');
  context.fillText('Sheet 02: same filename, different contents.', 70, 352);
  const second = await canvasBlob(canvas, 'image/png');
  return [new File([first], 'IMG_20260930.png', { type: 'image/png' }),
    new File([second], 'IMG_20260930.png', { type: 'image/png' }),
    new File(['Fictional demo notes.\nThese files are generated on this device to try Hand-in Kit.\n'], 'Lab notes (draft).txt', { type: 'text/plain' })];
}
