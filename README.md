# CHAD

Fuel your next level. A private, mobile-first food journal with equal calorie/protein rings, daily quests, XP, levels, streaks, grades and badges. Original navy/gold visual identity; plain HTML, CSS and JavaScript with no build step.

Open https://arjunsells.github.io/rec-calories/ in Safari and use Share → Add to Home Screen. The repository and install identity remain unchanged. Settings shows when offline logging is ready.

## Logging

SNAP opens photo or text estimates with your own OpenAI key, plus free barcode scanning and packaged-food search using Open Food Facts. Search prefers Australian products, then falls back worldwide. ZXing supports browser barcode decoding without BarcodeDetector. Camera use requires HTTPS and permission; manual barcode digits are also supported.

Review estimates, choose a meal, adjust 0.5×–2× portions, copy a summary, then tap Log it. Packaged foods use serving nutrition when available; otherwise enter grams against the 100 g basis (check liquid units on the pack). Past entries have Log again. Manual entry is below the home screen rings and quest card.

Defaults are Cut: 1,900 kcal / 220 g protein / 150 g carbs / 45 g fat (24 Nov–6 Dec 2026). Reset is 2,700/200/320/70; Bulk is 3,000/200/370/80. Existing saved goals are preserved. These are configurable personal targets, not a nutrition prescription.

## Progress

Each entry earns 10 XP. Daily quests reward protein (30 XP), three distinct meals (30 XP), and a photo or barcode log (20 XP). Completed days within 10% of calories earn 50 XP, plus 25 XP for protein. S = within 10% and protein; A = within 10%; B = within 20%; C = outside 20%. Today is provisional. Rewards derive from logs and current goals, so edits/deletions recalculate without duplicate awards.

Streaks count consecutive logged days, with yesterday keeping the streak alive until today ends. Six levels and seven badges reward consistency. Every log has XP feedback/bounce; new levels have a full-screen celebration. Motion and vibration respect reduced-motion preferences. Theme follows system light/dark mode.

## Data and services

Data remains in localStorage `rec-calories-v1`; schema 4 migrates existing data without wiping entries, goals or extra fields. Unreadable saved data pauses saving to protect it. Old photo thumbnails are pruned after seven days; logs remain. The OpenAI key uses the existing device-only `rec-calories-ai-key` storage key. No key is bundled. Only chosen photos/descriptions go to OpenAI; free food queries go to Open Food Facts. Network services require internet; offline manual logging/history/settings use `rec-calories-shell-v4`.

Food data: [Open Food Facts](https://world.openfoodfacts.org), ODbL. Local barcode bundle: @zxing/browser 0.1.5, MIT; license/provenance in `vendor/`. No analytics, account or sync. Clearing browser data removes history.

## Validation

Run `node scripts/check.cjs` and `node scripts/scan-check.cjs`. Browser integration: install Playwright outside this repo (`npm install --prefix "$env:TEMP/chad-browser-qa" playwright`), then `node scripts/browser-check.cjs`. Uses installed Edge by default; override `BROWSER_EXECUTABLE` or `PLAYWRIGHT_MODULE` as needed. Browser tests exercise real OFF search and AU barcode 9300652010794, mock AI responses, storage migration, portions, offline shell and mobile light/dark. Screenshots go outside this repo to sibling `rec-calories-shots` (override `CHAD_SHOTS`). Real AI estimates need a user key; physical iPhone camera scanning/haptics and home-screen update behavior require device testing.

Icons are original CHAD text marks generated with `python scripts/generate_icons.py`. Deploy by pushing main to GitHub Pages. Never add credentials, personal logs, test screenshots, or local dependency folders.
