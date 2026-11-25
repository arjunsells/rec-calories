# CHAD v12

Static, private nutrition and training PWA. Plain HTML/CSS/JavaScript, no build step, no CDN, nothing shipped beyond the local barcode reader and one pixel font. Everything you log stays in this browser.

v12 is the photo release: take a photo of food and get the calories. The look is a clean canvas (white in light mode, true black in dark), huge bold numbers, big rounded cards and very few words; navy and gold are the only accents. Three tabs (**Today**, **Gym**, **Progress**) and a round **+** in the middle of the tab bar that opens the camera; Settings stays behind the gear. Light and dark, every target at least 48 px, WCAG AA text, the motion kept (and switched off by reduced motion).

## Today

Top to bottom, on Darwin time:

1. **The header**: the journey day (**Day 48** on 24 Nov 2026; Day 1 defaults to 8 Oct 2026, editable in Settings), the **journey streak** (48) and the **gear**.
2. **The week strip**: Monday to Sunday around the day in view. A tap opens that day (swiping left or right and the arrow keys still work; **Today** brings you back). The day in view is filled, days with food logged have a solid ring, the others a dashed one.
3. **The hero card**: **calories left**, big, with its ring (a flame in the middle), and the phase underneath ("Cut · 12d left"). Past the goal it says **Calories over**. A tap shows what was **eaten** instead (on all four cards), a second tap goes back.
4. **Protein, carbs and fat left**: three small cards, each with its ring.
5. **Water**: one card, one tap = +500 mL (a pip per bottle, Undo in the toast; "Water goal hit" on the last one). Water is never the "thing to do now" any more: it has its own card all day.
6. **The one thing to do now**: lunch until 4 pm (Strict, Medium, Free, the two go-tos pinned first: **Nando's ½ PERi chicken** 715 kcal / 108 P / 1.1 C / 30.8 F and **Gochi + 4 Nando's tenders** 445 / 71.4 / 25.9 / 9.1, one tap each), the session 4–6:30 pm (today's workout with one 72 px **Start**; Wednesday Muay Thai, Sunday the walk), then dinner (Strict → Medium → Free, **Best fit** marked, + Custom), the snack while protein is 20 g or more short, the wrap-up. No breakfast, no pre-gym meal.
7. **Custom, Later today and Quick log**: Same as yesterday and saved meals under the meal, **Later today** (the rest of the day in place), **Quick log**: **YoPRO Perform pouch** 120 kcal / 20.1 P / 6.8 C / 1.2 F and **Gochi noodle meal** 225 / 31.8 / 25.2 / 2.6, one tap each (a second tap is a second one), and **+ Food** (the add-food sheet).
8. **Recently eaten**: the day's food, newest first: photo thumbnail (or an icon), name, time, kcal and P/C/F. A photo being analysed shows here at once ("Analysing…" with its photo and a ring); a finished one says "Ready"; one the AI could not answer says why. Tap any row to open its nutrition card and change it.

**Planned today** appears above the meal area when that day has planned foods. Use **Plan for later** on a nutrition card or in the add-food sheet (including **Type it** for a manual name, kcal, protein, carbs and fat). Planning leaves totals unchanged. One round tick logs the food and removes the plan; **Undo** restores both. Hold a planned row, or focus it and press Enter, to remove it. Plans stay on this device across reloads and are included in **Export local backup**. **Import local backup** merges journal data, keeps existing values on conflicts, avoids duplicate IDs, and offers Undo.

Targets: **1,900 kcal / 220 g protein / 150 g carbs / 45 g fat** (Cut; Reset and Bulk goals follow the phase dates in Settings).

## Photos: the camera

The **+** opens a full-screen camera (the rear camera, live) with framing corners and four modes: **Scan food**, **Barcode**, **Food label**, **Gallery**. A big shutter; **Flash** when the camera has a torch; and three links: **Search food** (the add-food sheet's search), **Saved** (your bookmarked foods and the two favourites) and **Describe it** (type or dictate it with the keyboard's microphone). Where the live camera is not available (an iPhone home-screen app, a denied permission) the shutter opens the system camera instead (`capture="environment"`); Gallery opens the photo library.

- **Scan food**: the photo is downscaled on the phone to at most 1024 px on its long edge (JPEG 0.8) plus a 360 px thumbnail, kept in this device's IndexedDB, and sent to your proxy. The camera closes at once and the photo appears in Recently eaten as **Analysing…**; the nutrition card opens by itself when the answer is in (if you are elsewhere, a toast offers **Review**). Nothing is logged until **Done**.
- **Barcode**: the browser's `BarcodeDetector` where it exists, otherwise the local ZXing reader; the shutter types the digits instead. Open Food Facts looks the product up and opens the same card.
- **Food label**: a photo of the nutrition panel, sent with a "nutrition label" instruction in the proxy's text field, so the AI reads the printed serving and values.
- **A photo log takes three taps**: **+**, the shutter, **Done**.

## The nutrition card

One card for every way in (photo, label, barcode, search, typed, saved) and for any food already logged: the photo on top; the name (editable); **servings** (− and +, in halves); **calories** (big) and **protein / carbs / fat** (all editable, the ingredients follow in proportion); the **health score**; the **ingredients** with grams and kcal each (change the grams, remove one, **+ Add** an item); **+ oil or sauce?** (adds 15 mL of oil: 120 kcal, 13.6 g fat; each tap one more); the **bookmark** (saves the food to Saved, tap again to remove); **Fix with AI** (say what is wrong: the photo, what the card showed and your note go back to the AI) and **Done** (logs it, Undo in the toast). A logged food's card also has **Log again** and **Delete food**; a photo you do not want has **Discard** (Undo brings it back).

**Health score** (shown as x/10, rounded to 0.1, between 1 and 10), a rough guide only:

`4 + min(4, protein_g × 4 ÷ kcal × 8) + min(2, fibre_g ÷ 3) − min(2, sugar_g ÷ 15) − (processed ? 2 : 0)`

The protein term is the share of calories from protein times 8 (half the calories from protein = the full 4 points). Fibre, sugar and "processed" count only when the proxy reports them; missing values have no effect. It does not change with servings.

## When the AI cannot answer

The built-in proxy works through Tailscale without pairing. After a network failure, timeout or no answer, the card says **“Can’t reach your PC. Is Tailscale on and the PC awake?”** with **Search food**, **Describe it**, and **Retry**. A 401 also offers **Advanced › paste setup link**. The draft says **“Can’t reach PC · tap to retry”**. Photos and drafts stay on this device and survive a reload until logged or discarded.

## Advanced AI settings

Settings › AI estimates › Advanced (collapsed by default): paste a setup link, enter a custom proxy and access token, or use your own key. With no saved credentials, CHAD uses the built-in proxy without a token header. The token stays in this browser only (`chad.aiProxyUrl`, `chad.aiProxyToken`, and the optional own-key fallback `rec-calories-ai-key`): never shown again, never in the journal, a draft, a backup or a log. The built-in proxy address is written once, in `scan9.js`; no other host or token is in the code.

Contract: `POST <proxy>/estimate` with header `X-Chad-Token`, JSON `{ image, text, hint, units: "metric" }` (`text` carries a description, the label instruction and a correction, at most 500 characters); the answer `{ name, grams, kcal, protein_g, carbs_g, fat_g, items, confidence }` (and the older aliases), optionally `fibre_g`, `sugar_g`, `processed`. `GET <proxy>/health` needs no token. A busy proxy (503) is retried once after 3 s; the request gives up after 100 s.

## Gym and Progress

**Gym** is unchanged in behaviour (restyled): today's session with each exercise's prescription and last set, **Start workout** opens Gym mode (one exercise at a time, kg and reps filled in from last time, one tap logs a set and starts the rest timer, the screen stays awake, it works offline, a closed app comes back to the same exercise), Mark done, cardio, the week and the plan's rules.

**Progress**: the **day streak** (flame) and the **water streak**; the **calories** chart for 7 or 30 days against the goal; the **daily average** protein, carbs and fat (over the days with food logged) against the goals; **workouts** (5, then more) with volume, minutes and PRs; **records** (the six most recent, then Show all); the protein and water charts, and the weight chart only when weigh-ins already exist (v12 collects no new body data).

## Data, migration and offline

The journal stays at `rec-calories-v1`, schema 5, with every v11 field and device key (Gym mode, the builder draft, theme, AI keys, the milestone, the food cache) read as it is. The first time v12 opens a v11 journal it keeps one untouched copy under **`rec-calories-v11-backup`** (never overwritten) and from then on writes `appVersion: 12`. v11 can still read what v12 writes. New in the journal: `savedFoods12` (bookmarks) and, on foods from the card, `ingredients12`, `photoId` and `at` (the time).

Photos and recoverable drafts live only in this device's IndexedDB **`chad-photos-v12`** (`photos`, `drafts`); the journal holds a photo id, never a photo. The journal export (Settings › Data) is a journal backup: no photos, no drafts, no credentials. Clearing the site's data removes the photos. A deleted food keeps its photo while Undo can bring it back; on each start, photos that no logged food or draft points to and that are more than a day old are deleted from the device (a discarded draft's photo goes once its Undo has passed; a photo added to a custom meal is not kept, because the meal keeps no photo).

The service worker caches **`rec-calories-shell-v12f`** (every runtime file, listed in `sw.js`); an installed app updates itself once and drops its old cache. Offline: the app, logging, Gym, Progress, saved photos and drafts all work; new AI estimates and uncached food lookups need the internet (and the PC for the proxy).

Sheets close when the app is backgrounded or restored, and fit the visual viewport above the keyboard and home indicator. All screen headers have an opaque theme background. Saved drafts that could not reach the PC retry on start, return to the app, or reconnection, with one immediate attempt per eligible draft on every fresh page load. Subsequent retries are limited to once per draft every 30 seconds from the persisted last attempt; a throttled event schedules one attempt when that window ends. There is no polling or retry-on-failure loop. Network, offline, timeout, generic failure, HTTP failure and interrupted drafts share the unreachable note and recovery rules; authentication errors require user action in Settings. Background retries leave the result in Recently eaten without opening a modal, and use the request rather than the potentially stale iOS online flag to check reachability.

Runtime files: `index.html`, `theme12.css`, `app12.js` (journal, the hero, settings), `quest12.js` (Today, Gym tab, Progress), `ux12.js` (navigation, sheets, the week strip, toasts), `scan12.js` (the camera, the nutrition card, Recently eaten), plus the unchanged `plan11.js`, `builder11.js`, `gym11.js`, `train10.js`, `game10.js`, `scan9.js`, `food9.js`, `icons8.js`, `motion8.js`, `charts8.js`. v11's `app11.js`, `quest11.js`, `ux11.js` and `theme11.css` are gone.

## Taps (v12, measured by `scripts/v12-button-count.cjs`)

| Action | v11 | v12 |
|---|---|---|
| The usual lunch (Nando's ½ chicken) | 1 | 1 |
| 500 mL of water (8 am, noon, 4:30 pm, 7 pm) | 1 | 1 |
| One set in Gym mode | 1 | 1 |
| YoPRO pouch / Gochi noodle | 1 / 1 | 1 / 1 |
| A photo of food, logged | 5 | **3** (+, shutter, Done) |

Today's first screen (393 × 852) has 14–15 controls in v12 against 6–8 in v11: the extra ones are navigation the v12 design asks for (the week strip's seven days and the round +). Actions on the first screen stay at 2–3 (v11: 2–4).

## Development and checks

Serve the folder over localhost (or HTTPS for the camera on a phone); no install or build. The browser suites use Playwright installed outside the repository (see `scripts/harness.cjs`) with Edge.

`node scripts/run-all.cjs` runs 20 deterministic suites (about 20 minutes): `check` (journal, migration, hero, shell, metric text, secrets), `v12-secret-scan`, `scan-check`, `quest-check`, `food-check`, `v12-migration-check` (a dataset made by the shipped v11, opened by v12, zero loss, and back), `browser-check`, `regression-check`, `v12-browser-check`, `v12-undo-check`, `v12-workout-check`, `v12-meals-check`, `v12-ai-check`, `v12-scan-check` (the whole photo flow with a canvas camera and a stubbed proxy), `v12-retry-check` (startup, online and visibility recovery, last-attempt throttle, deferred event and authentication exclusion; `--baseline` proves failure against v12d), `v12-offline-check`, `v12-design-check` (48 px, AA in light and dark, 393 × 852 and 375 × 667, no sideways scroll), `v12-motion-check`, `sw-update-check` (the real v11 → v12 update) and `v12-button-count`. All their data is synthetic; no real AI, camera, token or food service is used. `node scripts/v12-screenshots.cjs` writes the pictures outside the repository. `scripts/v12-ai-live-check.cjs` is an opt-in check against the real proxy (it needs this machine's token and is not part of run-all); `scripts/off-live-check.cjs` checks the live Open Food Facts service.

Not covered by the automated checks: a real iPhone (WebKit, the home-screen app, its camera and file picker, haptics, Wake Lock, a locked screen, the software keyboard and dictation), a hardware torch, real food photos through the real proxy, and the installed-PWA update on a phone.
