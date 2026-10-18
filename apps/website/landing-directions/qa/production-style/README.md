# Production-style simulation — 2026-10-04

The storefront now uses normal customer-facing purchase wording. The approved CHF catalog values are unchanged; they remain configurable frontend amounts, not backend-authoritative prices.

Removed public sample/demo labels, the fixed demo identity, placeholder testimonials, mock client logos, unapproved project narratives/results, and fabricated roadmap dates, votes, and comments. Homepage work imagery now describes the supplied OrgTik brand applications and links to the published identity project. The project page hides its related-work section when no other published projects exist.

Checkout defaults to guest billing, offers optional email/password sign-in, and shares only entered name/email/company in memory. Passwords are discarded, never persisted or sent. No real authentication occurs. Sign-in validation focuses the missing/invalid field; cancelling sign-in and signing out preserve the guest draft.

Payment and CRM state controls are development-only at `/checkout?qa=1`. Default checkout has no test controls. The production checkout chunk contains no scenario-panel copy or fixed demo identity. A concise no-charge disclosure remains beside the payment method. Tax is explicitly not calculated. Until an HTTPS CRM destination is supplied, account access explains that its connection is not configured.

## Verification

- `npm run test:cart`: all 32 tests passed, including entered identity, no password persistence, quote consistency, storage, payment idempotency, and CRM retries.
- `npm run format:check`, `npm run build`, and `git diff --check`: passed.
- Browser: guest billing starts blank; sign-in uses entered details; validation focuses Password; Sign out and guest cancellation preserve the draft.
- Browser: local payment showed disabled processing controls, then an `ORG-` confirmation with the correct CHF 261.90 total, purchased items, periods, renewals, and activation. Confirmation survived refresh. Guest account access required email verification, then explained the unconfigured portal connection.
- Browser: checkout reviewed at 320, 390, 768, and 1440px with no horizontal overflow. The 320px sign-in dialog fits the viewport. Escape closes it and returns focus to Sign in.
- Browser: roadmap shows an empty state; Work publishes only OrgTik identity work, with no fabricated metrics or empty related-work section; Home has no placeholder client/testimonial content and all four brand images link to the real identity project.
- No browser errors or warnings were reported during the verification.
- Original Team Workspace cart restored after the test: HR, Tasks, and Files, three months each, automatic renewal off. Test customer details and the test receipt were cleared. No real charge, email, or CRM account was created.

## Captures

- [Desktop checkout](checkout-1440.png)
- [Mobile checkout](checkout-390.png)
- [Tablet checkout](checkout-768.png)
- [Narrow mobile sign-in](signin-320.png)
- [Purchase confirmation](confirmation-1440.png)
- [Account handoff](account-handoff-1440.png)
- [Roadmap empty state](roadmap-1440.png)
- [Published project](project-1440.png)
- [Homepage brand work](home-work-1440.png)
