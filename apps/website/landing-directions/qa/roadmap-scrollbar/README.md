# Roadmap scrollbar refinement — 2026-10-05

The idea board uses a 10px rounded plum track with a lilac thumb, brighter hover/active states, and no native arrow buttons. Firefox uses the standard thin scrollbar fallback. Styling is scoped to the board; the container retains native scrolling and visible keyboard focus.

Formatting and the website production build passed. Six browser checks passed on dev (4173) and production (4280) at 390, 1030, and 1440px: expected scrollbar styling, keyboard scrolling where needed, native thumb dragging, no page overflow, and no runtime errors. Desktop/mobile screenshot crops were inspected with native scrollbars visible. At 1440px the columns fit without a scrollbar.

The pinned Roadmap source override adds the class and keyboard access to exactly one board wrapper, preserving the refinement during regeneration. This change introduces no CMS content or mapping changes. `checks.json` records the browser results; local screenshot crops are excluded from Git.
