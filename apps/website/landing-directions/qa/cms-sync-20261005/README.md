# Repository sync with Website Manager integration — 2026-10-05

Combined GitHub main `3a6667876e960469e073eda26c08d633d64cf32a` with the local `cms/connect` integration, as requested. Preserved CMS data/copy/messages, preview loading, real addresses, locale prefixes, Arabic typography/mirroring, CMS-managed SEO/prerendering and configurable contact delivery.

The updated website includes approved production content, shared account controls, cart Back with configuration intact, two-step duration selection, naturally growing sticky summaries and conditional Card/TWINT/PayPal synthetic checkout. Pricing catalogs remain in the website and are mirrored read-only in Website Manager. Projects without approved narratives no longer produce fabricated case-study content. The authorized follow-up restores six Roadmap and seven moderated idea examples with explicit sample notices; three pending ideas remain private.

## Verification

- 34 CMS adapters equal the data from main `3a66678`.
- 147/147 captures match the untouched repo: 49 logical routes at 390, 768 and 1440px, pixels at threshold 0, text, headings and accessibility. The baseline's hash detail views are compared with their equivalent CMS real addresses.
- 39 distinct purchasing tests passed at sync time (the earlier 78 count duplicated the imported suite); the follow-up passes these 39 plus three regressions, 42 total. Formatting and production build pass.
- All 48 generated heads match CMS records. Redirects, 404/noindex responses, 43 sitemap URLs and robots rules pass.
- Real-route checks: 7/7, including 34 views, 95 aliases, client navigation, back/forward, anchors and not-found.
- All three synthetic payment flows complete; mixed 6/3-month terms and cart Back preserve configuration. No customer identity or payment credentials are persisted.
- Shared account identity and dropdown keyboard focus pass; identity persists through client navigation and refresh returns to guest.
- Arabic Services, Software, Plans, Cart, Checkout and Sign-up pass at 320px with no overflow. Localized sign-up opens the correct mode.

Workspace evidence is in `orgtik-program/audits/website/parity/diff-repo-3a66678-vs-sync-3a66678.md` and `orgtik-sync-backup-20261005/journey/`. Extraction and seed changes are recorded in program plan amendment A9.

## Recovery

Former CMS head `76e565f` remains on `backup/cms-before-sync-20261005`. `orgtik-sync-backup-20261005` preserves original seed/tools, the original local snapshot change, and the previously untracked `.impeccable` directory. The original snapshot-only local change also remains in Git's stash. This sync remains local; it has not been pushed or deployed.

## Website Manager follow-up

The restored Roadmap retains the current shared header and compact introduction, timeline filters, details dialog, idea submission and page-local votes. Sample updates, votes and comment counts are clearly identified; pending ideas remain private. Extraction records the Roadmap source `c8be7fe` alongside the site's `3a66678` source. The four deleted work slugs redirect permanently to `/work`, including their legacy `/projects/...` paths.

Payment and identity messages, older Home/Sign-in labels and shared commerce navigation are CMS-backed. Synthetic test values remain in code as protected numbered placeholders. Sign-up shares Sign-in body copy but owns its noindex metadata. RTL account positioning and stable focus return are verified. Narrative eligibility requires approval; changing figures disables only the draft narrative.

Follow-up verification: 42 distinct purchasing tests and 12 mock-model tests pass; formatting, production build and WM typecheck pass. All 144 unaffected captures match `3a66678` on both dev and production. Roadmap is captured separately with repeat and production comparisons. The program's `audits/wm/followup/README.md` records the full existing flow-suite results, 81 focused regressions, 24 production responsive checks, exact commands and recovery commits. Accessibility checks report zero critical issues; existing serious contrast findings remain recorded in the raw reports. Production languages remain English-only. Real voting, production forms, payments, authentication and CRM are outside this follow-up.
