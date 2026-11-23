# v6 UX local pass

This branch keeps the v5 theme and assets. The separate `rec-calories-design6` directory was not read or changed. `ux.js` supplies structure and interactions for a later design-kit merge.

- Today has calorie, protein and quest-point rings, followed by Next up. The existing plan slots follow Darwin time: Lunch before 14:00, Pre-gym 14:00–18:00, Dinner 18:00–21:00, Dessert after 21:00. Strict is the initial choice; tier selection never logs a meal. Tapping the displayed meal logs it once; its logged card can undo or switch tiers under Today's meals.
- Once the current slot is logged, Next up promotes water, then the next unchecked daily quest. Water adds 500 mL per tap; Adjust water includes undo, the original absolute-volume controls and hydration timing guidance.
- The floating plus opens Camera, Barcode, Search and Quick add. AI photo/text estimates, barcode camera/digits, portion review, food repeats/deletion and optional manual macros remain available. Meal tips and top-set/PR forms use bottom sheets.
- Settings groups appearance/sound/phase dates, goals/AI key, scoring and backup. Weekly rank moves to Progress. Safe-area padding, keyboard focus, native modal dismissal, reduced motion and 44px action targets remain supported.
- `rec-calories-v1`, schema version 5, quest records, reward fields, AI-key storage and unknown extension fields retain their formats. No personal journal, measurements, photos or credentials were used as fixtures. Synthetic data and screenshots stay in isolated browser contexts / the OS temporary directory.
- Service-worker shell version is `rec-calories-shell-v6-ux`, including `ux.js`. The upgrade test starts with a synthetic v5b cache and verifies offline access and unchanged journal contents after upgrade.

## Open Food Facts

Search tries world v2, world CGI, AU v2 and AU CGI, each with a 4.5-second timeout, encoded `search_terms`, explicit nutrition fields and 20 results. Failed/unreadable requests and empty/incomplete results fall through. A v2 response that ignores the query is rejected rather than shown as an unrelated match. Exhausted endpoints offer Quick add.

Live headless Edge requests from the GitHub Pages origin on 24 November 2026 showed intermittent CORS behavior:

- World and AU CGI returned HTTP 200 with real UP&GO products and `Access-Control-Allow-Origin: *`.
- World and AU v2 each returned HTTP 200 with `*` on some requests, but their popular-food results ignored `search_terms`.
- All four endpoints also failed on some requests; Edge reported missing `Access-Control-Allow-Origin` headers.
- The actual local v6 `CHADFood.search('up&go')`, injected into an isolated GitHub Pages browser context, successfully returned UP&GO products through fallback on one run. A later full-suite live check reproduced missing CORS headers on the actual search; Quick add recovery remains necessary. This does not establish reliable upstream availability.

No client-side change can repair missing CORS headers on OFF's servers. All four failures have a tested manual-entry recovery. No proxy, API key or hosted service was added.

## Validation

Run each `scripts/*check.cjs` with Node. Browser scripts use Playwright installed outside this repository (default `%TEMP%/chad-browser-qa/node_modules/playwright`) and headless Edge. `off-live-check.cjs` is a network diagnostic: it reports upstream unavailability explicitly; deterministic OFF failure-path assertions live in `food-fallback-check.cjs` and `v6-browser-check.cjs`.

Coverage includes v5 migration and unknown fields, scoring/17-point cap, streaks/rewards, all meal tiers, undo/switch/persistence, phases/add-ons, training/PR/deload, charts and theme redraw, isolated 390×844 mobile flows, alternate device timezone, cross-tab updates, repeated sheet opening, mocked AI success/error paths, CORS/timeout fallback, offline reload and service-worker upgrade. Physical camera hardware and a paid live AI request were not exercised.
