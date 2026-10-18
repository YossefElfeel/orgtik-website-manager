# Signed-in website navigation — 2026-10-04

Every marketing and commerce header uses the shared `AccountControl.jsx`. Guest users have a Sign in link. Signed-in users see an initials avatar and a short name when available; the disclosure shows their entered identity, My account, and Sign out. Cart access stays in the navbar cart icon, with no duplicate View cart in the account panel or mobile account section. With no supplied name, the trigger uses Account and an email initial, without inventing a customer name.

The duplicate cart action was removed on 2026-10-04. Desktop and 320px compact/full mobile menus were checked: My account and Sign out remain, mobile language access remains, the navbar cart icon opens `/cart`, and no account section contains a cart link. Keyboard opening/Escape and mobile sign-out work; the cart was preserved and test identity cleared. Formatting, production build, and `git diff --check` passed. Updated evidence: [desktop menu](menu-without-cart-desktop.png), [mobile menu](menu-without-cart-mobile.png).

The shared identity remains in memory across client navigation. Both checkout sign-in and standalone sign-in publish the same state. Global sign-out updates the header, checkout identity, and standalone sign-in screen without removing cart items. Refresh still returns to guest, as required by the local simulation boundary. No identity or credentials are persisted.

My account uses the configured HTTPS CRM destination. With no destination, it opens an account-connection explanation; no local dashboard or external URL is invented.

Mobile headers show a compact initials control. At narrow widths, language selection is available in its panel. The full navigation menu also includes account actions and scrolls on short screens. Account disclosure positioning is clamped to the viewport and its language popup opens upward within the panel.

## Verification

- Checkout sign-in immediately replaced the navbar Sign in link with initials/name and account actions.
- Signed-in state remained visible during navigation through Home, Services, Software, Work, About, Insights, Contact, Roadmap, and Legal.
- Standalone sign-in updated the navbar using the entered email; global Sign out returned its success screen to the sign-in form.
- Global sign-out returned checkout to guest billing and restored its guest draft. Test customer inputs were cleared afterward.
- My account displayed the unconfigured CRM connection state. No external account was created or opened.
- Account disclosure supported keyboard opening, Escape with focus return, and outside interaction dismissal.
- At 320 and 390px, account panels stayed within the viewport; mobile navigation scrolled and preserved identity after page changes. Language options fit inside the account panel.
- At 1180px, the desktop controls fit within the header; 1440px showed the name and avatar comfortably.
- Original cart remained Team Workspace: HR, Tasks, and Files, each three months, automatic renewal off, CHF 261.90 upfront.
- All 32 purchasing tests passed. Formatting, production build, and `git diff --check` passed.

## Captures

- [Signed-in checkout](checkout-signed-in-1440.png)
- [Signed-in homepage](home-signed-in-1440.png)
- [Compact account menu](home-signed-in-390.png)
- [Mobile navigation](navigation-320.png)
- [Mobile language access](account-language-320.png)
