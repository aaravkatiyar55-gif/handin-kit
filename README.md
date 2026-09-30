# Hand-in Kit

The assignment is done. The attachments still have names like `IMG_20260930.png`, and two scans are much bigger than they need to be.

Hand-in Kit takes care of that last bit: name a batch, make smaller image copies, and download one organised ZIP. The workspace edition adds reusable recipes, file checks and a desk you can customize. There is no account, file upload or backend.

[Open the kit](https://aaravkatiyar55-gif.github.io/handin-kit/)

## A quick walkthrough

1. Pick a recipe from **Start with** or browse the free recipe marketplace. Choose files, drop them onto the workbench, or paste an image while outside a text field. **Try sample files** creates fictional files on your device.
2. Add a subject and, optionally, a name or roll number. Adjust individual names, use the arrows for order, and choose a folder for any file. The destination updates before anything is downloaded.
3. Use **Make smaller image copies** for JPEG, PNG and WebP scans. Open **Preview** to compare the original and JPEG, including a full-size view for small writing. **Restore original images** undoes the conversion inside this pack.
4. Check the ZIP budget and recipe checklist. Missing files or an exceeded budget are warnings, not a promise that a recipient will accept the pack. Download the ZIP with its attachment note. A CSV index with original filenames is optional; some recipes turn it on.
5. Edit the suggested message if needed. Your edited text survives file and settings changes until **Reset suggestion**. The app never sends it.
6. Save your settings as a custom recipe, or export/import a small recipe JSON file for use in another browser. Select a theme, accent and spacing to make the workspace comfortable.

These are the three main quality-of-life improvements: safer batch naming, lighter scans, and a single portable hand-in. Unlike QueueClear, this project works on attachments rather than planning tasks.

## Twelve additions in the workspace edition

| Tool | What you can actually do |
| --- | --- |
| Free recipe marketplace | Search seven built-in setups by text or category and apply their settings |
| Custom recipe editor | Save up to 20 setups, give them a useful description and edit their checklist |
| Recipe import/export | Share a validated, versioned JSON file of settings; no attachments or workbench identity fields |
| Workspace appearance | Choose warm paper, mint or night ink, three accents and comfortable/compact spacing |
| Exact duplicate finder | Compare original file bytes with SHA-256, remove extra copies and undo that batch |
| Attachment preview | Compare original/prepared scans, inspect full size and read a bounded text preview |
| Manual file ordering | Move a file up or down; numbered names follow the new order |
| Per-file folders | Route a file to Work, References, Extras, a type folder or the pack root |
| ZIP budget | See the exact store-only ZIP byte total, including paths, the note and optional CSV |
| Recipe checklist | Spot missing file types/counts; PDF checks use filenames, not contents |
| Editable hand-in message | Keep your own wording while making other changes; reset to the current suggestion when wanted |
| Pack report | Download JSON listing destinations, original/prepared sizes and checklist results |

File search/type filters help with a busy pack. They only change the visible list: every file in the pack still goes into the ZIP. Recipes are local starting points, not published by a community or approved by recipients. All are free; there are no sales, accounts or public uploads.

## The small print that actually matters

- Originals on your device are never renamed or replaced. A reload clears the working pack. Downloaded ZIPs remain on your device.
- Up to 40 files, 25 MiB per file and 80 MiB per pack. An oversized selection is rejected as a whole.
- Image copies are JPEG. Transparent areas become white; metadata is not copied through the canvas. Images above 24 megapixels are kept unchanged. Size targets are best effort, not a promise.
- PDFs, GIFs, HEIC images and other files are packed unchanged. This is not a PDF compressor. ZIP uses the stored format and adds some overhead.
- Hindi names are preserved. Unsafe filename characters are cleaned; duplicate paths get a suffix. The optional CSV neutralises filenames that could become spreadsheet formulas.
- The first visit loads public app files from the host. File contents stay in browser memory; there is no analytics or remote processing. A service worker caches the app code for later offline visits, never your chosen files.
- Only appearance and recipes you explicitly save persist in this browser under one Hand-in Kit storage key. The workbench's subject/name fields, attachments and edited message are not saved. **What is saved on this device?** lets you clear this app's preferences without touching the pack or other sites.
- Recipe imports are limited to 32 KB and validated against supported settings. Unknown properties are dropped; imported text is rendered as text. Exporting a pack report includes original filenames, so review it before sharing.
- Duplicate matching means byte-for-byte equality of originals. Similar-looking images or different file encodings are not duplicates. Removing a copy affects this pack only, and Undo checks the pack limits before restoring it.
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

The build copies only eleven public app files into `dist/` and stamps the offline cache with a content hash. Serve `dist/` over HTTPS for service workers in production. Relative links support a project subdirectory such as `/handin-kit/`. The source server on port 4190 bypasses the app's offline cache so edits stay visible; test offline behavior with the build on port 4191.

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
| `src/recipes.js` | Built-in setups, bounded recipe validation, search and count checks |
| `src/workbench.js` | Exact ZIP budgeting, duplicate checks, routing choices and report data |
| `sw.js` | Offline public-asset cache |
| `test/` | Naming and ZIP edge cases; optional Python reader check |

Validation and current limits are recorded in [TESTING.md](TESTING.md). Files are rendered with DOM text nodes, not interpreted as HTML. There are no runtime libraries, external fonts, stock images or generated image assets.

## Assistance

Aarav requested and directed this project; Codex prepared the implementation, tests, design and documentation. This is substantially AI-assisted work. The natural wording and individual visual choices are not a claim that the code was written without AI.

The project targets Stardance's [Frictionless mission](https://stardance.hackclub.com/missions/frictionless). That mission requires at least three hours of genuine eligible work as well as a useful working tool. Those hours and any AI eligibility condition have not been verified. No Stardust payout, reviewer approval or mission completion is claimed.

MIT licensed. The source, setup instructions and app continue to work without a ChatGPT subscription.
