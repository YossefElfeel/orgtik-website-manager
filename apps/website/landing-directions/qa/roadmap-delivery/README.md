# Roadmap → Website Manager — 2026-10-05

The owner requested removal of the form's “Frontend preview · nothing is sent” note and connection to the CMS dashboard. The note is removed. `sendIdea` now posts to the configured CMS and only shows success after acceptance. New ideas arrive in Website Manager → Ideas as private pending entries; approval remains required before public display.

The existing local CMS “Contact and roadmap forms” setting is enabled and remains configurable. Pausing it rejects Roadmap submissions, including from a stale pulled snapshot. Errors preserve form inputs and allow retry. While sending, the submit button is disabled and the handler prevents duplicate requests. The API gives concurrent ideas distinct IDs. Confirmation and community guidance are CMS copy; the sample votes/comments remain labelled. This activates local dashboard delivery, without pushing, deploying or activating a production service.

Verification: three transport regressions pass; all 15 browser/API delivery checks pass, including actual CMS dashboard display, moderation privacy, CMS pause, failure/retry, duplicate/concurrent requests and 320/390/768/1440px dev/production layouts. Accessibility checks have zero critical issues. Formatting, website build, semantic seed/mapping checks and all 35 existing adapters pass. The existing `site-forms` and CMS settings flows also cover both delivery modes. Test ideas are removed and the exact pre-flow snapshot/host configuration restored in cleanup; the normal local configuration finishes with delivery enabled.

Evidence: `orgtik-program/audits/wm/followup/roadmap-delivery.json`, the delivery screenshots, and relevant flow logs. Preview: `http://localhost:4173/roadmap`; Ideas dashboard: `http://localhost:3007/en/marketing/ideas`.
