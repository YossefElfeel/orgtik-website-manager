# Purchasing flow

## Purchase account setup — 2026-10-07

After successful guest payment, **Set up my account** opens Password and Confirm password fields. Both must match and contain at least eight characters before any registration request. Reuse the billing name and email, register through the suite identity API, connect the saved order to that workspace, and redirect through a one-time session handoff to the dashboard. No email-verification step is shown. An email with an existing account must sign in; setup never changes that account's password.

Keep the new session immediately after registration. Order-linking and handoff failures retry without another registration or payment. The receipt may retain only billing name, email and company in this tab's sessionStorage so password setup still works after reload. Restoring a receipt never authenticates a customer. Passwords and payment credentials are never stored. This replaces the older guest-verification and identity-free receipt descriptions below; payment remains a no-charge test checkout.

The HTML Sitemap page and legal-page tab are removed. Marketing footers link to `/legal/imprint`. The crawler's `sitemap.xml` remains generated and excludes the removed HTML page.

The journey is `/plans` or a service/software page → builder → `/cart` → `/checkout` → CRM account handoff. Services and software have separate builders and share one cart. Hosting is an external purchase at https://orgtik.ch. The storefront uses production-style wording, with payment, authentication, and CRM integration simulated locally. No real charges, accounts, or messages are created.

## Architecture

- `src/reference/purchase-catalog.js`: approved sample prices, stable catalog IDs, bundle templates, URL compatibility, migration, and one integer-minor-unit pricing implementation.
- `PurchaseUI.jsx` / `PurchaseControls.jsx` / `purchase.css`: shared bundle, duration, configuration, pricing, dialog, and notification components.
- `purchase-store.js`: cart v2, migration, explicit overlap choices, content replacement, persistence, and Undo.
- `PurchasePlans.jsx`, `PurchaseCart.jsx`, `PurchaseCheckout.jsx`: discovery, review, payment, and confirmation. Existing Services/Software page shells retain their content and visual system.
- `purchase-adapter.js`: deterministic mock payment and CRM integration boundary. No network, email, actual accounts, or invoices. It requires method-specific test authorization; raw payment details never cross this boundary.
- `purchase-payment.js` / `PaymentDetails.jsx`: shared simulated Card, TWINT, and PayPal choices and synthetic card validation. Wallet choices proceed directly to the local test Pay action without details or approval previews. The selected method is recorded in the immutable receipt and included in the CRM handoff. No real card or wallet credentials are accepted.

Prices are editable sample CHF monthly amounts. Duration savings are 0%, 5%, 10%, 15% for 1/3/6/12 months. Group savings are 0%, 5%, 10%, 15% for 1/2/3–4/5+ distinct items. Each line uses the larger rate; ties are duration savings. Round its full-period amount once, sum line totals, and derive monthly equivalents from those payable totals. Taxes are unconfigured. Advertising management excludes media spend.

## Storage and legacy links

`orgtik.cart.v2` in localStorage contains configurations and migration messages. The original `orgtik.cart.v1` remains intact; migration also attempts to write `orgtik.cart.v1.backup`. Each migrated group requires review, even where its duration is valid. Old project or 24-month terms require explicit selection. Hosting is removed with an external-link notice. Blocked storage still permits an in-memory cart.

Builder links preserve `services` or `modules`, shared `duration`, line-level `terms`, `renew`, and `bundle`. Software legacy `module`, `mode`, monthly/annual/biennial terms, and `#/plans/...` links retain valid scope; service `plan-service` links retain the chosen service. Obsolete tier choices no longer affect scope or price.

`orgtik.purchase-preview.v1` in sessionStorage stores an immutable preview receipt and CRM setup status. It excludes customer details and always restores account access as unverified. A new populated cart starts a new checkout. Payment failures preserve cart configuration; success removes the paid groups and cannot be undone into another charge.

## CRM integration contract

`createCRMHandoffRequest(order, customer, verified)` produces:

```
{
  purchaseReference,
  customerContext: { name, email, company, verified } | null,
  purchases: [{ id, name, kind, lines: [
    { catalogId, name, months, autoRenew, monthlyMinor,
      subtotal, total, saving, discount, reason, activation }
  ] }],
  amounts: { subtotal, saving, total, monthlyEquivalent, valid },
  currency: "CHF",
  paymentMethod: "card" | "twint" | "paypal"
}
```

`provisionCRM` returns `{ purchaseReference, status, access, destination }`. Ready setup is idempotent for its purchase reference. Failed/pending setup may retry independently of payment. A refresh retry can omit customer context: a production backend would retrieve it by the authenticated purchase reference, never browser claims.

Production must confirm payment through the payment backend, calculate authoritative prices, create/associate the verified CRM customer, associate order/payment/invoice records, and initiate account access. The mock's browser flags are demonstration data, never production payment or authentication evidence.

Set `VITE_CRM_PORTAL_URL` to the supplied HTTPS portal destination and restart Vite when ready. With no destination, account actions explain that the account connection is not configured. Guest access requires simulated email ownership verification before account access and never looks up or discloses whether an email has an existing account. Local sign-in represents a verified returning customer. No identity persists on refresh.

Checkout opens directly to guest billing and payment. The billing section has no Sign in button or sign-in dialog; customers can sign in through the shared site header. It uses entered email/customer details, never a fixed demo customer. The shared in-memory identity prefills billing and displays signed-in status on return visits; standalone sign-in uses the same identity. No credentials, identity, or customer details are stored in browser storage. These client-side flags do not provide production authentication.

`AccountControl.jsx` subscribes to this identity on every marketing and commerce header. Guest headers show Sign in; signed-in headers show initials and a compact name, with My account and Sign out. The navbar cart icon provides cart access; the account panel and mobile account section do not duplicate it. The account panel stays inside the viewport, supports keyboard focus and Escape, and closes on outside interaction. Mobile navigation includes the same identity/actions. My account opens the configured HTTPS CRM destination, or explains that the account connection is not configured. Signing out never removes cart items and immediately resets the standalone sign-in page and checkout identity.

Guest and signed-in checkout share visible Card (Visa or Mastercard), TWINT, and PayPal radio choices, method-specific simulation guidance, a due-today total, and a concise no-charge disclosure. The user confirmed Visa, Mastercard, TWINT, and PayPal; the two card brands share one payment flow. Changing identity or retrying failed/cancelled payment preserves the choice. Successful payment records the method on confirmation and in the identity-free session receipt; older receipts restore as Card. Production payment methods must be supplied and processed by the payment backend.

No method is selected when checkout opens. Card details and method-specific guidance stay hidden until a method is chosen. Only Card renders payment details and requires them to be complete. TWINT and PayPal show no details or approval section and enable the local test Pay action after selection. Pay remains disabled before any method is selected.

The local checkout keeps billing/email → payment method → card details when applicable → Pay → success → account access ready. Card fields accept only example Visa `4242 4242 4242 4242` or Mastercard `5555 5555 5555 4444`, expiry `12/30`, and security code `123`. Prefix validation rejects other values. An optional Use example Visa details action completes the same inputs. TWINT and PayPal proceed directly to Pay without approval buttons or dialogs. Switching methods or changing the cart clears card details; failed/cancelled payments preserve the cart and selected method for retry. Payment inputs live only in component memory and are cleared after success; only `{ method, approved }`, generated for the explicit test Pay request, crosses the simulation boundary. The receipt and CRM payload contain no payment details or authorization flag. Default successful payment runs independent CRM setup to ready; guest verification and an unconfigured real portal remain explicit.

Payment and CRM outcome controls are available only during development at `/checkout?qa=1`. They are hidden on normal checkout and removed from the production build. Tax remains not calculated. Unapproved testimonials, mock client logos, project narratives/results, and roadmap activity are not published.

Software activation is `active-preview`; services are `awaiting-onboarding`, with the period not started. Real onboarding, password setup, invoices, payment history, and dashboards remain in the CRM project.

Confirmation places account access and purchase details beside each other in two top-aligned columns above 900px, and stacks account access first on smaller screens. Continue browsing stays directly below the account setup/access action, followed by the activation note. The purchase details panel contains the receipt and invoice guidance.

## Validation

The latest UI review is documented in [qa/journey-review/README.md](qa/journey-review/README.md), including before/after captures. The [initial purchasing acceptance pass](qa/purchasing/README.md) covers the wider legacy-link and migration scenarios.

The cart's content editor previews its draft price and requires Save or Cancel before checkout. Duration and renewal changes outside that editor still save immediately with Undo. Mobile purchase actions remain reachable while scrolling; checkout displays its expandable order review before billing.

Both builders and the cart content editor have two steps: choose items, then set durations. Clear all sits beside the Step 1 heading: it resets the current builder configuration or clears only the cart editor's draft until Save. The Use shared duration switch sits at the right edge of Step 2 and starts on, showing shared duration pills with individual cards and their disclosure entirely hidden. Turning shared duration off hides the shared pills and shows every selected card with its duration controls directly, without duration checkboxes. There is no separate Make it yours heading or third step. Switching modes preserves durations and renewal settings; choosing a shared term still confirms replacing individual overrides. Cart Save/Cancel behavior remains unchanged.

Desktop builder summaries follow the page with sticky positioning confined to their builder. Their measured height adjusts the sticky offset so tall cards expose their bottom without internal scrolling; short cards stay below the site header. Mobile layouts retain normal page flow and their compact purchase bar.

Bundle cards, individual packages, and inline builder summaries change Add to cart into a View in cart link plus a separate Remove button when that exact configuration is in the cart. Bundle cards retain Customize. Remove targets the matching stored group ID, preserves other groups, and offers Undo; focus returns to Add to cart. Undo restores periods and renewal settings. Duration changes are matched independently, so a different configuration still uses the overlap-resolution flow. The compact sticky mobile builder bar keeps the primary Add/View action, while its inline summary provides removal.

The overlap dialog identifies the originating cart plans and the new selection in separate Already in your cart / You’re adding panels. Shared item names, individual durations, and renewal preferences stay visible. Keep cart version retains their current grouping; Use new version moves the shared items into the incoming plan. Other incoming items are listed as Included with either choice. Identical terms are explained explicitly. Cancel/Escape leaves the cart unchanged, both boundary Tab directions stay inside the dialog, and focus returns on close. See `qa/overlap-comparison/README.md` for browser evidence.

Cart includes Back above its title. The router records the source page in the cart history entry; Back returns through browser history, retaining builder queries and product anchors after a cart refresh. A cart opened directly uses a same-site referrer when available, otherwise `/plans`. The current cart icon does not create duplicate entries. Navigation preserves the cart. See `qa/cart-back-navigation/README.md`.

Run `npm run test:cart`, `npm run format:check`, and `npm run build`. Unit tests cover all catalog subsets/duration combinations, discount thresholds/ties/rounding, mixed groups, overlap resolution, edits/Undo/persistence, legacy migration and invalid terms, payment retry/idempotency, CRM recovery, activation, and identity-free receipt restoration.

Browser scenarios:

1. Customize a bundle, override one duration, cancel/accept shared replacement, filter without losing selections, and add to cart.
2. Edit contents, cancel, save, reload; change duration and renewal, then Undo. Add an overlapping bundle and exercise both explicit choices.
3. Add software to the same cart. Inspect directory, department, and individual package prices; follow legacy entry links. Verify Hosting has only its external action.
4. Open checkout directly as guest; check name/email validation and the absence of a billing Sign in button. Sign in through the shared header and check prefilled billing and Sign out. In development, visit `/checkout?qa=1` to choose declined/cancelled outcomes and retry with the same cart.
5. Pay successfully with CRM failed or pending using the development QA controls; refresh confirmation and retry account setup without paying. Verify guest email handoff and returning customer access.
6. Inspect 320, 390, 768, and 1440px layouts, keyboard controls, dialog Escape/focus return, live total announcements, and browser errors.
