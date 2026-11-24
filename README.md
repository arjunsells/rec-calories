# CHAD v8

Static, private nutrition and training PWA. Plain HTML/CSS/JavaScript, no build step, no CDN, nothing shipped beyond the local barcode reader and one pixel font. Everything you log stays in this browser.

## Daily flow

Today opens on the journey day (**Day 48** on 24 Nov 2026; Day 1 defaults to 8 Oct 2026 and is editable in Settings), a week strip, three progress rings and the next meal. Every slot shows its Strict / Medium / Free cards directly: tap a card to log it, tap again to remove it, tap another tier to switch without duplicating. What is still to do leads; logged slots fold down below it. The info button or a long press opens ingredients, macros, tips and swaps, and can log from there.

Water adds 500 mL per tap (a tap on a full row removes 500 mL). Hydralyte, training, cardio, steps and sleep are one-tap chips. Every change shows a six-second Undo toast, including deleting a journal entry. The big numbers are whole; exact values stay in the journal, the detail sheets and the accessibility labels.

Change day with the arrows, a tap on the week strip, or a horizontal swipe on Today or Training (the page follows your finger). Meals, quests, quick adds, food results and repeats always go to the day in view. Browsing another day computes that day's phase goals without overwriting saved goals.

Training puts the selected day's session first with one-tap exercise rows; the last top set shows on its row and the detail sheet saves top sets and announces personal records. The rest of the week is below. Deload weeks halve sets.

The floating + opens Snap + Say (photo or text estimate with your own OpenAI key), Barcode, Search and Quick add, plus the last few foods you logged for a two-tap repeat. Progress has level, XP, streak, weekly rank, 7/30-day charts, a 13-week heatmap, badges and past entries. Settings holds theme, sounds, haptics, journey start, phase and goals, the key, phase dates, weigh-in and water for the day in view, and a local backup.

## What v8 changed

- **Look and layout.** One stylesheet (`theme8.css`). The floating tab bar and + sit on a scrim that is solid page colour behind them and a short blurred fade above, so content never shows through or looks clipped, in either theme. The page ends clear of that fade.
- **Motion** (`motion8.js`): spring physics baked into Web Animations, count-up numbers, spring ring fill with a glow when a ring closes, a tick that is seen in place before the list closes ranks, pixel confetti for 17/17, levels and records, sheets you can drag down (rubber band, velocity, scroll hand-off) and that leave with an animation, a sliding tab pill, and a side-by-side push between days. State always changes first; motion only decorates. `prefers-reduced-motion` turns all of it off.
- **Haptics**: `navigator.vibrate` where it exists; on iOS a hidden switch control is toggled for the system tick. Switch in Settings.
- **Speed.** Scoring reuses one date formatter and indexes entries by day, and only the tab on screen is rebuilt. With six months of synthetic history a tap went from about a second of work to a few dozen milliseconds on a throttled CPU. Scoring results are proven identical to v7.
- **Food search** (`food8.js`): see below.
- **Offline shell** `rec-calories-shell-v8`: page and assets always come from the same cache generation (instant launch, never a new page with old scripts); a newer worker reloads a freshly opened page once, or offers "Update ready" if you are mid-task. The barcode reader (395 kB) now loads on first use.

## Food lookup reliability

Open Food Facts sheds anonymous traffic with intermittent 503 pages that carry no CORS headers, so in a browser any single request fails often. v8 therefore:

1. answers from memory or `localStorage` (`rec-calories-food-cache-v1`, 24 searches and 40 barcodes at most, safe to delete) when the same thing was looked up before;
2. otherwise tries `au.openfoodfacts.org/cgi/search.pl`, then `world…/cgi/search.pl`, backs off 0.6 s and tries both again, backs off 1.3 s and tries `world` once more (6 s timeout each, 15 s overall);
3. then `search.openfoodfacts.org/search` (search-a-licious). **It sends no `Access-Control-Allow-Origin` header today, so browsers cannot read it**; it is probed at most once a day and moves to the front of the queue if that ever changes;
4. then `au…/api/v2/search`, which ignores search terms, so only real name matches are kept;
5. and finally shows saved results if any, or an honest "unavailable" / "offline" state with Try again and Quick add (the typed name is carried over).

Typing searches after a 450 ms pause, a newer keystroke cancels the request in flight, and offline nothing is sent at all. Barcodes retry across `world` and `au` and are cached for 30 days.

## Scoring and data

Scoring is unchanged: meal tiers earn 3 / 2 / 1 points; protein at 210 g earns 2; the water target earns 2; 10k steps earns 1. Maximum 17. S starts at 15, A at 12, B at 9. B or better keeps a streak. A complete Mon-Sun with at most two Free picks earns the weekly +10. Phases are Cut through 6 Dec 2026, Reset through 13 Dec, then Bulk; dates, manual phases and custom goals are editable.

The journal is still `rec-calories-v1`, schema 5, with `questsV5`. v7 data needs no migration and is rewritten unchanged; older entry fields, unknown extensions, legacy goals and rewards and unrelated storage keys are preserved. Unreadable journals pause writes; failed writes keep the saved journal. Undo restores only the affected fields or slot. New, additive keys: `haptics` in the journal, `rec-calories-theme` (paints the chosen theme before first frame) and the food cache above. The device-only AI key keeps its key and is excluded from backups.

Every runtime file that changed has a new name (`theme8.css`, `icons8.js`, `charts8.js`, `motion8.js`, `food8.js`, `quest8.js`, `ux8.js`, `app8.js`), so the first launch after an update is already consistent even while the previous worker is still in control. Bump `CACHE` in `sw.js` with every release.

## Verification

```powershell
# Tooling lives outside the repository:
npm install --prefix "$env:TEMP/chad-browser-qa" playwright
node scripts/run-all.cjs
```

Ten deterministic suites (`BROWSER_EXECUTABLE` and `PLAYWRIGHT_MODULE` override the local Edge and Playwright paths):

| Suite | Covers |
|---|---|
| `check` | storage, v4 and v7 journals, legacy rewards, OFF normalisation, shell manifest, opaque icons |
| `scan-check` | mocked AI request contract and failures |
| `quest-check` | scoring, phases, deloads, and v8 scoring equal to shipped v7 on random journals |
| `food-check` | the OFF retry chain, cache, offline, cancellation, barcode retries (stubbed network) |
| `browser-check` | barcode, search, recents, repeat, delete/undo, manual, mocked AI, offline |
| `regression-check` | every tab: 17 = S, training and PRs, charts, badges, phases, settings, offline shell |
| `v8-browser-check` | one tap per action, Day 48, week strip, real touch swipes, undo, recovery |
| `v8-design-check` | 393x852 and 375x667, DPR 3, light/dark, safe areas: 44 px targets, no overflow, dock pixels |
| `v8-motion-check` | animations on: haptics, count-up, reorder, sheet drag, day swipe, confetti, preferences |
| `sw-update-check` | real upgrade from the shipped v7 worker, offline, and the next-release reload path |

`node scripts/off-live-check.cjs` is an opt-in live diagnostic of the food endpoints from the deployed origin. `node scripts/v8-screenshots.cjs` renders a disposable copy with synthetic data into the sibling `rec-calories-shots` folder (`--review` for every screen). `node scripts/make-icons.cjs` redraws the app icon.

Fixtures exist only in disposable browser storage; screenshots and test storage are outside the repository. No real AI request, user profile, personal journal or credential is used. Emulation is Chromium with an iPhone user agent, not WebKit: a physical iPhone, the installed-PWA update flow, real cameras, iOS haptics, the software keyboard and live AI estimates need device checks.

[V6-UX.md](V6-UX.md) and [V7-UX.md](V7-UX.md) are the earlier interaction handoffs; the stable hooks they list (`.meal-pick[data-slot][data-tier]`, `.water-row`, `[data-water]`, `.quest-chip[data-quest]`, `.training-level[data-day]`, `.exercise-toggle[data-exercise]`, the sheet ids) are unchanged.
