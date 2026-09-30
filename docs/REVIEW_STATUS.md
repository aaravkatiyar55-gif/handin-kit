# Review status — 1 October 2026

[Stardance project 66961](https://stardance.hackclub.com/projects/66961) currently shows **Changes requested** for Ship #1 and **Mission returned** for Frictionless.

The software review says:

> the readme is written with assistance from ai tools. this is prohibited and you need to rewrite it yourself.

> the project is comprised of over 30% ai code; this means you can either add more features yourself until your code makes up a majority or, rewrite existing ai code

The mission's separate feedback says the ship was not certified and refers to that software feedback.

## Useful changes made

- The front-page README now has one screenshot, a three-step sample walkthrough, setup, practical limits and an accurate assistance statement. Detailed instructions and the full screenshot gallery remain in [GUIDE.md](GUIDE.md).
- Filename selection and folder routing are separate readable helpers in `src/core.js`, preserving custom names, Hindi collision handling, file ordering, allowed folders and original/prepared files.
- Appearance validation in `src/workbench.js` uses explicit defaults and supported-value checks, replacing the dense conditional expression.
- All 21 automated tests, 13 JavaScript syntax checks and the eleven-file production build pass after these changes.

These changes were made with Codex. They improve documentation and maintainability; they do **not** turn the project into self-written work or satisfy the reviewer's human-authorship requirement. No deliberate mistakes were added. Request re-certification/re-review has not been clicked.

The two existing devlogs were shortened and saved on 1 October. Their original 2h 42m 13s and 19m 46s durations and five total images were retained; they total 3h 1m 59s logged. The exact edited writing is in [DEVLOG_RECORD.md](DEVLOG_RECORD.md). The new-post composer offered 14 minutes and required at least 15, so no additional post was created. Ship still opens the Changes requested panel. That time belongs only to Hand-in Kit. Reviewer acceptance and payout remain unverified.
