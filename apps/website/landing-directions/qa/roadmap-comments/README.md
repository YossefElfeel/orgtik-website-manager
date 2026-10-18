# Roadmap comment display — 2026-10-05

Clicking an idea's comment count now shows its comment list in the existing dialog. Each of the seven public sample ideas has an individual discussion matching the displayed count: 31 sample comments in total, including six for the accessibility idea and three for the project summary. The discussion and authors are explicitly examples. Pending ideas remain private; no real commenting service, message delivery or persistent user comments were added.

Comment previews come from the CMS seed, pass through the moderated public API and the pulled snapshot, and are read by `content.IDEA_COMMENTS`. Labels and empty-state text are CMS copy. The source override preserves the change when the Roadmap reader is regenerated. Empty threads show an honest empty state. The existing focus trap, Escape, focus return and native dialog scrolling remain.

Verification: `orgtik-program/tools/audit-kit/flows/roadmap-comments.mjs` passes **21/21** checks for all seven ideas, matching counts, moderation privacy, empty threads, focus, and 320/390/768/1440px dialogs. Dev is checked in English and Arabic; production in English. Accessibility checks have zero critical issues. Formatting, build, semantic seed/template regeneration and all 35 existing adapter comparisons pass. The closed Roadmap matches its previous three-width baseline on both dev and production.

Evidence: `orgtik-program/audits/wm/followup/roadmap-comments.json`, local `comments-*.png` captures and the `roadmap-comments-closed-*` capture manifests and diff reports. Public languages remain English-only, and work remains local on `cms/connect`.
