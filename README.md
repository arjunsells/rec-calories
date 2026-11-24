# CHAD v10

Static, private nutrition and training PWA. Plain HTML/CSS/JavaScript, no build step, no CDN, nothing shipped beyond the local barcode reader and one pixel font. Everything you log stays in this browser. Everything is metric.

## Today, on Darwin time

Today opens on the journey day (**Day 48** on 24 Nov 2026; Day 1 defaults to 8 Oct 2026 and is editable in Settings) with the **journey streak** beside it, then the rings card (calories, protein, score, carbs and fat). Below it, only what matters now is big; everything else is one quiet line that opens in place with a tap:

| Darwin time | Big |
|---|---|
| before 11 am | water, with lunch next |
| 11 am – 3 pm | lunch (once it is in, dinner moves up with what is left today) |
| 3 – 6 pm (gym 4–6 pm) | today's session with one big **Start**, water below |
| after 6 pm | dinner and the wrap-up (steps, sleep, Hydralyte, cardio and how the day went), then the optional snack; on Wednesday, Muay Thai at 6:30 pm first |

Another day in view shows its next meal and keeps everything else on quiet lines. Swipe left or right (or use the arrow keys, or the calendar button's week strip) to change day; Today brings you back. Anything you log goes to the day on screen.

- **Meals: Arjun's real day.** Lunch, then the gym 4–6 pm, then **dinner** (after the gym, the biggest meal), then an optional high-protein **snack** that closes the gap to the goals (1,900 kcal / 220 P / 150 C / 45 F by default). No breakfast and no pre-gym meal. Each meal has exactly three options, in the order **Strict** (plain food bought or cooked at home, five ingredients at most, microwave or batch prep), **Medium** (an easy takeaway or supermarket premade) and **Free** (Uber Eats). Lunch pins the two one-tap go-tos first (★): **Nando's ½ PERi chicken** as Strict, 715 kcal / 108 P / 1.1 C / 30.8 F (nandos.com.au), and **Gochi + 4 Nando's tenders** as Medium, 445 / 71.4 / 25.9 / 9.1; then Uber Eats. Dinner: roast chook & spuds, steak & mash + spuds, or a Nando's ½ chicken & pita on Uber Eats. Snack: YoPRO × 2, a protein shake, or tenders on Uber Eats. Every option shows its name, kcal, protein/carbs/fat in grams and how to make or order it in at most three steps. A typical day (the ½ chicken, the Strict dinner, the Strict snack) is 1,908 kcal / 225 P / 140 C / 49 F.
- **Smart bits.** **Remaining today** under the meal shows what is left of the goals in kcal and P/C/F. Once anything is logged, the option that fits what is left best (kcal and protein, counting the snack still to come) says **Best fit**: after the ½ chicken lunch, the Strict dinner. Yesterday's pick says **Same as yesterday** on its card (one tap logs it again); a meal yesterday that is not on today's cards (a custom one) gets its own **Same as yesterday** button. Tap to log, tap the logged (gold) option to remove it, tap another to switch (never a duplicate). Long-press an option for what is in it.
- **+ Custom**, under every meal, builds a meal from foods for the day the plan doesn't happen. Tap first: quick picks (your recent and frequent foods first, then Nando's, roast chook, Gochi, YoPRO, eggs, potatoes, Woolworths premade and more) add a portion with one tap, and each item has **½ · 1 · 2** (or grams − / +) and a remove button. **Search** looks through those foods at once and Open Food Facts after a pause. **Ask AI** sends words (type, or tap the keyboard's mic) and/or a photo to your proxy; the answer opens in the same editable card as Snap + Say and **Add to meal** brings it back. A running kcal and P/C/F total stays at the top. **Log** fills the meal (it counts as that meal; Undo in the toast), and **Save as my meal** keeps it as a one-tap ★ on that meal next time (long-press it to see what is in it or remove it). Every step in the builder (add, portion, remove, save) has Undo and Redo right in the sheet, and the meal being built survives closing the sheet or the app.
- **Water.** One tap adds a 500 mL bottle, again and again, past the goal if you like. The goal reads in words ("2 L to go", "Goal hit") and the flame shows the days in a row on target. Undo takes a bottle back; Settings › Selected day sets an exact amount.
- **Done chips.** Cardio (the day's: 2 km Zone 2, an incline walk, hill sprints, the Sunday walk), 10k steps, sleep, Hydralyte and Muay Thai are one tap on, one tap off, each worth XP.
- **The session card.** Push, Pull, Delts + Arms, Upper chest + Back or Sprints + Legs, with the number of exercises and 60 min; Muay Thai at 6:30 pm on Wednesday; Rest + walk on Sunday. Deload weeks say so. **Start** opens Gym mode; mid-workout it says **Resume** with the sets done; afterwards it shows time, volume, sets and records.
- **The journey streak.** Every day from Day 1 up to today counts, today included, logged or not: 24 Nov 2026 reads 48. The only things that break it are a day you mark as missed (Settings › Selected day › Missed day, with Undo) and a Day 1 that is still to come. Full weeks and 30/50/100/… days are celebrated once.

## Gym mode

The guided workout, full screen, always dark and high contrast, built for one hand: every control is at least 56 px, the main button 72 px or more, all at the bottom of the screen.

- One exercise at a time: name, sets × reps and rest, the progressive-overload hint ("Last 12.5 kg × 10 → try 11 reps, then 15 kg": add reps first, then weight, stop 2 reps before failure) and big set dots.
- kg and reps are filled in from last time (the best set of the last session) or from the set just done; ±2.5 kg and ±1 rep steppers, or type. Bodyweight moves take added kg; hill sprints take seconds.
- **Log set** (or the next dot) logs it with a haptic tick, the dot fills, and the rest timer starts: 60–120 s by exercise, a ring that runs down, **+15 s** and **Skip**, a buzz (and a beep with Sounds on) when it is over. It counts from timestamps, so it keeps true time while the screen is locked. A logged dot taps off again.
- When an exercise is done the next one slides in; Prev and Next (or a sideways swipe) move freely. **Finish** shows the XP, volume (kg × reps), duration, sets, any personal records and the cardio that comes next, with confetti. Finishing with nothing logged simply ends it.
- The screen stays awake (Screen Wake Lock) while Gym mode is open and takes the lock again whenever the page comes back. It works offline. Closing the app mid-workout loses nothing: it opens straight back on the same exercise, rest timer included. ⌄ minimises it; Today then offers Resume.

## Training and Progress

**Training** shows the day's session from Perfect Week v1 (Mon Push + 2 km Zone 2; Tue Pull + 30–40 min incline walk; Wed Muay Thai only, 6:30 pm; Thu Delts + Arms + 2 km Zone 2; Fri Upper chest + Back + 30–40 min incline walk; Sat Hill sprints + Legs; Sun rest + 45–60 min walk): each exercise with sets × reps, rest and the last set, opening its history and best set; Start for today; **Mark done** for a session done without logging sets. Then the rest of the week as rows, and the plan: gym 4–6 pm with cardio straight after, focus (side delts, upper chest, lats, traps), the rules, the deload weeks (28 Dec–3 Jan, 8–14 Feb, 22–28 Mar, 3–9 May: half the sets, same weights, Muay Thai easy) and the Perfect Week v2 review on 20 Dec.

**Progress** has level and XP, the journey streak, the water streak and the week's rank; **Workouts** (date, session, volume, duration, records; a tap shows every set); **Personal records** (each exercise's best set with its estimated 1RM, Epley); then the 7/30-day charts, the 13-week heatmap and past entries. There are no badges: the streak, the Day counter, the score, levels and XP are the rewards.

## Reversible everything

Every change shows a toast with **Undo** for six seconds, and Undo offers **Redo**. Each change is stored as two functions of the journal (forward and backward) that touch only their own fields, so Undo restores the exact previous journal, a newer unrelated edit (another tab included) survives it, and XP, levels, streaks, score and bonuses (all worked out from the journal) come back exactly, never counted twice. Covered: meals (log, switch, remove, Same as yesterday, a custom meal, a saved meal, saving and removing a saved meal; inside the builder every add, portion and remove), water, every done chip on and off, Muay Thai, Mark done, a missed day, Gym mode (start, each set, a set removed, the finish), deleting, logging again, quick add, barcode/search/photo logs, Reset/Bulk add-ons, water and weigh-in in Settings, goals and Day 1, phase dates, and the AI settings. Changes to another day say so in the toast ("Push done · Yesterday"); in Gym mode the toast comes down from the top.

Accidental taps are handled: a second tap on the same control within 400 ms is a slip; after a log moves the meals, cards ignore touches until the move is done; the Undo button arms after 350 ms, and after Undo or Redo the page under the toast ignores touches for 400 ms (so a double tap never lands on what is under the shrinking toast); after an action closes a sheet the page ignores touches for 400 ms. Celebrations (S rank, level, journey milestones, the 17/17 confetti) happen once.

## Metric and macros

Everything is metric: kg, g, L, mL, kcal. Food data from Open Food Facts keeps only the metric part of a serving ("1 cup (240 ml)" becomes "240 mL"). Calories, protein, carbs and fat are on the rings card, on every meal option (kcal plus P/C/F), in every meal and entry sheet, in the review sheet and in search results.

## AI photo estimates

No key or token is ever in this repository. **Snap + Say** sends a photo and/or a sentence to an estimator and shows the answer as one editable card.

1. **The CHAD proxy (built in).** Its address is in `scan9.js` (an address is not a secret). Nothing is sent to it until this device has its **access token**, which arrives once in a setup link and is kept only in this browser, never shown again, never in a backup or a log.

   ```
   POST <proxy>/estimate   Content-Type: application/json   X-Chad-Token: <token>
   { "image": "data:image/jpeg;base64,…" | null, "text": "200 g chicken and rice", "hint": (same), "units": "metric" }

   200 { "name": "Grilled chicken and rice", "grams": 350, "kcal": 520, "protein_g": 66, "carbs_g": 42, "fat_g": 7.7,
         "confidence": 0.93, "items": [{ "name": "Chicken breast", "grams": 200, "kcal": 330, … }] }
   GET  /health -> { "ok": true }          no token, no AI
   ```

   `protein` / `carbs` / `fat` and `"portion": "150 g"` are accepted too. Photos are resized on the phone to 1024 px (long edge), JPEG 0.8, and are held in memory only. The client gives up after 100 s. Errors: 401 "AI needs setting up again" with a button to the setup link field; 413 "That photo is too big"; 429 "The AI needs a breather"; 503 says so and retries once after 3 s; 502 and other 5xx "The AI couldn't finish that one" with **Try again** and Quick add; no connection "AI is offline. Describe it or use Quick add / barcode." Every error keeps Search, Barcode and Quick add (the words go along).
2. **Setup link.** `https://arjunsells.github.io/rec-calories/#ai=<encoded proxy URL>&k=<token>`. On load the link is saved, wiped from the address bar with `history.replaceState`, and a quiet "AI connected" toast (with Undo) appears. A link to the built-in proxy connects without a question; a link to any other address, opened from outside the app, asks first. A link with only `#k=<token>` is for the built-in proxy. The home-screen app has its own storage, so **Settings › Advanced › Paste setup link** takes the whole link, just the hash, or `ai=…&k=…`; the field is masked and emptied at once.
3. **Settings › Advanced › AI photo estimates.** A status line (Not set up, Connected, Offline, Set up again, Own key), **Test** (GET /health, then an empty POST that the proxy turns away with 400 before any AI runs, or 401 when the token is wrong) and **Disconnect** (with Undo). "Other ways to connect" holds a proxy URL of your own (https, or loopback http for testing; a URL without a path posts to /estimate), a token field, and your own OpenAI key as the hidden fallback.
4. **Route.** The proxy once a token (or an address of your own) is saved; otherwise your own OpenAI key; otherwise no request at all, and the camera flow still works: take or choose a photo, say what it is, then Search, Barcode or Quick add.
5. **The card.** Name, weight (g), kcal, protein, carbs and fat, all editable; one tap on **Log it** logs (Undo/Redo as everywhere). Changing the weight scales kcal and P/C/F from the answer's per-gram rates; a number typed straight in overrides its rate, and later weight changes scale from it. Confidence sits quietly under the name; the breakdown is folded under "What's in it" and left out when it only repeats the meal. The photo thumbnail is shown from memory and dropped when the card closes. Barcode and search results use the same card (per serving or per 100 g).
6. **[`docs/proxy-example.js`](docs/proxy-example.js)** is a small Cloudflare Worker for the same contract if you ever want a hosted proxy: the provider key is an encrypted Worker secret, CORS allows only your Pages origin, an optional token, JSON only, image type and size checks, 10 requests a minute per IP and an optional daily cap.

Proxy URL, token and key live under their own `localStorage` keys (`chad.aiProxyUrl`, `chad.aiProxyToken`, `rec-calories-ai-key`) and are never in the journal or a backup.

On the PC that runs the proxy, its name resolves to a tailnet address, which Edge and Chrome there treat as the local network: they ask before a public page may reach it, and a headless test browser simply blocks it. A phone on mobile data reaches the proxy through its public address, and so does the live check.

## What v10 changed

Pass 2 (Arjun's items F–I):

- **Meals for the real day**: no breakfast and no pre-gym meal; lunch with the two go-tos pinned, dinner as the big meal after the gym, an optional snack; Remaining today, Best fit and Same as yesterday (above). Earlier days keep their picks: a pass-1 breakfast would show under Other food, a v9 pre-gym pick as that day's snack.
- **+ Custom meal builder** with quick picks, search, Ask AI, a running total, Save as my meal and Undo/Redo throughout (above).
- **Colour**: navy + gold from the icon. Light is a cool porcelain page with white cards and a soft navy lift; dark is a deep navy night (no longer pure black) with cards that catch a little light. One colour per metric everywhere (rings, bars, P/C/F, charts, the builder): kcal ember-pink, protein green, carbs amber, fat violet, water azure, score gold. Rings glow in both themes, the hero card carries a faint ember and gold aura, tier stripes and best-fit tags are gradients. Every visible text meets WCAG AA in both themes (checked by `v10-design-check`); the two options beside a logged one now step back with a flatter card instead of fading their text.
- **No badges**: the badge list, the Progress shelf, "Badge unlocked" toasts and the backup's badge field are gone. Streak, Day counter, score, levels and XP stay.

Pass 1:

- **Time-aware Today**, one session card with one **Start**, and **Gym mode** with the rest timer, overload hints, records and Wake Lock (above).
- **Meals**: exactly three options per meal with how to make or order them (pass 2 reshaped the day: above). Earlier days keep their picks: a v9 pre-gym pick shows as that day's snack, a v9 dessert under Other food, and the score of every earlier day is unchanged.
- **The journey streak** replaces the logged-days streak.
- **Less on screen.** Visible buttons, links and inputs on Today at 393x852 with iPhone safe areas (`node scripts/v10-button-count.cjs`, the same synthetic day served by the shipped v9 and by v10), first paint / full scroll: morning **17 → 10** / **19 → 15**; midday **17 → 10** / **19 → 15**; gym window **18 → 10** / **21 → 15**; evening **18 → 9** / **21 → 19**. Gone: the ⓘ buttons, the water − button and the five always-on habit chips. Taps: logging water is still 1; start + one set + finish is 3 (v9 had no workout: its closest path, a top set and Complete session, took 4 taps and 2 typed fields).
- **Look.** The v9 design language, rings, gold "done", springs and toasts, with the new Gym mode, the vertical Strict/Medium/Free cards with a tier stripe, quiet lines with icons, done chips, depth on the session card, and tidy empty states.

## Food lookup reliability

Open Food Facts sheds anonymous traffic with intermittent 503 pages that carry no CORS headers, so any single request can fail. CHAD answers from memory or `localStorage` (`rec-calories-food-cache-v1`, 24 searches and 40 barcodes, safe to delete) when it can; otherwise it tries `au…/cgi/search.pl`, then `world…`, backs off 0.6 s and tries both again, backs off 1.3 s and tries `world` once more (6 s timeout each, 15 s overall), then search-a-licious (probed at most once a day; it sends no CORS headers today), then `au…/api/v2/search` keeping only real name matches, and finally saved results or an honest "unavailable" / "offline" state with Try again and Quick add. Typing searches after a 450 ms pause, a newer keystroke cancels the request in flight, and offline nothing is sent. Barcodes retry across `world` and `au` and are cached for 30 days.

## Scoring and data

Scoring keeps the v9 rules, proven identical to the shipped v9 on random journals for every day before 24 Nov 2026 (days, weeks, and everything in stats except the streak): meal tiers earn 3 / 2 / 1 points (the best four count); protein at 210 g earns 2; the water target earns 2; 10k steps earns 1. Maximum 17. S starts at 15, A at 12, B at 9. From 24 Nov 2026 the plan has three meals, so the day's session counts like a fourth Strict pick: 3 points when done (the workout finished or marked done; Wednesday, Muay Thai; Sunday, the walk). Three Strict meals + the session + protein + water + steps is still 17. A custom meal (the builder or a saved one) earns 1, like Free, but is not a Free pick. A complete Mon–Sun (every meal of every day logged: four picks a day before 24 Nov, three from then) with at most two Free picks earns the weekly +10. XP: 10 for each meal, done chip, litre of water and session move (a done session counts all its moves), 5 for each logged set. Phases are Cut through 6 Dec 2026, Reset through 13 Dec, then Bulk; dates, manual phases and custom goals are editable.

The journal is still `rec-calories-v1`, schema 5, with `questsV5`; v9 journals need no migration and are rewritten unchanged. New day fields: `missed` (true) and `workout` (`{ id, start, end?, sets: [{ x, kg, reps, at }] }`, times in ms). Pass 2: a pick can be `C` (a custom meal in that slot; its entry has `source: 'custom'` and `parts: [{ name, amount, kcal, protein, carbs, fat, food? }]`), and saved meals live in the journal as `myMeals: [{ id, slot, name, macros, parts }]` (so a backup has them). The meal being built is device-only under `chad.builder`. Gym mode's screen state (exercise on screen, rest timer, typed kg and reps) is device-only under `chad.gym`, and `chad.streakSeen` remembers the last milestone shown.

Every runtime file that changed has a new name: `theme10.css`, `game10.js`, `plan10.js` (meals), `train10.js` (the program and the workout maths, also loaded by the Node tests), `quest10.js` (scoring and the screens), `gym10.js` (Gym mode), `builder10.js` (the custom meal builder and its foods, also loaded by the Node tests), `ux10.js`, `app10.js`; `icons8.js`, `motion8.js`, `charts8.js`, `scan9.js` and `food9.js` are byte-identical to v9. The offline shell is `rec-calories-shell-v10`. Page and assets always come from the same cache generation; a newer worker reloads a freshly opened page once, or offers "Update ready" if you are mid-task. Bump `CACHE` in `sw.js` with every release.

## Verification

```powershell
# Tooling lives outside the repository:
npm install --prefix "$env:TEMP/chad-browser-qa" playwright
node scripts/run-all.cjs
```

Fifteen deterministic suites (`BROWSER_EXECUTABLE` and `PLAYWRIGHT_MODULE` override the local Edge and Playwright paths):

| Suite | Covers |
|---|---|
| `check` | storage, v4/v7/v8 journals, reversible goals, entry sheet, the journey streak (48 on 24 Nov 2026, missed days, future Day 1), no badges, OFF normalisation and metric portions, metric-only text, no keys/tokens/setup links, the proxy address only in `scan9.js`, exact shell manifest, opaque icons, a plain-vector header mark |
| `scan-check` | AI client: routes, URL rules, setup links, the contract both ways, typed gentle failures, timeout vs cancel, health and token check, own-key contract |
| `quest-check` | the meal plan (Lunch, Dinner, Snack and no breakfast or pre-gym; the lunch go-tos pinned with their exact macros; exactly Strict, Medium, Free per slot, macros that add up, how-to in ≤3 steps, Free = Uber Eats, no chicken breast/salad/rice/shellfish, a typical day on the goals, every dinner after either go-to), Best fit (cases and a brute-force check), Remaining today, Same as yesterday, the session's 3 points from 24 Nov and custom meals, scoring and grades, the streak 48 on 2026-11-24 (also with 40 of 48 days logged), Perfect Week v1 and deloads, the overload hint, last sets, volume, PRs, records, XP; v10 scoring equal to the shipped v9 on random journals |
| `food-check` | the OFF retry chain, cache, offline, cancellation, barcode retries, metric portions (stubbed network) |
| `browser-check` | Snap + Say without AI, barcode, search, entry sheet, recents, own-key AI flows, offline |
| `regression-check` | every tab: 17 = S (three Strict meals and the session), quiet lines, done chips, Training rows, history sheet, Mark done, journey and water streaks, workouts and records, charts, no badges, phases, deloads, settings, no overflow (Gym mode too), offline shell |
| `v10-browser-check` | Today at 8 am, noon, 4:30 pm and 7 pm (and Wednesday, Sunday, a deload week), no breakfast, meals and their how-to, the go-tos, Remaining today and Best fit, water, done chips, the streak and a missed day, days, Undo/Redo, recovery, offline |
| `v10-undo-check` | 27 Undo paths with exact journal, XP, streak and score (Gym mode included); accidental double taps; no XP farming; celebrations once |
| `v10-meals-check` | the three-meal day in the browser: lunch go-tos in one tap with exact macros, Remaining today, Best fit, Same as yesterday (a card and a custom meal); the builder end to end (quick picks, ½ · 1 · 2 and grams, remove, running total, search over the foods here and Open Food Facts, Ask AI through the built-in address answered in the browser into the editable card and back, Save as my meal, Log, the saved meal one tap / remove / long press, the draft across a reload, no AI) with Undo and Redo at every step |
| `v10-workout-check` | Gym mode end to end: Start → every set → rest timer (+15 s, Skip, a locked screen) → Finish → history and records → Undo/Redo; haptics, Wake Lock held and re-acquired, resume offline after a reload, 56/72 px targets |
| `v9-ai-check` | a mock proxy and the built-in address: setup links, Settings, the analysing card, uploads, the editable card, every failure, timeout, backups without AI settings; the Worker example under Node |
| `v10-design-check` | 393x852 and 375x667, DPR 3, light/dark, safe areas: WCAG AA contrast for every visible text (gradients and opacity composited), the builder sheet, 44 px targets (56/72 in Gym mode), nothing spills, how-to in full, no overflow, Gym mode clear of notch and home indicator, dock pixels |
| `v10-motion-check` | animations on: haptics, count-up, the next meal rising into place, sheet drag, day swipe, Gym mode entrance, set pop, rest ring, slide-in, finish trophy and confetti, preferences |
| `sw-update-check` | real upgrade from the shipped v9 worker (from Git), offline, and the next-release reload path |
| `v10-button-count` | Today controls in shipped v9 and pass 1 (both from Git) against the working tree at four times of day (fewer than v9, never more than pass 1), and the taps for the usual lunch, water, a set and a workout |

`node scripts/off-live-check.cjs` is an opt-in live diagnostic of the food endpoints. `node scripts/v9-ai-live-check.cjs` is the opt-in live check of Snap + Say against the real CHAD proxy (see the AI section). `node scripts/v10-screenshots.cjs` renders a disposable copy with synthetic data into the sibling `rec-calories-shots` folder (v10-today-midday, v10-today-gym, v10-today-dark, v10-workout-set, v10-rest-timer, v10-finish, v10-custom-builder, v10-water, v10-progress at 375x812, light with Today also in dark; `--review` for every screen in both themes into the ignored `.qa/v10-review`).

Fixtures exist only in disposable browser storage; screenshots and test storage are outside the repository. The suites make no real AI request and use no user profile, personal journal or credential. Emulation is Chromium with an iPhone user agent, not WebKit: a physical iPhone, the installed-PWA update flow, real cameras, iOS haptics, the iOS Wake Lock and a really locked screen, and the software keyboard need device checks.

[V6-UX.md](V6-UX.md) and [V7-UX.md](V7-UX.md) are the earlier interaction handoffs. Stable hooks: `.meal-pick[data-slot][data-tier]` (with `[data-best]` and `[data-yesterday]`), `#next-up`, `.ch-remaining`, `[data-custom]`, `[data-again]`, `[data-my-meal]`, `#builder-sheet` with `#builder-chips [data-food]`, `#builder-items [data-item]`, `#builder-search`, `#builder-results [data-result]`, `#builder-ask`, `#builder-save`, `#builder-log`, `#builder-undo`, `[data-meal-row]`, `[data-meal-toggle]`, `[data-row]` / `[data-fold]` (session, wrap), `#session-hero`, `#wrap-up`, `[data-gym-start]`, `.water-row`, `[data-water]`, `.quest-chip[data-quest]`, `.training-level[data-day]`, `.training-row[data-day]`, `.exercise-row[data-exercise]`, `#gym` with `[data-gym]` controls, `#workouts [data-workout]`, `#records [data-record]`, `#week-toggle`, `.entry-open`, and the sheet ids.
