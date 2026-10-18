# Purchasing verification — 2026-10-01

Verified the local frontend at `http://127.0.0.1:5173`. All transactions and identities were synthetic preview data. No emails, real accounts, invoices, card details, or external payments were used.

## Automated checks

- 30 pricing, catalog, cart, migration, payment, and CRM tests passed (`npm run test:cart`). Includes exhaustive catalog subsets with all four terms, minor-unit rounding, best-discount selection, and reference-based retries.
- `npm run format:check` passed across the source tree.
- `npm run build` passed.
- `git diff --check` passed.

## Browser checks completed

- Customized Brand Presence, changed one line to 12 months, cancelled shared replacement, then accepted a later shared replacement to 3 months. Both lines adopted the confirmed term.
- Filtered to Marketing while retaining both hidden Design selections. Added to cart with the intended durations and shared pricing.
- Changed renewal and used Undo. Cancelled content edits, then saved an added service. Refresh retained scope, prices, and durations. The item-count saving recalculated for three items.
- Added an overlapping bundle, tested both Keep existing and Use incoming, and restored the original with Undo. The existing 12-month item was never silently shortened or duplicated.
- Added a 3-month Team Workspace to the service cart. Checkout showed both groups, individual terms, renewal preferences, savings, and matching totals.
- Guest validation focused name first. Declined and cancelled demo payments preserved the order. Successful payment followed by CRM failure survived refresh and recovered with account-setup retry, without another payment.
- Guest handoff withheld account access until simulated email verification. Escape closed its dialog and returned focus to the account action.
- Demo sign-in retained HR in checkout; pending CRM setup changed to verified existing account access. A later populated cart opened a new checkout despite the previous stored receipt.
- Verified software 24-month legacy links require a new term. Choosing a valid duration and renewal then following Combine with more products retained that configuration.
- A legacy department `plan-service=graphic-design&duration=3` selection produced the expected CHF 2,565 period total. Hosting exposed `https://orgtik.ch` and zero local Add-to-cart buttons.
- Inspected 320, 390, 768, and 1440px layouts. At all four widths, document scroll width matched the viewport's client width (305/375/753/1425px, excluding the browser scrollbar). Native radio keyboard navigation, field validation focus, dialog focus return, and live cart totals were checked.
- No new browser errors appeared during the final verification. Earlier development-session HMR diagnostics predated the final reloads.

## Captures

- `bundles-1440.jpg`, `bundles-390.jpg`
- `cart-1440.jpg`, `cart-320.jpg`
- `checkout-768.jpg`, `checkout-390.jpg`
- `confirmation-1440.jpg`

The CRM portal destination is intentionally unset. Account actions show the labeled handoff preview; production backend and CRM integration are outside this frontend phase.
