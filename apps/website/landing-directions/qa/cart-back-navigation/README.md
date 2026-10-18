# Cart Back navigation — 2026-10-04

Cart has a compact left-arrow Back link above its title, shared by populated and empty layouts. Client navigation records the source path, query, and fragment in the cart history entry. The link uses browser Back when that entry is available, a same-site referrer for direct visits when available, and Bundles & pricing as the final fallback.

Browser verification:

- Pricing → cart exposed `/plans` as the Back destination.
- A service builder configured for Graphic design at three months → cart → refresh → Back returned to the exact query and `#svc-builder` fragment. The selected item and three-month duration were restored.
- Activating the navbar cart icon while already in the cart did not insert a duplicate entry. Back still returned directly to the source builder.
- Software HR detail → cart → Back returned to `/software#/product/hr`.
- Checkout → Edit your selection → cart → Back returned to `/checkout`.
- A fresh tab opened directly to `/cart` exposed `/plans`; Back opened Bundles & pricing.
- At 1440px the control appeared above the cart title. At 320px it retained a 44px touch target with no horizontal overflow.
- No browser errors or warnings. The original Team Workspace remained unchanged at three months, manual renewal, CHF 261.90 due today.

Validation: 36 purchasing tests, formatting, production build, and `git diff --check` passed.

Evidence: [desktop](desktop-1440.png), [320px mobile](mobile-320.png).
