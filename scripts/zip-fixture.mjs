import { mkdir, writeFile } from 'node:fs/promises';
import { zipBlob } from '../src/zip.js';
await mkdir('test-output', { recursive: true });
const zip = await zipBlob([
  { path: 'Documents/अभ्यास.txt', blob: new Blob(['नमस्ते\n']) },
  { path: 'empty.txt', blob: new Blob([]) },
  { path: 'binary.bin', blob: new Blob([new Uint8Array([0, 255, 1, 128])]) },
]);
await writeFile('test-output/interoperability.zip', new Uint8Array(await zip.arrayBuffer()));
console.log('Wrote independent-reader fixture: test-output/interoperability.zip');
