# v7 UX handoff

This pass changes structure and behavior in the rec-calories workspace only. The sibling rec-calories-design7 workspace is not read or edited. The app intentionally still loads theme6.css, icons6.js and charts6.js until the visual merge.

## Runtime contracts

- `app.js` owns the journal, validation, migrations, food lookup/AI, totals and persistence. `CHADUX.dateKey()` supplies the selected date for all new entries. Goal calculations for historical dates are derived, not written back into the saved goal settings. Lifetime rewards and streaks remain anchored to the real Darwin date.
- `quest.js` directly creates semantic meal sections, independent log/info buttons, quest chips and training sections. It no longer builds disclosure markup for Today or Training, and `ux.js` no longer hides card tiers or rewrites the checklist after rendering.
- `ux.js` owns date arrows/swipe, the current time slot, sheets, Undo toast, settings grouping and hero ring painting. Sheet helper: `CHADUX.detail(title, nodes)`. Notification helper: `CHADUX.toast(label, undoCallback)`.
- Store schema stays 5 with the existing keys and field names. Unknown entry/day/root fields survive. A meal action replaces only entries for its `day` + `planSlot`. Undo captures that slot's previous entries/tier; quest undo captures affected fields only. Later unrelated writes remain intact. Undo stays bound to the action date after navigation.
- `style.css` supplies structural grids, wrapping, hit areas and compatibility adapters for the current kit. All safe-area layout uses the kit's `--ch-sat`, `--ch-sab`, `--ch-sal`, `--ch-sar` variables, allowing tests to simulate insets.

## Selectors for the visual merge

| Area | Stable hooks |
|---|---|
| Date | `.date-header`, `#date-label`, `#day-title`, `#previous-day`, `#next-day`, `#return-today` |
| Rings | `#activity-rings`, `.ch-metric`, `#calorie-ring`, `#protein-ring`, `#quest-ring` |
| Meal slots | `.meal-slot[data-meal-slot]`, `#next-up`, `.meal-options` |
| Choice | `.meal-choice`, `.meal-pick[data-slot][data-tier]`, `.meal-info`, `.tier-label`, `.meal-title`, `.meal-macros` |
| Quests | `.daily-quests`, `.water-row`, `.water-total`, `.bottles`, `.bottle[data-water]`, `.quest-chips`, `.quest-chip[data-quest]` |
| Training | `.training-level[data-day]`, `.is-today`, `.exercise`, `.exercise-toggle[data-exercise]`, `.exercise-info` |
| Feedback | `#undo-toast`, `#message`, `#celebration`, `#xp-pop` |
| Sheets | `#add-sheet`, `#scan-sheet`, `#manual-sheet`, `#detail-sheet`, `#confirm-sheet` |

Pressed state uses `aria-pressed`. Selected meal/quest styles also receive the existing selected/checked kit aliases. Keep log and info as sibling buttons; nested buttons would break touch and accessibility. Cards show title, kcal and protein; full nutrition, ingredients, tips and swaps stay in the sheet. Long press opens the same sheet and suppresses logging. Pointer movement cancels the press timer. Keyboard focus is restored after rerender without scrolling.

The leading slot starts at Lunch before 14:00 Darwin, Pre-gym before 18:00, Dinner before 21:00, Dessert thereafter. It advances through unfinished slots when logging; all slots stay in the vertical list. Five quest chips and 500mL bottle controls wrap rather than scroll horizontally. A full bottle row decrements by 500mL; arbitrary saved water quantities can be edited in Settings.

The visual merge should replace icon/chart/theme references in index.html and the service-worker shell together, then use a new cache name. Existing CHADIcons and CHADCharts API calls are retained here. Manifest has ordinary 192/512 and maskable 512 entries; existing icons are placeholders until the merge. Splash background is #F2F2F7; no startup-image matrix is generated.

## Validation

Run `node scripts/run-all.cjs`. All nine automated suites passed during this pass. v6-specific browser/design scripts were replaced by v7 scripts; the broad v5/browser regressions were adapted and retained. The cache-upgrade test exercises the service-worker lifecycle from a v6 cache namespace to v7 UX, with journal persistence and an offline reload.

Mobile matrix: 393x852 and 375x667, DPR 3, touch, iPhone Safari UA, light/dark, with/without simulated 47px top / 34px bottom / 6px sides. All controls and links in all views and sheets are at least 44x44 CSS px; no horizontal page overflow, no unexpected console/page errors, and final content clears the floating Add button. Tests record one click from one touch tap for each action in every matrix configuration:

| Action | Taps |
|---|---:|
| Log a plan meal | 1 |
| Add a 500mL bottle | 1 |
| Toggle a quest | 1 |
| Tick an exercise within Training | 1 |

Opening Training from Today is a separate navigation tap. Scrolling to a visible control is not a tap. All slots/exercises remain visible in normal document flow, with no disclosure tap.

Additional coverage includes tier switch/deduplication, tap-again/toast undo, full-row water decrement, info and long press without logging, genuine protocol touch swipes, past-day meal/quest/manual edits, other-day exercises, v6 unknown-field preservation, v4 migration, precise macros, weekly/streak scoring, top-set PRs, theme/chart redraws, phase/deload behavior, food fallback/manual recovery, offline resources and failed storage.

Known limits: this is Chromium emulation, not WebKit or a physical iPhone. Native camera permissions/scanning, installed splash/update appearance, haptics and sound need device checks. Network success/failure paths use stubs; real AI is not exercised. The v7 visual kit remains for the merge pass. No deployment or push is part of this pass. Generated screenshots and test storage are outside the repository.
