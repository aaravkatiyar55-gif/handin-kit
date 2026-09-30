# Hand-in Kit

The assignment is done. The attachments still have names like `IMG_20260930.png`, and two scans are much bigger than they need to be.

Hand-in Kit takes care of that last bit: name a batch, make smaller image copies, and download one organised ZIP. There is no account, file upload or backend.

[Open the kit](https://aaravkatiyar55-gif.github.io/handin-kit/)

## A quick walkthrough

1. Choose files, drop them onto the workbench, or paste an image while outside a text field. **Try sample files** creates fictional files on your device.
2. Add a subject and, optionally, a name or roll number. Pick numbering or tidy original names. The preview shows every destination; custom names update as you type.
3. Use **Make smaller image copies** for JPEG, PNG and WebP scans. Check the writing afterwards. **Restore original images** undoes the conversion inside this pack.
4. Download the ZIP. It includes an attachment note; an index with original filenames is optional and off by default. The suggested message is copied only when requested and is never sent by the app.

These are the three main quality-of-life improvements: safer batch naming, lighter scans, and a single portable hand-in. Unlike QueueClear, this project works on attachments rather than planning tasks.

## The small print that actually matters

- Originals on your device are never renamed or replaced. A reload clears the working pack. Downloaded ZIPs remain on your device.
- Up to 40 files, 25 MiB per file and 80 MiB per pack. An oversized selection is rejected as a whole.
- Image copies are JPEG. Transparent areas become white; metadata is not copied through the canvas. Images above 24 megapixels are kept unchanged. Size targets are best effort, not a promise.
- PDFs, GIFs, HEIC images and other files are packed unchanged. This is not a PDF compressor. ZIP uses the stored format and adds some overhead.
- Hindi names are preserved. Unsafe filename characters are cleaned; duplicate paths get a suffix. The optional CSV neutralises filenames that could become spreadsheet formulas.
- The first visit loads public app files from the host. File contents stay in browser memory; there is no analytics or remote processing. A service worker caches the app code for later offline visits, never your chosen files.
- Use a modern browser with JavaScript. Image processing depends on `createImageBitmap` and canvas JPEG support. A failed conversion keeps that original and lets the rest of the pack work.

## Run it locally

Install Node.js 22 or newer, clone this repository, and open a terminal in it. There are no package dependencies or API keys to install.

```sh
git clone https://github.com/aaravkatiyar55-gif/handin-kit.git
cd handin-kit
npm start
```

Open `http://127.0.0.1:4190`. The direct equivalent is `node scripts/serve.mjs`.

```sh
npm test
npm run check
npm run build
node scripts/serve.mjs --dist --port 4191
```

The build copies only nine public app files into `dist/` and stamps the offline cache with a content hash. Serve `dist/` over HTTPS for service workers in production. Relative links support a project subdirectory such as `/handin-kit/`.

GitHub Pages publication is in `.github/workflows/pages.yml`: syntax checks, Node tests, build, then deployment. Set the repository's Pages source to **GitHub Actions**. Workflow actions are pinned to verified official commits. No deploy secret is needed. Pull requests run checks without deploying.

For an independent ZIP reader check, Python 3 is optional:

```sh
node scripts/zip-fixture.mjs
python test/read_zip.py
```

## Find your way around

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | Page structure, keyboard labels and responsive paper-and-ink layout |
| `src/app.js` | File picker, pack state, previews, undo and downloads |
| `src/core.js` | Naming, limits, notes and CSV index |
| `src/images.js` | Local scan conversion and fictional demo files |
| `src/zip.js` | UTF-8 ZIP writer with CRC32 and cancellation |
| `sw.js` | Offline public-asset cache |
| `test/` | Naming and ZIP edge cases; optional Python reader check |

Validation and current limits are recorded in [TESTING.md](TESTING.md). Files are rendered with DOM text nodes, not interpreted as HTML. There are no runtime libraries, external fonts, stock images or generated image assets.

## Assistance

Aarav requested and directed this project; Codex prepared the implementation, tests, design and documentation. This is substantially AI-assisted work. The natural wording and individual visual choices are not a claim that the code was written without AI.

The project targets Stardance's [Frictionless mission](https://stardance.hackclub.com/missions/frictionless). That mission requires at least three hours of genuine eligible work as well as a useful working tool. Those hours and any AI eligibility condition have not been verified. No Stardust payout, reviewer approval or mission completion is claimed.

MIT licensed. The source, setup instructions and app continue to work without a ChatGPT subscription.
