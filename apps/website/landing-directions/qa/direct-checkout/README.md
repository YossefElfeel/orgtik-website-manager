# Direct guest checkout

Checkout opens immediately to billing and demo payment. Guest status has an optional Sign in button; no mandatory choice screen remains. Signed-in demo customers see their identity and prefilled billing details, with the account email read-only.

Verified optional sign-in cancellation and Escape restore focus and retain guest inputs. Signing out restores the guest draft. The shared demo identity survives client navigation back to checkout, while refresh resets to guest and discards customer details. A declined guest payment preserves the original cart. No browser console errors were reported.

Checked 320, 390, 768, and 1440px layouts with no horizontal overflow. Screenshots show guest and signed-in states. Validation: 32 tests, formatting check, production build, and whitespace check passed.
