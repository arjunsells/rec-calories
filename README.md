# REC Calories

A tiny offline calorie and protein tracker for Real Estate Central. Plain HTML, CSS, and JavaScript; no framework, build step, remote fonts, analytics, or runtime dependencies.

## Use

Open https://arjunsells.github.io/rec-calories/ once online. On iPhone Safari, use Share → Add to Home Screen. Offline access is ready after the service worker finishes installation; its status appears in Settings.

Add calories with an optional name and protein amount. Tap recent or frequent entries to add them again. Delete entries from Today, review the last seven days in History, and change the default 1,800 kcal target in Settings. Dates use the device's local timezone. The ring shows calories eaten toward the target and clearly labels an excess.

Data is stored only in this browser's localStorage, under `rec-calories-v1`. There is no sync or backup. Clearing browser data removes entries; private browsing may not persist them. The app ships with no entries or personal data.

## Development

Serve this directory with `python -m http.server 8080` and open `http://localhost:8080`. Secure contexts (HTTPS or localhost) are required for service workers. All app paths are relative for GitHub Pages subdirectory hosting.

Regenerate the three PNG icons with `python scripts/generate_icons.py` (Python standard library only). Increment the cache version in `sw.js` when changing the app shell. GitHub Pages publishes the `main` branch root.

See [BRANDING.md](./BRANDING.md) for brand provenance.
