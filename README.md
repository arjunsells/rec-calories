# CHAD v11

Static, private nutrition and training PWA. Plain HTML/CSS/JavaScript, no build step, no CDN, nothing shipped beyond the local barcode reader and one pixel font. Everything you log stays in this browser. Everything is metric.

v11 is the "less is more" release: the same navy + gold look and the same motion, with far less to read and tap. Three tabs (**Today**, **Gym**, **Progress**), Settings behind a gear, and on Today one big line and **one thing to do now**.

## Today

Top to bottom, on Darwin time:

1. **The header**: the journey day (**Day 48** on 24 Nov 2026; Day 1 defaults to 8 Oct 2026, editable in Settings), the **journey streak** (🔥 48) and the **gear** (Settings).
2. **The line**: **kcal left** and **protein left**, big, with a bar each ("215 kcal over", "5 g protein over" when past the goal). One tap opens the details **in place** (never a sheet): carbs left, fat left, what was eaten (kcal, P, C, F), the phase, and the food you logged that day. Each food opens with **Log again** and **Delete** (Undo for both).
3. **The one thing to do now**, filling the first screen down to the tab bar, its buttons at thumb height:

   | Darwin time | The one thing |
   |---|---|
   | before 11 am | **Water**: one big button, +500 mL a tap (lunch once the water goal is hit) |
   | 11 am – 4 pm | **Lunch**: Strict, Medium, Free, the two go-tos pinned first: **Nando's ½ PERi chicken** 715 kcal / 108 P / 1.1 C / 30.8 F and **Gochi + 4 Nando's tenders** 445 / 71.4 / 25.9 / 9.1, one tap each. Lunch in: water, then the session if you are early |
   | 4 – 6:30 pm | **The session**: today's workout with one big **Start** (Resume mid-workout); Wednesday **Muay Thai** at 6:30 pm, Sunday **Rest + walk**, each with one Done. Session done: dinner |
   | after 6:30 pm | **Dinner**: three options, Strict → Medium → Free, the best fit for what is left marked **Best fit**. Then the **snack** while protein is still 20 g or more short, then water, then the **wrap-up** (10k steps, sleep, Hydralyte), then **All done** |

   Another day (swipe left or right, or the arrow keys; **Today** brings you back) shows its first meal still to log. A meal you just logged holds its place for a beat with a gold tick, then the next thing rises into it. Option cards show the name, kcal and protein; long-press one for what is in it and how to make or order it. Yesterday's pick says **Same as yesterday**.
4. **One scroll down** (nothing here competes with the first screen):
   - under a meal: **Same as yesterday** for a custom meal, your **saved meals** for that meal (one tap; tap the logged one to remove it; long-press for what is in it or to remove it from your meals), and **+ Custom**;
   - **Later today**: one quiet row. **Water** is one tap on it, any time of day; the rest of the day (the session, the other meals with their three options and + Custom, cardio, steps, sleep, Hydralyte) folds open in place;
   - **Quick log**: the favourites, one tap each, a second tap is a second one (×2): **YoPRO Perform pouch** 120 kcal / 20.1 P / 6.8 C / 1.2 F and **Gochi noodle meal** 225 / 31.8 / 25.2 / 2.6; in the Reset and Bulk phases their add-ons; and **+ Food** for anything else.

Gone from Today: the score ring and grade, levels and XP, the + button and its menu, the Quick add sheet, the week strip and calendar button, the always-on habit chips, the remaining-today line under each meal (the big line replaces it), how-to text on the cards (long-press), and the separate "Other food" list (the details hold all of the day's food).

## Adding food: one sheet

**+ Custom** on a meal builds that meal; **+ Food** logs anything else. Same sheet, in this order:

1. the running total (kcal, P, C, F) and the items, each with **½ · 1 · 2** (or grams − / +) and remove;
2. **Recent**: what you logged off the plan in the last 60 days and what went into custom meals, most often first;
3. **Favourites**: this meal's saved meals, the Quick log favourites, then the foods here (Nando's, roast chook, potatoes, YoPRO, eggs, Woolworths premade and more);
4. **Search**: the foods here at once, Open Food Facts after a pause;
5. **More ways**: **Ask AI** (a photo and/or words through your proxy), **Barcode**, or **Type it**. Each opens the same editable card (name, weight, kcal, P, C, F; change the weight and the rest follows) and **Add to meal** brings it back.

**Log** fills the meal (or logs other food) with Undo in the toast; **Save** keeps a meal as a one-tap favourite on that meal. Every step inside the sheet (add, portion, remove, save) has its own Undo and Redo, and the meal being built survives closing the sheet or the app. Sheets open one at a time: a sheet never opens on top of another.

## Gym

**The Gym tab** shows the selected day's session from Perfect Week v1 (Mon Push + 2 km Zone 2; Tue Pull + 30–40 min incline walk; Wed Muay Thai only, 6:30 pm; Thu Delts + Arms + 2 km Zone 2; Fri Upper chest + Back + 30–40 min incline walk; Sat Hill sprints + Legs; Sun rest + 45–60 min walk): each exercise with sets × reps, rest and the last set (a tap shows the hint, the best set and the history), **Start workout** for today, **Mark done** for a session done without logging sets, and the cardio. Then the rest of the week (a tap opens that day) and **Plan and rules** (gym 4–6 pm with cardio after, focus, rules, deload weeks 28 Dec–3 Jan, 8–14 Feb, 22–28 Mar, 3–9 May, the Perfect Week v2 review on 20 Dec).

**Gym mode** is unchanged apart from the XP: full screen, always dark and high contrast, every control 56 px or more and the main button 72 px, all at the bottom. One exercise at a time with the progressive-overload hint ("Last 12.5 kg × 10 → try 11 reps, then 15 kg"), kg and reps filled in from last time, **Log set** in one tap (haptic tick), the rest timer (60–120 s, +15 s, Skip; true time through a locked screen), Prev and Next, **Finish** with volume, time, sets and records (confetti, no XP). The screen stays awake (Wake Lock), it works offline, and a closed app comes back to the same exercise.

## Progress

The journey streak and the water streak, **Workouts** (date, session, volume, duration, records; a tap shows every set), **Records** (each exercise's best set with its estimated 1RM, Epley) and four charts over 7 or 30 days: calories against the goal, protein, the 7-day weight average and water. No levels, XP, score, weekly rank, heatmap, badges or past-entries list.

## Settings (the gear)

A view of its own (no tab lights up; **Done** goes back): the theme (Auto, Light, Dark), sounds and haptics; goals and Day 1 (with presets per phase); the selected day's weigh-in, water and **Missed day** (the only thing that breaks the streak); phase dates; **AI estimates** (status, Test, Disconnect, paste the setup link; "Other ways to connect" holds a proxy URL of your own, a token and your own key); export a backup; a short How it works.

## Reversible everything

Every change shows a toast with **Undo** for six seconds, and Undo offers **Redo**. Each change is stored as two functions of the journal (forward and backward) that touch only their own fields, so Undo restores the exact previous journal and a newer unrelated edit (another tab included) survives it. Covered: meals (log, switch, remove, Same as yesterday, custom and saved meals, saving and removing a saved meal; inside the sheet every add, portion and remove), water, the favourites, + Food, every habit, Muay Thai, Mark done, a missed day, Gym mode (start, each set, a set removed, the finish), deleting and logging again, Reset/Bulk add-ons, Settings (water, weigh-in, goals and Day 1, phase dates, the AI settings).

Accidental taps are handled: a second tap on the same control within 400 ms is a slip; after a log moves the thing to do on, the card on top ignores touches until the move is done (so a double tap on lunch never also adds the water that takes its place); the Undo button arms after 350 ms, and after Undo or Redo the page under the toast ignores touches for 400 ms; after an action closes a sheet the page ignores touches for 400 ms. Journey milestones (every full week, 3, 30, 50, 100… days) are celebrated once.

## Metric and macros

Everything is metric: kg, g, L, mL, kcal. Open Food Facts portions keep only their metric part ("1 cup (240 ml)" becomes "240 mL"). kcal and protein are on the line and every option; carbs and fat are one tap away on the line, in every food row, the card and the add-food sheet.

## AI photo estimates

No key or token is ever in this repository. **Ask AI** (in the add-food sheet) sends a photo and/or a sentence to an estimator and shows the answer as one editable card.

1. **The CHAD proxy (built in).** Its address is in `scan9.js` (an address is not a secret). Nothing is sent to it until this device has its **access token**, which arrives once in a setup link and is kept only in this browser, never shown again, never in a backup or a log.

   ```
   POST <proxy>/estimate   Content-Type: application/json   X-Chad-Token: <token>
   { "image": "data:image/jpeg;base64,…" | null, "text": "200 g chicken and potatoes", "hint": (same), "units": "metric" }

   200 { "name": "Roast chicken and potatoes", "grams": 350, "kcal": 520, "protein_g": 66, "carbs_g": 42, "fat_g": 7.7,
         "confidence": 0.93, "items": [{ "name": "Roast chicken", "grams": 200, "kcal": 330, … }] }
   GET  /health -> { "ok": true }          no token, no AI
   ```

   `protein` / `carbs` / `fat` and `"portion": "150 g"` are accepted too. Photos are resized on the phone to 1024 px (long edge), JPEG 0.8, and are held in memory only (the thumbnail leaves the card the moment it is added). The client gives up after 100 s. Errors: 401 "AI needs setting up again" with a button to the setup link field; 413 "That photo is too big"; 429 "The AI needs a breather"; 503 says so and retries once after 3 s; 502 and other 5xx "The AI couldn't finish that one" with **Try again**; no connection "AI is offline". Every error keeps **Search**, **Barcode** and **Type it** (the words go along).
2. **Setup link.** `https://arjunsells.github.io/rec-calories/#ai=<encoded proxy URL>&k=<token>`. On load the link is saved, wiped from the address bar with `history.replaceState`, and a quiet "AI connected" toast (with Undo) appears. A link to the built-in proxy connects without a question; a link to any other address, opened from outside the app, asks first. A link with only `#k=<token>` is for the built-in proxy. The home-screen app has its own storage, so **Settings › AI estimates › Paste setup link** takes the whole link, just the hash, or `ai=…&k=…`; the field is masked and emptied at once.
3. **Settings › AI estimates.** A status line (Not set up, Set up, Connected, Offline, Set up again, Own key), **Test** (GET /health, then an empty POST that the proxy turns away with 400 before any AI runs, or 401 when the token is wrong) and **Disconnect** (with Undo). "Other ways to connect" holds a proxy URL of your own (https, or loopback http for testing), a token field, and your own OpenAI key as the hidden fallback.
4. **Route.** The proxy once a token (or an address of your own) is saved; otherwise your own OpenAI key; otherwise no request at all, and the sheet still works: say what it is, then Search, Barcode or Type it.
5. **[`docs/proxy-example.js`](docs/proxy-example.js)** is a small Cloudflare Worker for the same contract if you ever want a hosted proxy: the provider key is an encrypted Worker secret, CORS allows only your Pages origin, an optional token, JSON only, image type and size checks, 10 requests a minute per IP and an optional daily cap.

Proxy URL, token and key live under their own `localStorage` keys (`chad.aiProxyUrl`, `chad.aiProxyToken`, `rec-calories-ai-key`) and are never in the journal or a backup. On the PC that runs the proxy, its name resolves to a tailnet address, which Edge and Chrome there treat as the local network: they ask before a public page may reach it. A phone on mobile data reaches the proxy through its public address.

## What v11 changed

Cut or changed:

- **Tabs**: Today, Gym (was Training), Progress. Settings is the gear on Today, a view with Done.
- **Today**: one big line (kcal and protein left; carbs, fat and the food on tap, in place) and **one thing to do now** by Darwin time (water, lunch, the session 4–6:30 pm, dinner, the snack, the wrap-up), filling the first screen; everything else one scroll down in **Later today** (one row; water one tap) and **Quick log**.
- **Favourites**: YoPRO Perform pouch and Gochi noodle meal, one tap each on Today.
- **Points clutter removed**: the score ring and grade, levels, XP (toasts, floaters, the level card and dialog, Gym mode's XP), the weekly rank, the score chart, the heatmap, S-rank and ring-closed celebrations. The scoring rules still run underneath (the data means what it meant) and stored XP stays stored; nothing shows them.
- **Fewer controls**: no + button, add sheet, Quick add sheet, week strip, calendar button, past-entries list or per-meal remaining line. Fewer words: no how-to text on cards, shorter help.
- **One add-food sheet**: recent → favourites → search → Ask AI / Barcode / Type it, without the meal switch, the name field or the AI text box (names are made from whole food names). Search moved into the sheet.
- **48 px targets everywhere** (Gym mode keeps 56/72), WCAG AA in both themes on every screen and sheet (the card's unit labels and the Delete button were darkened).
- **Fixes found on the way**: a quick double tap on a meal could land on the card that took its place; AI items added to a meal kept rounded per-gram rates (640 kcal could log as 640.2); the card now drops its photo the moment it is added or logged.

**Less on screen** (`node scripts/v11-button-count.cjs`: visible buttons, links and inputs on Today at 393x852 with iPhone safe areas, the same synthetic day served by the shipped v10 from Git and by v11, first screen / full scroll):

| Darwin time | v10 | v11 |
|---|---|---|
| morning, nothing logged | 9 / 15 | **6 / 10** |
| midday, nothing logged | 9 / 15 | **8 / 14** |
| gym window, 2 meals logged | 10 / 14 | **6 / 11** |
| evening, 2 meals logged | 9 / 19 | **8 / 14** |

**Taps**: the usual lunch 1; water 1 at any time of day; one set in Gym mode 1; YoPRO Perform pouch 1; Gochi noodle meal 1 (v10: 3 taps and 5 typed fields through Quick add).

## Food lookup reliability

Open Food Facts sheds anonymous traffic with intermittent 503 pages that carry no CORS headers, so any single request can fail. CHAD answers from memory or `localStorage` (`rec-calories-food-cache-v1`, 24 searches and 40 barcodes, safe to delete) when it can; otherwise it tries `au…/cgi/search.pl`, then `world…`, backs off 0.6 s and tries both again, backs off 1.3 s and tries `world` once more (6 s timeout each, 15 s overall), then search-a-licious (probed at most once a day), then `au…/api/v2/search` keeping only real name matches, and finally an honest note in the add-food sheet ("Offline", "isn't answering", "Saved on this device"). Typing searches after a 450 ms pause, a newer keystroke cancels the request in flight, and offline nothing is sent: the foods here and Type it still work. Barcodes retry across `world` and `au` and are cached for 30 days.

## Data and the v10 → v11 migration

The journal is still `rec-calories-v1`, schema 5 with `questsV5`; v11 changes no shape. The first time v11 opens a journal it has not written yet, it keeps one untouched copy of it under **`rec-calories-v10-backup`** (written once, never overwritten), and from then on writes **`appVersion: 11`**. Every v10 field and device key is read as it is and never removed: entries, picks (`S`/`M`/`F`/`C`), water, habits, `missed`, `weight`, workouts (`{ id, start, end?, sets: [{ x, kg, reps, at }] }`), `myMeals`, goals and phases, theme, sounds and haptics, `legacyRewards` (the XP of pre-v5 journals, kept but not shown), and the device keys `chad.gym`, `chad.builder`, `chad.streakSeen`, `rec-calories-theme`, the AI keys and the food cache. v10 can still read what v11 writes (proved by `v11-migration-check`). New in v11: a favourite's entry has `source: 'favourite'` and `fav: '<id>'`.

The scoring kept from v5–v10 still defines the data (proved identical to the shipped v9 on random journals): meal tiers 3 / 2 / 1, custom 1; from 24 Nov 2026 the day's session counts like a fourth Strict pick; protein 210 g, the water target and 10k steps. Nothing on screen shows it.

Every runtime file that changed has a new name: `theme11.css`, `plan11.js` (the plan and the favourites), `quest11.js` (the screens), `gym11.js`, `builder11.js`, `ux11.js`, `app11.js`; `icons8.js`, `motion8.js`, `charts8.js`, `scan9.js`, `food9.js`, `game10.js` and `train10.js` are byte-identical to v10. The offline shell is `rec-calories-shell-v11`. Page and assets always come from the same cache generation; a newer worker reloads a freshly opened page once, or offers "Update ready" if you are mid-task. Bump `CACHE` in `sw.js` with every release.

## Verification

```powershell
# Tooling lives outside the repository:
npm install --prefix "$env:TEMP/chad-browser-qa" playwright
node scripts/run-all.cjs
```

Seventeen deterministic suites (`BROWSER_EXECUTABLE` and `PLAYWRIGHT_MODULE` override the local Edge and Playwright paths):

| Suite | Covers |
|---|---|
| `check` | the journal in Node: the line, its details, Type it, favourites, Undo/Redo, v4/v7/v10 journals kept (only `appVersion` added, the byte-for-byte backup, device keys untouched), unreadable data, full storage; the journey streak; OFF normalisation; the exact v11 shell; three tabs and the gear; no XP/rank/level UI; metric-only text; no keys or setup links |
| `v11-secret-scan` | every committed or committable file: no token, key, JWT or bearer token, no setup link with a token, the proxy address only once (in `scan9.js`), no tunnel host or tailnet IP, web hosts allowlisted, no PIN, no body measurement, no medication or dose, no photo or embedded image, no private file, no email address |
| `scan-check` | the AI client: routes, URL rules, setup links, the contract both ways, failures, timeout vs cancel, health and token check |
| `quest-check` | the plan (exact go-tos), the favourites (the same in the add-food sheet), best fit, remaining, Same as yesterday, the hidden scoring (equal to the shipped v9), the streak 48, the one thing to do now at each time, Perfect Week v1, deloads, workout maths |
| `food-check` | the Open Food Facts retry chain, cache, offline, cancellation, barcodes (stubbed network) |
| `v11-migration-check` | a realistic v10 dataset made by the shipped v10 (47 days, workouts and records, a saved meal, an open workout, a draft, settings, a missed day, an own key) opened by v11 with zero loss, the same streak, workouts, records and settings, Resume; v10 reads it back |
| `browser-check` | food flows through the add-food sheet: Ask AI without AI, barcode, search, the food list, Type it, an own key (photo, text, failures), legacy data, offline |
| `regression-check` | every tab: a perfect day's totals, Gym tab, Progress (four charts, theme repaint, no points clutter), phases and add-ons, deload, theme, Gym mode, the offline shell |
| `v11-browser-check` | Today at 8 am, noon, 4:30 pm and 7 pm (and Wednesday, Sunday, a deload week), the line and its details, the first screen, Later today, Quick log, + Food, days, the gear, a missed day, the time of day changing live, offline |
| `v11-undo-check` | 30 Undo paths with the exact journal back; accidental double taps; Undo/Redo rounds; milestones once; no XP or score on screen |
| `v11-meals-check` | the go-tos, Best fit, Same as yesterday, and the add-food sheet end to end (recent, favourites, portions, search, Ask AI, barcode, Type it, Save, Log, the draft, + Food, no AI) with Undo and Redo |
| `v11-workout-check` | Gym mode end to end from the session card: every set, the rest timer through a locked screen, Wake Lock, resume offline, finish (no XP), history and records, Undo/Redo |
| `v9-ai-check` | a mock proxy and the built-in address: setup links, Settings, the analysing card, the editable card, every failure, timeout, backups without AI settings, the small-phone card; the Worker example under Node |
| `v11-design-check` | 393x852 and 375x667, light and dark, with and without safe areas: 48 px targets, WCAG AA for every visible text on every screen and sheet, no horizontal scroll, nothing spills, the first screen, dock pixels, Gym mode 56/72 px |
| `v11-motion-check` | animations on: haptics, counting, the held tick and the next thing rising, pops, the details, toasts, sheets (close, drag), day swipe, tabs, Gym mode, preferences |
| `sw-update-check` | the real upgrade from the shipped v10 worker (from Git), offline, the next release |
| `v11-button-count` | first screen and full scroll on Today in v10 (from Git) and v11 at four times of day (fewer than 9, fewer than v10), and the taps for lunch, water, a set, YoPRO and Gochi noodle |

`node scripts/off-live-check.cjs` is an opt-in live diagnostic of the food endpoints. `node scripts/v9-ai-live-check.cjs` is the opt-in live check of Ask AI against the real CHAD proxy. `node scripts/v11-screenshots.cjs` renders a disposable copy with synthetic data into the sibling `rec-calories-shots` folder (v11-today, v11-gym, v11-dinner-pick, v11-custom, v11-progress, v11-dark at 375x812; `--review` for more screens in both themes into the ignored `.qa/v11-review`).

Fixtures exist only in disposable browser storage; screenshots and test storage are outside the repository. The suites make no real AI request and use no user profile, personal journal or credential. Emulation is Chromium with an iPhone user agent, not WebKit: a physical iPhone, the installed-PWA update flow, real cameras, iOS haptics, the iOS Wake Lock and a really locked screen, and the software keyboard need device checks.

Stable hooks: `#left-line` / `#left-more`, `#now[data-now]` (with `[data-meal-slot]`), `.meal-pick[data-slot][data-tier]` (with `[data-best]` and `[data-yesterday]`), `#after-now`, `[data-custom]`, `[data-again]`, `[data-my-meal]`, `#later`, `#later-toggle`, `#later-more [data-later-slot]`, `.water-row`, `#quick [data-fav]`, `#quick [data-addon]`, `#add-food`, `#open-settings`, `#close-settings`, `[data-gym-start]`, `.quest-chip[data-quest]`, `.training-level[data-day]`, `.training-row[data-day]`, `.exercise-row[data-exercise]`, `#gym` with `[data-gym]` controls, `#workouts [data-workout]`, `#records [data-record]`, `#entries [data-entry]`, `#builder-sheet` with `#builder-recent`, `#builder-chips [data-food]`, `#builder-items [data-item]`, `#builder-search`, `#builder-results [data-result]`, `#builder-ask-go`, `#builder-barcode`, `#builder-type`, `#builder-save`, `#builder-log`, `#builder-undo`, and the sheet ids.

[V6-UX.md](V6-UX.md) and [V7-UX.md](V7-UX.md) are the earlier interaction handoffs.
