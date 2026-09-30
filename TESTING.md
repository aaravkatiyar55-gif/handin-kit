# Validation — 30 September 2026

Checked with Node.js 24.19.0 and the Chromium-based Codex in-app browser on Windows. This is a record of observed tests, not a promise for every browser or device.

## Automated checks

- `node scripts/check.mjs`: all ten JavaScript files passed syntax checks.
- `node --test test/*.test.mjs`: 11 tests passed. Coverage includes Hindi and reserved Windows names, case-insensitive collisions, numbering, original/copy byte selection, whole-batch limits, CSV formula protection, ZIP CRC32, unsafe paths, cancellation and UTF-8 headers.
- `node scripts/build.mjs`: nine public files produced in `dist/`; no credentials or tooling included. Release-specific service-worker cache names are generated from asset contents.
- `node scripts/zip-fixture.mjs`, then Python `test/read_zip.py`: Python's standard ZIP reader validated CRC and exact contents for a Hindi text path, empty file and binary file.

## Browser checks

| Scenario | Observed result |
| --- | --- |
| Fictional sample files | Two different scans with the same original name and a notes file loaded into one pack |
| Image optimisation | Two scans went from a displayed 2.5 MB to 292 KB total, 89% less; JPEG copies were 145 KB and 147 KB at 850 × 1150 |
| Hindi labels and custom names | Hindi subject survived; typing two equal custom names produced `अभ्यास.png` and `अभ्यास-2.png` without replacing the active input |
| Remove and undo | Removed entry returned to its original position |
| ZIP download with CSV | Browser download events reported `hand-in-science.zip` completed at 2,671,921 bytes for the unoptimised three-file sample pack plus note and index |
| Offline reload | With this tab's network disabled for testing, cached UI reloaded, showed offline status and cleared the working pack; network was restored afterwards |
| File chooser | Two local fictional fixtures loaded through the multiple-file chooser |
| Damaged PNG | Invalid image was kept unchanged; the notes file remained in the usable pack |
| Small mobile viewport | 360 × 800 viewport: no horizontal overflow; controls were adjusted to stack at the narrowest breakpoint |

The custom-name test exposed an input/change-event issue. The fix updates state and collision-resolved paths on input without recreating the focused field. The same Hindi collision scenario passed afterwards.

## Limits and further checks

Safari, Firefox, actual phone hardware, OS-level drag/drop and clipboard image paste have not been tested. Clipboard copy can fall back to selecting the text if browser permissions block it. Very large image decoding can consume substantial memory before the 24-megapixel limit is checked; per-file and pack byte limits bound intake but do not eliminate that browser limitation.

Image size targets are best effort. Check small writing and transparency conversion in any real submission. PDF compression, OCR, cloud backup and sending messages are not features of this release.

## Production

The first Actions run reached Pages configuration before the new repository had Pages enabled. After enabling its workflow source, rerunning the failed job succeeded: build and deployment passed in [run 36680864812](https://github.com/aaravkatiyar55-gif/handin-kit/actions/runs/36680864812), source commit `f053608`.

The public root, app module and service worker returned HTTP 200. The live Pages app generated the sample files, reduced them to 292 KB, then restored the original 2.5 MB pack. Copy showed its success status. A production ZIP download without the optional CSV completed at 2,671,487 bytes, observed through browser download events.

Stardance project [66961](https://stardance.hackclub.com/projects/66961) was created under Frictionless with a real app screenshot, source/demo URLs and an explicit AI declaration. It shows zero hours; Post a devlog and Ship are disabled. The tracker list has no Hand-in Kit record. No unrelated time was linked. No Hackatime hours, reviewer approval or Stardust payout are inferred from these tests.
