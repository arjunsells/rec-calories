# CHAD v9

Static, private nutrition and training PWA. Plain HTML/CSS/JavaScript, no build step, no CDN, nothing shipped beyond the local barcode reader and one pixel font. Everything you log stays in this browser.

## Daily flow

Today opens on the journey day (**Day 48** on 24 Nov 2026, Day 49 on 25 Nov; Day 1 defaults to 8 Oct 2026 and is editable in Settings), then one card with the three rings, calories, protein and score, and a compact line with carbs and fat against their goals. Below it only the **next meal** is open: its Strict / Medium / Free cards, each with kcal and P/C/F. Tap a card to log it. Water and the five habits share one card. The other meals are quiet rows (logged: option and kcal; to come: their time); a tap opens a row in place with its three cards. Food that is not a plan meal is listed under **Other food**.

- **Meals.** Tap a card to log; tap the logged (gold) card to remove it; tap another card to switch (never a duplicate). The ⓘ beside a meal, or a long press on a card, opens one sheet per meal: the three options side by side, ingredients, all four macros with units, tip and swap, and one button that logs, switches or removes.
- **Water.** Tap the bottles to add 500 mL (repeat taps keep adding, even past the goal); the − beside them takes 500 mL off.
- **Habits.** Hydralyte, training, cardio, steps and sleep switch on and off with one tap. Training switched on leaves any ticked exercises alone, so switching it off gives back exactly what was ticked.
- **Days.** Swipe left or right, or use the arrow keys. The calendar button shows the week strip with each day's ring; tap a day to jump. Today brings you back. Anything you log goes to the day on screen.

Training shows the selected day's session with one-tap exercise rows and the last top set on its row; a details button appears only where there is a top set to record (long-press any exercise for its notes). The rest of the week is one row per day; a tap opens that day. Deload weeks halve sets.

The floating + opens Snap + Say, Barcode, Search and Quick add, plus the last few foods you logged for a two-tap repeat. Progress has level, XP, streak, weekly rank, 7/30-day charts, a 13-week heatmap, badges and past entries. Settings holds theme, sounds, haptics, Day 1, phase and goals, weigh-in and water for the day in view, phase dates, a local backup, and **Advanced** for photo estimates.

## Reversible everything

Every change shows a toast with **Undo** for six seconds, and Undo offers **Redo**. Each change is stored as two functions of the journal (forward and backward) that touch only their own fields, so:

- Undo restores the exact previous journal: the same fields, entries back in the same place, and containers it created removed again. XP, level, streak, score, weekly bonus and badges are worked out from the journal, so they come back exactly too, and toggling on and off (or Undo/Redo) can never add XP twice.
- A newer unrelated edit, even from another tab, survives an Undo.
- Covered: meals (log, switch, remove), water (+ and −), each habit on and off, exercises, complete/reopen session, top sets, deleting, logging again, quick add, barcode/search/photo logs, Reset/Bulk add-ons, water and weigh-in in Settings, goals and Day 1, phase dates, and the AI settings.
- Changes to another day say so in the toast ("Dinner logged · Yesterday").

Accidental taps are handled: a second tap on the same control within 400 ms is treated as a slip; after a log moves the meals, cards ignore touches until the move is done (so a double tap never logs the meal that slid under your finger); the Undo button arms after 350 ms (a double tap on Undo never hits the Redo that replaces it); and when an action closes a sheet, the page under it ignores touches for 400 ms. Celebrations (streak saved, S rank, level, badge, the 17/17 confetti) happen once per session however often a day is undone and redone.

## Metric and macros

Everything is metric: kg, g, L, mL, kcal (the plan's teaspoons are grams now, with unchanged macros). Food data from Open Food Facts keeps only the metric part of a serving ("1 cup (240 ml)" becomes "240 mL"). Calories, protein, carbs and fat are on the hero, on every meal card (kcal plus P/C/F), in every meal and entry sheet (four tiles with units), in the review sheet and in search results.

## AI photo estimates

No key is ever in this repository. The AI layer is pluggable and set per device in **Settings › Advanced › AI photo estimates**:

1. **Proxy (recommended).** A URL (empty by default) and an optional access token. CHAD posts JSON and expects JSON:

   ```
   POST <proxy URL>                 a URL with no path posts to /estimate
   Content-Type: application/json   X-Chad-Token: <token>  (only if one is saved)
   { "image": "data:image/jpeg;base64,…" | "<base64>" | null, "hint": "what you typed", "units": "metric" }

   200 { "name": "Chicken burrito bowl", "kcal": 640, "protein": 42, "carbs": 70, "fat": 18,
         "items": [{ "name": "Rice", "portion": "200 g", "kcal": 260, "protein": 5, "carbs": 57, "fat": 1 }],   optional
         "confidence": 0.7 }                                                                                    optional, 0..1
   GET  /health -> { "ok": true }   (the Test connection button; no token, no AI call)
   ```

   kcal for energy, grams for macros, metric portions. For proxies built to the same idea the request also carries `"text"` (the same words as `hint`) and the answer may use `protein_g`, `carbs_g`, `fat_g` and `grams`. A 503 is retried once after three seconds; the client waits up to 100 s. Photos are resized to 1024 px JPEG first and are never stored.
2. **[`docs/proxy-example.js`](docs/proxy-example.js)** is a small Cloudflare Worker for this contract: the provider key is an encrypted Worker secret, CORS allows only your Pages origin, an optional token, JSON only, image type and size checks, 10 requests a minute per IP (or a Workers Rate Limiting binding) and an optional daily cap. It sends the same prompt as the app.
3. **Setup link.** Opening `…/rec-calories/#ai=<encoded proxy URL>&k=<token>` reads the link once, wipes it from the address bar and asks before connecting. Pasting the same link into the proxy field works too (useful for the installed app, which has its own storage). The token is never shown again.
4. **Own OpenAI key (hidden fallback).** Under "Use my own OpenAI key instead". Used only when no proxy is set, kept only in this browser, sent only to OpenAI.

With neither, or when the estimator fails (offline, CORS, timeout, 4xx/5xx, unreadable answer, no food), nothing breaks: take or choose a photo, say what it is, and log it from Search (the words carry over), Barcode or Quick add, with plain, friendly copy. Proxy URL, token and key live under their own `localStorage` keys (`chad.aiProxyUrl`, `chad.aiProxyToken`, `rec-calories-ai-key`) and are never in the journal or a backup.

## What v9 changed

- **Less on screen.** Visible buttons, links and inputs on Today at 393x852 with iPhone safe areas (`node scripts/v9-button-count.cjs`, same synthetic data for both): a mid-evening day with two meals logged goes from **32 → 18** at first paint and **50 → 21** over the full scroll; an empty day from **26 → 17** and **44 → 19**. No more per-card info buttons, day arrows or always-on week strip, and plan meals are not listed twice.
- **Reversible everything**, metric only and all four macros, the pluggable AI layer: see above.
- **Look.** The v8 design language, theme tokens, rings, gold "done" states, motion and icon are unchanged.

## Food lookup reliability

Open Food Facts sheds anonymous traffic with intermittent 503 pages that carry no CORS headers, so any single request can fail. CHAD answers from memory or `localStorage` (`rec-calories-food-cache-v1`, 24 searches and 40 barcodes, safe to delete) when it can; otherwise it tries `au…/cgi/search.pl`, then `world…`, backs off 0.6 s and tries both again, backs off 1.3 s and tries `world` once more (6 s timeout each, 15 s overall), then search-a-licious (probed at most once a day; it sends no CORS headers today), then `au…/api/v2/search` keeping only real name matches, and finally saved results or an honest "unavailable" / "offline" state with Try again and Quick add. Typing searches after a 450 ms pause, a newer keystroke cancels the request in flight, and offline nothing is sent. Barcodes retry across `world` and `au` and are cached for 30 days.

## Scoring and data

Scoring is unchanged and proven identical to the shipped v8 on random journals: meal tiers earn 3 / 2 / 1 points; protein at 210 g earns 2; the water target earns 2; 10k steps earns 1. Maximum 17. S starts at 15, A at 12, B at 9. B or better keeps a streak. A complete Mon-Sun with at most two Free picks earns the weekly +10. Phases are Cut through 6 Dec 2026, Reset through 13 Dec, then Bulk; dates, manual phases and custom goals are editable.

The journal is still `rec-calories-v1`, schema 5, with `questsV5`. v8 and v7 journals need no migration and are rewritten unchanged; older entry fields, unknown extensions, legacy goals and rewards and unrelated storage keys are preserved. Unreadable journals pause writes; failed writes keep the saved journal. New device-only keys: `chad.aiProxyUrl` and `chad.aiProxyToken`.

Every runtime file that changed has a new name (`theme9.css`, `scan9.js`, `food9.js`, `plan9.js`, `quest9.js`, `ux9.js`, `app9.js`; `icons8.js`, `motion8.js`, `charts8.js` and `game.js` are byte-identical to v8), and the offline shell is `rec-calories-shell-v9`. Page and assets always come from the same cache generation; a newer worker reloads a freshly opened page once, or offers "Update ready" if you are mid-task. Bump `CACHE` in `sw.js` with every release.

## Verification

```powershell
# Tooling lives outside the repository:
npm install --prefix "$env:TEMP/chad-browser-qa" playwright
node scripts/run-all.cjs
```

Thirteen deterministic suites (`BROWSER_EXECUTABLE` and `PLAYWRIGHT_MODULE` override the local Edge and Playwright paths):

| Suite | Covers |
|---|---|
| `check` | storage, v4/v7/v8 journals, reversible goals, entry sheet, OFF normalisation and metric portions, metric-only text, no keys/tokens, exact shell manifest, opaque icons |
| `scan-check` | AI client: routes, URL rules, setup links, the proxy contract both ways, token header, gentle typed failures, busy retry, health, own-key contract |
| `quest-check` | scoring, phases, deloads, v9 scoring equal to shipped v8 on random journals, plan macros unchanged |
| `food-check` | the OFF retry chain, cache, offline, cancellation, barcode retries, metric portions (stubbed network) |
| `browser-check` | Snap + Say without AI, barcode, search, entry sheet, recents, own-key AI flows, offline |
| `regression-check` | every tab: 17 = S, rows, training and PRs, charts, badges, phases, settings, offline shell |
| `v9-browser-check` | fewer controls, one tap per action, week strip, arrow keys, real touch swipes, Day 48/49, rows opening in place, Undo/Redo, recovery |
| `v9-undo-check` | 28 Undo paths with exact journal, XP, streak and score; accidental double taps; no XP farming; celebrations once |
| `v9-ai-check` | a mock proxy on another origin: estimates, every failure's fallback, timeout, setup link, disconnect, own key, backups without AI settings; the Worker example under Node |
| `v9-design-check` | 393x852 and 375x667, DPR 3, light/dark, safe areas: 44 px targets, nothing spills, no overflow, dock pixels |
| `v9-motion-check` | animations on: haptics, count-up, the next meal rising into place, sheet drag, day swipe, confetti, preferences |
| `sw-update-check` | real upgrade from the shipped v8 worker (from Git), offline, and the next-release reload path |
| `v9-button-count` | Today controls in shipped v8 against v9 (first paint and full scroll) |

`node scripts/off-live-check.cjs` is an opt-in live diagnostic of the food endpoints. `node scripts/v9-screenshots.cjs` renders a disposable copy with synthetic data into the sibling `rec-calories-shots` folder (`--review` for every screen into the ignored `.qa/v9-review`). `node scripts/make-icons.cjs` redraws the app icon.

Fixtures exist only in disposable browser storage; screenshots and test storage are outside the repository. No real AI request, user profile, personal journal or credential is used. Emulation is Chromium with an iPhone user agent, not WebKit: a physical iPhone, the installed-PWA update flow, real cameras, iOS haptics, the software keyboard, a deployed proxy and live AI estimates need device checks.

[V6-UX.md](V6-UX.md) and [V7-UX.md](V7-UX.md) are the earlier interaction handoffs. Stable hooks: `.meal-pick[data-slot][data-tier]`, `#next-up`, `[data-meal-row]`, `[data-meal-toggle]`, `.water-row`, `.water-minus`, `[data-water]`, `.quest-chip[data-quest]`, `.training-level[data-day]`, `.training-row[data-day]`, `.exercise-toggle[data-exercise]`, `#week-toggle`, `.entry-open`, and the sheet ids.
