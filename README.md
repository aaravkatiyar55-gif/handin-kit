# Hand-in Kit

Scans with repeated names, pages out of order and attachments that are too big: sort them out before sending.

**[Open Hand-in Kit](https://aaravkatiyar55-gif.github.io/handin-kit/)** · [Stardance](https://stardance.hackclub.com/projects/66961)

![The workbench with fictional sample files](docs/screenshots/pack.jpg)

## Try it

1. Click **Try sample files**, then choose **Lab record**.
2. Add a subject, arrange the pages and check the filenames. Hindi names work too.
3. Make smaller image copies, inspect the preview and download one ZIP.

Use your own files through the picker, drag/drop or image paste. Reusable recipes, file checklists, exact duplicate checks, folders and an editable message help with repeat submissions. Filters only hide rows; those files still go in the ZIP.

## Run locally

Node.js 22 or newer. No packages or keys needed.

```sh
git clone https://github.com/aaravkatiyar55-gif/handin-kit.git
cd handin-kit
npm start
```

Open `http://127.0.0.1:4190`. Check with `npm test`, `npm run check` and `npm run build`.

## Before sending

Files are processed in this browser; originals stay unchanged. Reloading clears the current pack. Only appearance and recipes you save persist. JPEG copies can lose detail, so check the writing. PDFs stay unchanged. Limits: 40 files, 25 MiB each, 80 MiB total.

<a id="a-closer-look"></a>

[Detailed guide and screenshots](docs/GUIDE.md) · [Tests and review status](TESTING.md)

## Assistance

Aarav chose the direction and features. Codex wrote the implementation, tests and docs and ran the recorded browser checks. This is substantially AI-assisted work. MIT licensed.
