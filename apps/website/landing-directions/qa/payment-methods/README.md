# Checkout payment methods — 2026-10-04

Checkout previously showed a static “Card payment” label. It now offers native Card, TWINT, and PayPal radio choices for guests and signed-in customers, with a visible selected state, method-specific simulation guidance, due-today amount, and no-charge disclosure. The Card choice explicitly lists the confirmed Visa and Mastercard brands. No actual card or wallet credentials are requested. Production provider availability remains a backend integration concern.

Verified in the local browser:

- Optional sign-in preserves the selected PayPal method. Signing out restores guest billing and keeps the selected method.
- Native arrow keys change methods; Tab reaches Pay with a visible focus ring. Radios have accessible names and descriptions.
- Declined TWINT and cancelled Card attempts preserve the cart, total, and payment choice; methods become usable again for retry.
- A successful TWINT purchase records its method on confirmation. Receipt refresh retains the same order reference and method.
- Failed CRM setup retries successfully without any Pay action or another payment.
- Payment choices and Pay remain usable at 320, 390, 768, and 1440px, with no horizontal document overflow.
- No card credential fields, customer storage, or browser errors were introduced.

The original Team Workspace cart was restored with HR, Tasks, and Files for three months, manual renewal, CHF 261.90 due today. Test identity and receipt were cleared through the customer journey; the final tab is ordinary guest checkout.

Validation: 35 cart/pricing/payment/CRM tests passed; formatting, production build, and `git diff --check` passed. New tests cover all three methods in receipts and CRM handoff, retrying with a different method, idempotent success, unsupported choices, and compatibility with older Card receipts.

Evidence: [desktop checkout](checkout-1440.png), [390px checkout](checkout-390.png), [320px checkout](checkout-320.png), and [TWINT confirmation](confirmation-twint.png).
