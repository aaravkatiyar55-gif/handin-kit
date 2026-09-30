# Validation — 30 September 2026

Checked with Node.js 24.19.0 and the Chromium-based Codex in-app browser on Windows. This is a record of observed tests, not a promise for every browser or device.

## Automated checks

- `node scripts/check.mjs`: all 13 JavaScript files passed syntax checks for the workspace edition.
- `node --test test/*.test.mjs`: 21 tests passed. The original 11 naming/ZIP tests still pass. New tests cover bounded recipe imports, unsupported settings, recipe search, type/count checks, safe folder overrides, manual ordering, exact ZIP budgets with Hindi paths, SHA-256 duplicate matching/cancellation, appearance validation and image dimension preflight.
- `node scripts/build.mjs`: eleven public files produced in `dist/`; no credentials or tooling included. Release-specific service-worker cache names are generated from asset contents.
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

Safari, Firefox, actual phone hardware, OS-level drag/drop and clipboard image paste have not been tested. Clipboard copy can fall back to selecting the text if browser permissions block it. Scan headers are now checked before decoding; a damaged, unreadable or over-24-megapixel header keeps the original. The decoded bitmap is also checked. These guards reduce oversized-scan allocation risk; they do not establish safety against every malformed image or guarantee browser memory use.

Image size targets are best effort. Check small writing and transparency conversion in any real submission. PDF compression, OCR, cloud backup and sending messages are not features of this release.

## Production

The first Actions run reached Pages configuration before the new repository had Pages enabled. After enabling its workflow source, rerunning the failed job succeeded: build and deployment passed in [run 36680864812](https://github.com/aaravkatiyar55-gif/handin-kit/actions/runs/36680864812), source commit `f053608`.

The public root, app module and service worker returned HTTP 200. The live Pages app generated the sample files, reduced them to 292 KB, then restored the original 2.5 MB pack. Copy showed its success status. A production ZIP download without the optional CSV completed at 2,671,487 bytes, observed through browser download events.

Stardance project [66961](https://stardance.hackclub.com/projects/66961) was created under Frictionless with a real app screenshot, source/demo URLs and an explicit AI declaration. At initial registration it showed zero hours and no matching tracker record. The workspace-edition check below supersedes that initial state. No unrelated time was linked; reviewer approval and Stardust payout are not inferred from tests.

## Workspace edition browser checks

Checked through the actual local UI on port 4190 and a production build on port 4191. Fixtures are fictional files in ignored `test-output/`; no real personal documents were used.

| Scenario | Observed result |
| --- | --- |
| Themes and persistence | Night/blue/compact rendered correctly. A reload retained those selections and a saved recipe while clearing attachments and the message. Mint also rendered on the build. |
| Recipe application | Lab record applied an 8 MB budget, 300 KB scan target and CSV index; sample scans plus notes met its two file checks. |
| Custom recipe | Saved `QA Weekly lab`, added a PDF requirement, and saw `PDF: 0 of 1 needed` without blocking downloads. Saved recipe appeared after reload. |
| Invalid recipe import | Malformed JSON produced `This file is not valid JSON. No settings were changed.`; custom recipe count stayed unchanged. |
| Valid recipe import | Imported `QA Imported design` into the local library without automatically applying it. |
| Duplicate finder | Three text fixtures contained one byte-identical pair. The UI found one copy; removal changed 3 files to 2, Undo restored all 3 in order. |
| Filtered Hindi edits | Filtered to images, gave both the name `अभ्यास`, routed both to References, and moved the second scan up. Paths remained `References/अभ्यास.jpg` and `References/अभ्यास-2.jpg`; all 3 files stayed in the pack. |
| Edited message | A custom message survived subject, recipe, naming, routing and ordering changes. |
| Scan comparison | Original 1.3 MB PNG and prepared 290 KB JPEG displayed side by side at 850 × 1150; Escape closed the dialog and returned focus to Preview. The 300 KB-target sample pack became 583 KB, a displayed 78% reduction. |
| Downloads | Browser download events confirmed a 435-byte recipe JSON, 1,256-byte report JSON and 598,208-byte Hindi-named ZIP completed. The ZIP included the note and CSV; filtering did not remove the notes file. |
| Mobile and tablet | 360 × 800 and 768 × 1024 simulated viewports had no horizontal overflow. Mobile marketplace search for `lab` returned one recipe. Temporary viewport override was reset. |
| Offline root and fragment | An initial `#marketplace` offline reload failed. Removing URL fragments from the service-worker cache lookup fixed it. Root and `#marketplace` then reloaded with all seven recipes and offline status; the successful test's network override was reset. |

The earlier failed offline test ended on the in-app browser's blocked error-page URL; subsequent reset/close operations on that temporary tab were not confirmable. A fresh tab loaded online, and the final root/fragment checks used a separate tab whose network override was reset successfully. No owner Chrome network settings were changed. The failed tab is unmarked and temporary.

The source server now bypasses its offline cache on port 4190, so ordinary edits do not remain hidden behind a cached development release. Offline behavior belongs to the build server or HTTPS deployment.

Storage-full fallback, malformed previously stored recipes, every custom edit/delete flow, non-sample JPEG/WebP conversions and the large-header limits have not all been exercised in the browser. Recipe/schema/image-header behavior has automated coverage; browser storage failure handling is source-checked. No complete cross-browser or accessibility certification is claimed.

The workspace edition deployed successfully in [run 36690139249](https://github.com/aaravkatiyar55-gif/handin-kit/actions/runs/36690139249), source `db7e237`. Public-site checks confirmed Lab record application, night/blue appearance, sample optimisation to 583 KB and original/prepared preview. Clearing only saved settings reset appearance while preserving all three current attachments.

The initial workspace-edition check exposed `handin-kit` with **2h 42m 13s**. Only that matching record was linked, and the first factual devlog recorded that duration. At that point the exact three-hour mission requirement was still 17m 47s short, despite the card's rounded `3` display. The follow-up observations below supersede that time gate.

VS Code 1.139.1 and official `hackatime.hackatime-time-tracker@30.2.2004` are installed, with the `handin-kit` folder open. Native VS Code controls are unavailable to this agent session; source edits/tests used code tools and browser checks used the in-app browser. The platform-recorded total exceeds the requested 45-minute minimum, but this is not proof of manual editor typing or an independent audit of every event. The existing tracker credential exposure from an earlier status diagnostic still requires owner rotation; it was never added to this repository.

## README and evidence follow-up — 30 September 2026

The README now uses a sample-pack walkthrough, explains each of the twelve additions by its use, keeps setup/privacy/limitations information, and includes five unaltered screenshots from the public app. Each JPEG signature and local README link was checked. All five pictures loaded in the published GitHub README. The eleven-file build passed; documentation images are excluded from the app bundle. Checks and deployment succeeded for `20db9ae` in run 36692799442 and `1d71ccd` in run 36693332323.

Public UI checks confirmed the fictional Hindi-named sample pack, 583 KB prepared files, original/prepared preview, and saving `Lab scans + notes` with two image and one document requirements. The project banner and description were refreshed and the first devlog rewritten. Its save redirected to a Stardance 500 detail page, but the actual project feed confirmed that the changes and screenshot persisted. Development-notes links therefore use the working project feed.

A subsequent tracker sync showed the exact linked total **3h 17m 2s**. The composer then allowed a new devlog and attributed **19m 46s** to the documentation update. [Project 66961](https://stardance.hackclub.com/projects/66961) now has two devlogs: 2h 42m 13s and 19m 46s, summing to **3h 1m 59s logged**. The second devlog is 63166 and has four real native attachments: marketplace, recipe editor, Hindi filename pack and scan comparison. The composer permits four pictures; the README gallery adds the workspace view. No hours were invented or transferred.

The earlier time shortfall is resolved. Source, public runtime, README, screenshots, declaration and devlogs are present. Continuing the owner's earlier explicit Ship request, **Ship #1 was submitted once**. The platform returned “Your project has been submitted for review” and shows **Pending review** and **Pending mission review**. The Ship form accepted two native screenshots; the devlog retains four and the README five. Final Ship and Edit project controls became disabled. No reviewer approval or reward is claimed.

The post-ship notice says at least 18 votes on other projects are required for payout. No voting batch was performed as part of this documentation/Ship work; the observed balance remained 33. The separate tracker-key rotation remains owner-unconfirmed. Final pre-submission checks and deployment passed for `79e0ce3` in run 36694549584.

## Readability and returned review — 1 October 2026

The current software status is **Changes requested**, and the Frictionless mission is **returned**. The reviewer requires a self-written README and human code contribution; full feedback and the unresolved authorship requirement are recorded in [REVIEW_STATUS.md](docs/REVIEW_STATUS.md). The earlier pending-review observations are historical.

The concise README keeps setup, a sample walkthrough, privacy/pack limits and the AI disclosure. The longer guide and screenshot gallery were preserved in `docs/GUIDE.md`. `src/core.js` separates stem and folder selection into named helpers; `src/workbench.js` spells out appearance defaults. All 21 existing behavior tests and 13 syntax checks pass after the refactor, and the production build contains eleven files. These are Codex-assisted improvements, not a claim to have met the self-written requirement.

The production build on port 4192 also passed a fresh Chrome UI check: Lab record applied the 8 MiB budget and CSV setting; the fictional three-file pack met its image/document checklist. Giving both scans `अभ्यास` and choosing References produced `References/अभ्यास.png` and `References/अभ्यास-2.png`, while the Hindi subject stayed in the notes filename. Night ink rendered after selection. The README keeps the Assistance and older gallery anchors so existing source links still have a destination.
