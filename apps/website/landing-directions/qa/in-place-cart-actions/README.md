# In-place cart actions — 2026-10-04

After adding an exact configuration, the primary action is View in cart, with a separate Remove action on bundle cards, individual packages, and inline builder summaries. Bundle cards keep Customize. Removal uses the matching stored group ID and the existing Undo notification; it does not clear other purchases.

Verified in the local browser:

- Added Digital Experience beside the existing Team Workspace; the card displayed View in cart, Remove, and Customize.
- Removed only Digital Experience. Team Workspace remained unchanged; focus returned to Add to cart. Undo restored the removed plan.
- Changing the card duration to three months showed Add to cart without a removal control for that unmatched configuration. Returning to one month restored View and Remove.
- View in cart opened the cart with the expected one-month Digital Experience and three-month Team Workspace groups.
- Refresh retained the added state. Customize opened the builder with both actions in its inline summary, readable removal text on the dark surface, and View in cart in the compact mobile bar.
- Builder removal and Undo worked. Individual SEO add/view/remove worked independently of the software group.
- Desktop cards kept prices, duration choices, and actions aligned across the row. The primary label stayed on one line; narrower cards placed Remove and Customize below it. Desktop and 320px mobile cards had no horizontal overflow. No browser errors or warnings were observed.

Validation: 36 tests passed, including matching-plan removal that preserves another group, persistence, and exact restoration of mixed durations and renewal. Formatting, production build, and `git diff --check` passed.

All test additions were removed. The original Team Workspace remains with HR, Tasks, and Files for three months, manual renewal, CHF 261.90 due today.

Evidence: [desktop bundle](bundle-desktop.png), [320px bundle](bundle-mobile-320.png).
