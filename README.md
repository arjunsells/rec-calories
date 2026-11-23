# REC Calories

A tiny offline calorie and protein tracker for Real Estate Central. Plain HTML, CSS, and JavaScript; no framework, build step, remote fonts, analytics, or runtime dependencies.

## Use

Open https://arjunsells.github.io/rec-calories/ once online. On iPhone Safari, use Share → Add to Home Screen. Offline access is ready after the service worker finishes installation; its status appears in Settings.

Add calories with an optional name and protein amount. Tap recent or frequent entries to add them again. Delete entries from Today, review the last seven days in History, and change the default 1,800 kcal target in Settings. Dates use the device's local timezone. The ring shows calories eaten toward the target and clearly labels an excess.

Data is stored only in this browser's localStorage, under `rec-calories-v1`. There is no sync or backup; scans optionally send a chosen photo to OpenAI as described below. Clearing browser data removes entries; private browsing may not persist them. The app ships with no entries or personal data.

## Property journey

Logging stays the same: submit Quick add or tap a recent item once. Each log earns 10 XP. After local midnight, a logged day within 10% of your calorie target earns 50 XP, with 25 extra XP for reaching protein. The protein goal defaults to 180 g and is editable alongside calories in Settings.

Grades are S (within 10% and protein reached), A (within 10%), B (within 20%), or C (outside 20%). Today's grade is provisional. Empty days receive no grade or XP. Streaks count consecutive days with logs; yesterday's streak remains active until today ends.

Six levels run from Open Home Rookie to Agency Legend at 0, 100, 300, 700, 1,400 and 2,500 XP. Seven badges reward first log, 25 logs, 3/7/30-day streaks, protein and a completed S day. Level and badge celebrations animate only when reduced motion is not requested.

Progress is derived from all saved entries using current goals. Deleting entries or editing goals recalculates rewards, including historical rewards. Future-dated logs do not earn rewards until that day. Existing storage is migrated in memory and written with schema version 3 on startup and successful saves, retaining original entries and fields. Unreadable data is left intact and saving is paused. No separate XP ledger or personal data is shipped.

## Development

Serve this directory with `python -m http.server 8080` and open `http://localhost:8080`. Secure contexts (HTTPS or localhost) are required for service workers. All app paths are relative for GitHub Pages subdirectory hosting.

Regenerate the three PNG icons with `python scripts/generate_icons.py` (Python standard library only). Increment the cache version in `sw.js` when changing the app shell. GitHub Pages publishes the `main` branch root.

See [BRANDING.md](./BRANDING.md) for brand provenance.

Run `node scripts/check.cjs` for dependency-free regression checks covering logging, persistence, migration, game rules, streak boundaries, levels, safe rendering, storage failures, manifest/icons, and shell cache v3. Run `node --check app.js`, `node --check game.js`, and `node --check sw.js` for syntax checks.

Browser release checks: at a mobile viewport, try a legacy synthetic history, a new log, one-tap repeat, deletion, goal edit/reload, level and badge celebrations, reduced-motion mode, and offline reload after the service worker takes control. Check for overflow and JavaScript errors. Use synthetic data only.

## Photo scan (v3)

Today has a one-tap route to Scan. In Settings, paste your own OpenAI API key into the masked **AI key** field and save. The app ships without a key. It stores your key separately in localStorage (`rec-calories-ai-key`) only in that browser on your device. Saving a blank field removes it. No backend, account creation, or shared credentials are involved.

The camera input uses `accept="image/*" capture="environment"` for mobile Safari and installed home-screen use. The browser controls the camera/library chooser. Photos are resized client-side to a maximum 1024px JPEG and sent directly to `https://api.openai.com/v1/chat/completions`, using `gpt-4o-mini`, JSON mode and `store: false`. OpenAI API billing and provider data policies apply. Scan requires internet; manual entry and saved history work offline.

Review and edit each food name, estimated amount, calories and protein/carbs/fat, choose a meal, then tap **Log meal**. Amount is descriptive; changing it does not automatically scale nutrition. Estimates are approximate. The app validates the JSON and recomputes the total. Missing keys, rejected keys, usage limits, connection failures, timeouts, unreadable photos and malformed estimates show messages with manual entry available.

Only a small 96px JPEG thumbnail is stored with the first food of a scanned meal, avoiding duplicate images. The full photo is never persisted. Thumbnails older than seven local calendar days are removed on startup, daily rollover and saves. If storage fills, saving retries without thumbnails while retaining food logs. Schema v3 keeps the existing `rec-calories-v1` key, preserves historical fields, treats absent carb/fat values as zero for display, and groups legacy entries under Snacks. All existing reward rules remain in `game.js`.

The bottom tabs are Today, Scan, Progress (history, journey and badges), and Settings. Carb and fat bars use reference amounts of 50% and 30% of calorie goal respectively; protein uses the configured goal.

New files in v3: `scan.js` (vision request, validation and image compression), `scripts/scan-check.cjs` (mocked API tests), and `scripts/browser-check.cjs` (mobile browser integration tests). `sw.js` caches the complete app shell including `scan.js` under `rec-calories-shell-v3`; cross-origin API traffic is never cached.

Run `node scripts/check.cjs` and `node scripts/scan-check.cjs`. For browser checks, install Playwright locally with `npm install --prefix .qa playwright` (ignored by Git), then run `node scripts/browser-check.cjs`. The browser script defaults to the Windows Edge executable; set `BROWSER_EXECUTABLE` to override. All fixtures are synthetic and all API calls are intercepted; no real key or paid request is used. Physical iPhone camera and installed-app behavior still need a device check.
