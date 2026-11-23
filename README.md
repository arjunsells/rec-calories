# REC Calories

A tiny offline calorie and protein tracker for Real Estate Central. Plain HTML, CSS, and JavaScript; no framework, build step, remote fonts, analytics, or runtime dependencies.

## Use

Open https://arjunsells.github.io/rec-calories/ once online. On iPhone Safari, use Share → Add to Home Screen. Offline access is ready after the service worker finishes installation; its status appears in Settings.

Add calories with an optional name and protein amount. Tap recent or frequent entries to add them again. Delete entries from Today, review the last seven days in History, and change the default 1,800 kcal target in Settings. Dates use the device's local timezone. The ring shows calories eaten toward the target and clearly labels an excess.

Data is stored only in this browser's localStorage, under `rec-calories-v1`. There is no sync or backup. Clearing browser data removes entries; private browsing may not persist them. The app ships with no entries or personal data.

## Property journey

Logging stays the same: submit Quick add or tap a recent item once. Each log earns 10 XP. After local midnight, a logged day within 10% of your calorie target earns 50 XP, with 25 extra XP for reaching protein. The protein goal defaults to 180 g and is editable alongside calories in Settings.

Grades are S (within 10% and protein reached), A (within 10%), B (within 20%), or C (outside 20%). Today's grade is provisional. Empty days receive no grade or XP. Streaks count consecutive days with logs; yesterday's streak remains active until today ends.

Six levels run from Open Home Rookie to Agency Legend at 0, 100, 300, 700, 1,400 and 2,500 XP. Seven badges reward first log, 25 logs, 3/7/30-day streaks, protein and a completed S day. Level and badge celebrations animate only when reduced motion is not requested.

Progress is derived from all saved entries using current goals. Deleting entries or editing goals recalculates rewards, including historical rewards. Future-dated logs do not earn rewards until that day. Existing storage is migrated in memory and written with schema version 2 on the next successful save, retaining original entries and fields. Unreadable data is left intact and saving is paused. No separate XP ledger or personal data is shipped.

## Development

Serve this directory with `python -m http.server 8080` and open `http://localhost:8080`. Secure contexts (HTTPS or localhost) are required for service workers. All app paths are relative for GitHub Pages subdirectory hosting.

Regenerate the three PNG icons with `python scripts/generate_icons.py` (Python standard library only). Increment the cache version in `sw.js` when changing the app shell. GitHub Pages publishes the `main` branch root.

See [BRANDING.md](./BRANDING.md) for brand provenance.

Run `node scripts/check.cjs` for dependency-free regression checks covering logging, persistence, migration, game rules, streak boundaries, levels, safe rendering, storage failures, manifest/icons, and shell cache v2. Run `node --check app.js`, `node --check game.js`, and `node --check sw.js` for syntax checks.

Browser release checks: at a mobile viewport, try a legacy synthetic history, a new log, one-tap repeat, deletion, goal edit/reload, level and badge celebrations, reduced-motion mode, and offline reload after the service worker takes control. Check for overflow and JavaScript errors. Use synthetic data only.
