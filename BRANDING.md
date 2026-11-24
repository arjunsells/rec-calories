# CHAD branding

CHAD is the app name, wordmark, document title, Apple install title, manifest name and short name. Navy #14284B and gold #B0894C carry the identity: navy ink and gold "done" states in the light theme, true black with gold ink in the dark theme. The pixel font (Press Start 2P, OFL) is a tiny accent for streak, grade, level and XP.

The app icon is a polished gold ring that laps itself, like a closed activity ring, around a pixel flame on a navy field. `scripts/make-icons.cjs` draws it on a canvas for each size, so the flame always lands on whole pixels, and writes opaque, full-bleed PNGs: 180 (apple-touch), 192, 512 and a maskable 512 with the art inside the safe zone, plus a small vector favicon.

No Real Estate Central identity, third-party logos, or copied app artwork is used. The repository and Pages path remain arjunsells/rec-calories; manifest id, start_url and scope stay ./ to preserve install identity. The rec-calories storage/cache namespace is retained for compatibility.

Motion, ring fills, sheet entrances, reward feedback and haptics respect prefers-reduced-motion and the Haptics switch. Screens use 44 pt touch targets, a floating tab bar, and one primary + action.
