# Purchase account setup and footer — 2026-10-07

Guest checkout now opens Password and Confirm password after payment. Billing details are reused; matching passwords of at least eight characters are required. Registration, order linking, and dashboard handoff use the suite identity API.

Validation:

- `npm test`: 51 tests pass, including account registration, order-link/handoff retries, existing-account handling, blocked storage, billing restoration, and password confirmation.
- Production build passes: 51 addresses; the HTML sitemap has no generated page or crawler-sitemap entry. Imprint still has its own generated page.
- Browser: synthetic guest/TWINT checkout reaches Set up my account; empty or mismatched passwords are rejected, mismatch focuses Confirm password, closing clears both inputs, and receipt reload preserves billing details.
- Responsive checks at 320, 390, 768 and 1440px: no page or dialog horizontal overflow. Both fields and Continue to my dashboard remain accessible.
- Browser: `/legal/sitemap` shows Page not found; the footer links to `/legal/imprint`.
- Authentication/redirect tests use request fixtures. No real account or charge was created during browser QA.

Screenshots: `footer.jpg`, `account-setup.jpg`, `setup-1440.jpg`, `setup-390.jpg`.
