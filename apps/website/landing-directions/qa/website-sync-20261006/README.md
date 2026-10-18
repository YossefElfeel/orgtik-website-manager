# Latest GitHub update and CMS repair — 2026-10-06

Merged upstream `dc7735f` locally on `cms/connect`. Restored five Work projects and complete case studies through Website Manager content. Sample narratives have their own approver-controlled publication switch and visible sample disclosures; approved narratives still require approved figures. Canonical project pages work again, and legacy `/projects/...` URLs permanently redirect to the matching `/work/...` page.

Preserved the local Roadmap's CMS submissions, private moderation queue, sample comments, compact introduction and styled horizontal scrollbar. Seed, copy/string mappings and published snapshot use the pinned upstream revision. Website main and both older recovery branches remain intact; nothing was pushed or deployed.

Verification passed: 42 purchasing tests, 3 form transport tests, 15 CMS model tests, 35 data adapters, 58 sync checks, 21 comments checks, 15 delivery checks, 5 narrative regressions, 10 WM preview steps and 6 site form steps. Website formatting/build and WM formatting/typecheck passed. New verification records and local captures are in `orgtik-program/audits/wm/sync-20261006`.
