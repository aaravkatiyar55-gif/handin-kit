import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const publicFiles = ['index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest', 'sw.js', 'src/app.js', 'src/core.js', 'src/images.js', 'src/zip.js', 'src/recipes.js', 'src/workbench.js'];
for (const file of publicFiles) {
  await mkdir(`dist/${file.split('/').slice(0, -1).join('/')}`, { recursive: true });
  await copyFile(file, `dist/${file}`);
}
// A changed release gets a new offline cache; users do not stay on stale assets.
const hash = createHash('sha256');
for (const file of publicFiles) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 16);
const worker = (await readFile('sw.js', 'utf8')).replace(/const CACHE = '[^']+';/, `const CACHE = 'handin-kit-${version}';`);
await writeFile('dist/sw.js', worker);
console.log(`Built ${publicFiles.length} public files into dist/. No credentials or source tooling included.`);
