# CHAD v5

A personal arcade-style daily tracker, built with plain HTML, CSS and JavaScript. No build step, CDN, analytics, account or sync. Install from https://arjunsells.github.io/rec-calories/ using Safari → Share → Add to Home Screen.

## Daily quests

Today contains four meal slots: Lunch, Pre-gym (2:30–3 pm), Dinner and Dessert. Each has the three original meal-plan picks, exact source macros, quantities, flavour tips and swap fixes. Pick one to log its nutrition and tick the slot. Tap it again to undo; switch tiers without duplicating the meal. “Ate something else” opens Snap + Say. Off-card meals remain in the nutrition journal; meal points require a plan pick.

Meals score Strict 3 / Medium 2 / Free 1. Protein **210 g+** earns 2 points (the PDF's scoring threshold), water target earns 2, and 10k steps earns 1: max 17. The protein ring separately uses the phase target (220 g during Cut). S = 15–17, A = 12–14, B = 9–11, C = 0–8. Grade B+ saves the streak; yesterday keeps it alive while today is unfinished.

Water targets: Sunday 3.5 L, Monday–Friday 4.5 L, Saturday 5 L. Bottle taps, electrolyte, training, cardio, steps, sleep and optional local weigh-ins complete the checklist. Training includes every exercise in Perfect Week v1, individual/session ticks, optional top sets and PR feedback. Deload weeks automatically halve gym sets, rounding up. Recovery warnings and Sunday-only sauna/ice bath rules are shown.

Weekly ranks: Rookie <60, Grinder 60–84, Beast 85–104, Champion 105–119, AJ Mode 120+. A complete seven-day Mon–Sun meal checklist earns +10 only with at most two Free picks (max 129). Bonus stays pending until all seven days are complete. New badges include Protein Streak, Hydration Hero, Zero-Free Week, Fight Night Fuel and Perfect Day; all seven existing badges and six lifetime XP levels remain.

Legacy XP rules remain. Additional checklist XP derives from completed meal slots, bottles, exercises and side quests; undo recalculates it. Rewards earned before migration are retained as a floor. New levels keep the existing celebration. Optional square-wave chimes are OFF by default; theme follows the system with manual light/dark choices. Motion respects reduced-motion preferences.

## Phases and progress

Darwin local calendar dates drive automatic goals:

| Phase | Dates | kcal / P / C / F |
|---|---|---|
| Cut | Through 6 Dec 2026 | 1900 / 220 / 150 / 45 |
| Reset | 7–13 Dec 2026 | 2700 / 200 / 320 / 70 |
| Bulk | 14 Dec 2026–2 May 2027 | 3000 / 200 / 370 / 80 |

Edit phase end dates in Settings; manual phase/custom goals override automatic dates. Bulk goals continue after its end until edited. Reset displays separate daily-shake and extra-banana logging; Bulk displays bagel, wrap and shake logging. Add-on macros are approximate and are logged separately, so switching a meal cannot duplicate them. The shake contains 500 mL high-protein milk, 60 g oats and one banana.

Progress has 7-/30-day canvas calories-vs-goal bars, protein, water, scores, a rolling seven-day average of available optional weigh-ins, a 13-week heatmap, XP, levels and badges. Missing measurements are not invented.

## Preserved logging

Snap + Say supports photo/text estimates with your own OpenAI key. Free barcode/search uses Open Food Facts, preferring Australia before worldwide fallback. Local ZXing supports camera decoding. Review portions, log, copy a summary, repeat historical meals, delete entries or use manual entry. AI estimates and food lookup require internet. Camera access requires HTTPS and permission.

## Data and privacy

The existing localStorage key `rec-calories-v1` migrates to schema 5. Entries, thumbnails and unknown fields are preserved; v4 goals are retained in `legacyGoals`, and earned XP/badges in `legacyRewards`. Automatic phase goals apply by default. Old photo pruning and quota-driven photo deletion have been removed. Unreadable data or failed writes leave the original storage untouched. Measurements and optional top sets are stored only in localStorage. No user journal, measurement, photo, credential or source-input directory belongs in this public repository.

The existing `rec-calories-ai-key` stays device-only and is sent directly to OpenAI for requested estimates. Local backup export excludes it. Backups can contain private measurements/photos; keep them private. Clearing browser storage removes the journal.

Offline shell: `rec-calories-shell-v5b`. Manifest `id`, `start_url` and `scope` remain `./`.

## Assets and new files

New runtime files (all included in the service-worker shell):

- `theme.css` — supplied light/dark component kit and self-hosted pixel font.
- `sprites.js` — `CHADSprites` SVG sprite library; flame, tabs, camera and training muscles.
- `charts.js` — `CHADCharts` canvas bars, lines, heatmap and rings. Small integration extension: `barsVsGoal` accepts `opts.goals` for per-day phase/hydration targets.
- `plan-data.js` — 12 public meal-plan cards; the input folder itself is excluded.
- `quest.js` — v5 checklist, calendar, training, scoring, settings and CHADCharts integration.
- `fonts/press-start-2p.ttf` — self-hosted Press Start 2P from Google Fonts (SIL OFL).
- `fonts/OFL.txt` — font copyright and license.

New test files: `scripts/quest-check.cjs`, `scripts/v5-browser-check.cjs`. Existing app/browser tests were updated. No new dependencies are shipped. System fonts provide body text. Existing ZXing is MIT (`vendor/ZXING-LICENSE`). Font source: https://github.com/google/fonts/tree/main/ofl/pressstart2p. Meal data follows the supplied plan and includes its approximate takeaway values. External product data: Open Food Facts (ODbL).

The merge removes the old layered visual CSS and SVG chart renderer. `style.css` retains app layout, form/dialog behavior and adapters for the kit. No new runtime dependencies. The floating SNAP button remains available across tabs, hides during Snap + Say, and every view clears its bottom edge. Manual `data-theme` overrides and system theme changes redraw charts; daily values remain available in chart disclosure panels.

Merge file list: `index.html`, `app.js`, `quest.js`, `style.css`, `theme.css`, `sprites.js`, `charts.js`, `sw.js`, `README.md`, `scripts/check.cjs`, `scripts/browser-check.cjs`, `scripts/v5-browser-check.cjs`, `scripts/sw-update-check.cjs`. Screenshots remain in the sibling directory and are not committed.

Complete `shell-v5b` precache list (21 resources):

```text
./
index.html
style.css
theme.css
sprites.js
charts.js
app.js
game.js
plan-data.js
quest.js
fonts/press-start-2p.ttf
fonts/OFL.txt
scan.js
food.js
vendor/zxing-browser.min.js
vendor/ZXING-LICENSE
vendor/README.md
manifest.webmanifest
icons/apple-touch-icon.png
icons/icon-192.png
icons/icon-512.png
```

## Validation and release

Run:

```powershell
node scripts/check.cjs
node scripts/scan-check.cjs
node scripts/quest-check.cjs
# Install tooling outside this repository if needed:
npm install --prefix "$env:TEMP/chad-browser-qa" playwright
node scripts/browser-check.cjs
node scripts/v5-browser-check.cjs
node scripts/sw-update-check.cjs
```

Browser tests use installed headless Edge at 430×932; override `BROWSER_EXECUTABLE` / `PLAYWRIGHT_MODULE` if needed. Food and AI requests are mocked by default; `CHAD_LIVE_FOOD=1` enables live OFF checks. Synthetic fixtures verify v4 migration including old thumbnails and goals, 17=S, undo/switch, streaks, calendar phases, add-ons, deload, training/PR, optional weigh-in persistence, theme/settings, charts, 320/430/680 overflow, reduced motion and offline fonts/scanner. The v5b checks also compare rendered chart pixels across manual theme changes, verify weekday hydration goals and complete shell contents, and confirm the final row clears SNAP on all tabs in light and dark. Screenshots go to sibling `rec-calories-shots`, never the repository.

The worker-upgrade check verifies v5 → v5b cache replacement, offline kit loading, and journal preservation in Edge.

Physical iPhone camera scanning, haptics, actual audio playback and installed-PWA update behavior require device testing. Real OpenAI estimates require a user key and are not exercised by automated tests. Open Food Facts can be unavailable; failures preserve manual logging.

Deploy by pushing `main` to GitHub Pages, then check index, manifest, worker, scripts, stylesheet and font with cache-busting requests. Never add credentials, personal logs, screenshots or local dependencies.
