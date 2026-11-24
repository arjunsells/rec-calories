# CHAD branding

CHAD is the app name, wordmark, document title, Apple install title, manifest name and short name. Navy #14284B and gold #B0894C carry the identity: navy ink and gold "done" states in the light theme, true black with gold ink in the dark theme. The pixel font (Press Start 2P, OFL) is a tiny accent for streak, grade, level and XP.

The app icon is the CHAD mascot: an invented, generic cartoon character (swept brown quiff, dark shades with a gold glint, square jaw, a smirk, arms crossed, a black tank top with gold piping and a tiny gold pixel flame as a nod to the old flame icon) in front of a gold ring halo on a deep navy field with a soft radial glow. It was designed not to resemble any real person. `icons/icon.svg` is the 1024 vector master and `icons/icon-1024.png` the master raster; 180 (apple-touch), 192, 512 and a maskable 512 (character inside the safe zone) are opaque, full-bleed PNGs drawn from the vector at each size. `icons/mark.svg` is the transparent head-and-shoulders mark with a white sticker outline, made for small sizes on light and dark; it sits in the Progress header. The art was drawn in a separate design workspace, so the old flame generator (`scripts/make-icons.cjs`) is gone and can no longer overwrite it.

No Real Estate Central identity, third-party logos, or copied app artwork is used. The repository and Pages path remain arjunsells/rec-calories; manifest id, start_url and scope stay ./ to preserve install identity. The rec-calories storage/cache namespace is retained for compatibility.

Motion, ring fills, sheet entrances, reward feedback and haptics respect prefers-reduced-motion and the Haptics switch. Screens use 44 pt touch targets, a floating tab bar, and one primary + action.
