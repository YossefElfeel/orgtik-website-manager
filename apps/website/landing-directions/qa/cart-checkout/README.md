# Cart and checkout verification

Verified 2026-09-30 against a local production build on port 4180.

- Added software bundles, workspace plans, individual product plans, service bundles and service plans through the UI.
- Confirmed duplicate prevention, distinct billing selections, refresh persistence, item removal and configuration links.
- Confirmed empty cart and direct empty-checkout recovery.
- Confirmed required-name and email validation, all contact fields, selected-item details in the enquiry preview and return to editing.
- Kept all enquiries local: no server delivery or payment. Customer details are not written to browser storage.
- Inspected cart and checkout at 1440px, 390px and 320px, including wrapping, responsive layouts and original-header compatibility.
- Corrected the compact language cue, original menu width and scrollbar-related minimum-width overflow. Final 320px checks showed a 305px client width and 305px document scroll width on Software, cart and checkout.

The captures use test cart selections. The checkout form is empty; no customer data is present in these screenshots. The original screenshot set is `cart-{1440,390,320}.jpg`, `checkout-{1440,390,320}.jpg`, and `software-header-320.jpg`.

`npm run build`, `npm run format:check`, and all five `npm run test:cart` checks passed. A fresh read-only reviewer inspected the screenshots and code; all three listed responsive findings were scored resolved after correction. The optional Impeccable detector could not run because its engine was not installed, so visual verification used rendered captures and source review.

The CMS integration remains deferred by request. See the project README and `src/reference/checkout-enquiry.js` for the payload boundary.

## Cart interaction enhancement — 2026-09-30

The cart now groups software and services, exposes the scope/plan/duration beside each estimate, offers undo for the latest removal, and keeps a checkout action visible on mobile. Both service and software add actions become “View in cart” for the exact saved configuration. Adding shows a persistent, dismissible selection preview with cart, checkout and continue-browsing actions.

UI verification covered the Launch service bundle, the Graphic design Connected plan, and the CRM Essential plan; add feedback, cart counts, navigation dismissal, checkout handoff, return focus, duration changes, removal/undo and saved selections were checked. Temporary individual-plan test selections were removed afterward. All six data tests, the production build, formatting and whitespace checks passed.

New captures are `cart-enhanced-1440.jpg`, `cart-enhanced-390.jpg`, `cart-enhanced-390-middle.jpg`, `cart-enhanced-390-bottom.jpg`, `cart-enhanced-320.jpg`, `service-add-enhanced-{1440,390}.jpg` and `software-add-enhanced-390.jpg`. These are viewport captures: full-page capture was unavailable in this browser session. At 320px the cart client and scroll widths both measured 305px; the fixed mobile checkout bar measured 78.8px high. No customer details were entered or stored in this pass.

The fresh visual/source review found one focus-ring contrast issue. Scoped dark-purple outlines now cover the light cart and notification surfaces while the plum summary retains its light outline. Keyboard checks confirmed visible focus on configuration, Remove, Undo removal, Dismiss and Continue browsing. Focus captures are `cart-remove-focus-1440.jpg`, `cart-undo-focus-390.jpg`, `cart-close-focus-390.jpg` and `cart-continue-focus-390.jpg`. The reviewer scored that finding resolved in a bounded follow-up and cleared the fix. The production build and CSS formatting passed again after the correction; documentation was rechecked without behavior drift.

## Cart workspace refinement — 2026-09-30

The cart was further reworked around a compact title/count, All items/Software/Services filters, a continuous item list with native detail disclosures, separate monthly/project estimates and category breakdowns. Existing configurators now offer Save changes when opened from Edit selection. Saving replaces the original item; cancelling leaves it untouched. Removal feedback is inline, and clear-all offers inline confirmation and undo. Mobile retains checkout and a direct estimate link. See `cart-workspace-direction.md` for the scope and design contract.

UI verification changed Complete suite from Connected (CHF 176/month) to Launch (CHF 147/month) and back, and Graphic design from Focus (CHF 1'800/project) to Connected (CHF 4'200/project) and back. Both edits kept four total cart items. Launch bundle edit/cancel, filters, a filtered empty state, disclosure details, removal/undo, clear-all/undo, refresh persistence, estimate navigation and the full checkout handoff were checked. The original four test selections were restored. Keyboard Undo had a dark focus outline; Escape dismissed inline feedback and returned focus to the cart heading. No customer data was entered.

All eight `test:cart` checks, `format:check`, the production build and whitespace checks passed. The final narrow layout measured 305px for both client and scroll widths. Captures are viewport images: `cart-workspace-{1440,390,320}.jpg`, `cart-workspace-bottom-1440.jpg`, `cart-workspace-details-390.jpg`, `cart-workspace-estimate-390.jpg`, `cart-workspace-empty-390.jpg` and `cart-edit-software-1440.jpg`. Full-page capture and the optional detector remain unavailable. No claim is made that the separate interactions suite was rerun.

The final bounded visual/source review cleared two corrections: the cart estimate overview now prefixes every billing-period total containing priced services and each service breakdown with “From”, and “Keep items” returns focus to “Clear cart” after cancelling clear-all. Supporting recaptures are `cart-keep-items-focus-1440.jpg` and `cart-workspace-estimate-320.jpg`. The reviewer marked both findings resolved, accepted the recaptures and returned a ship disposition within that fix scope; no material regressions from those two corrections were evident.

## Service feature details — 2026-09-30

Service rows now expose “View service features” through the existing native disclosure. Each service in a bundle has its own heading and feature checklist. Individual and family plans use the same published plan scope as the service package cards. The service catalogue and plan-feature helper are shared with Services; saved selection IDs resolve features without changing the cart storage schema or checkout payload. Unknown IDs retain the selected name and show that feature details require confirmation.

Verified the existing Graphic design Focus selection and every service in the Care and Launch bundles, mouse and keyboard opening/closing, visible keyboard focus, and preserved selections after cancelling an edit. The Services configurator still shows the matching Focus, Connected and Partnership features. Checkout still carries all four saved items into the empty contact form. No customer data was entered.

Checked 1440px, 1024px, 390px and 320px layouts. Client and scroll widths matched at 1024px (1009px), 390px (375px) and 320px (305px). Captures are `service-features-{1440,390,320}.jpg` and `service-bundle-features-1440.jpg`. All ten `test:cart` checks, the production build, formatting and whitespace checks passed. The two new tests cover catalogue lookup for saved selections, non-mutation, unknown IDs, and service/family plan scope. No separate agent review or interactions-suite rerun is claimed for this narrow addition.

## Reversible service-plan buttons — 2026-10-01

Service plans and bundles now keep their action on the Services page: adding changes it to “Remove from cart,” and removal returns it to “Add to cart.” The notification offers immediate service removal and Undo. Undo and notification removal return focus to the matching source control. Cart editing retains Save changes; software controls retain View in cart.

Browser verification covered the existing Graphic design Focus selection, adding/removing Connected, removal directly from the notification, keyboard removal/Undo/Escape, Care bundle removal/Undo, refresh persistence and saving the unchanged Focus configuration through Edit selection. The original four QA cart items were restored; no customer details were entered. All ten cart data tests, formatting, the production build and whitespace checks passed.

Inspected 1440px, 390px and 320px views. The narrow client and scroll widths matched at 305px. The selected plan control retained a 54px height; its label fits on one line after reducing the gap beside the minus icon. Focus on light cards uses dark purple and focus on the plum card uses lilac. Final captures are `service-plan-remove-{1440,390,320}.jpg` and `service-plan-notice-remove-390.jpg`.

## Service-plan duration selector — 2026-10-01

Service and service-family plan cards now have a 1-, 3-, 6- or 12-month duration selector above them. Native radios support arrow-key selection and visible focus. The chosen term updates every card and is stored in the configuration URL, cart item and checkout payload. Project estimates and monthly rates keep their existing amounts and have explicit billing labels.

Verified keyboard and pointer selection, a three-month Focus plan, a twelve-month Partnership plan, cart and checkout terms, editing Focus from three to six months, refresh restoration, and removal of only the currently selected duration. Both temporary selections were removed afterward, restoring the original four QA cart items. A twelve-month Design family comparison also showed the correct term on all three cards. Existing saved selections were retained and no customer data was entered.

Inspected 1440px, 768px, 390px and 320px layouts. Client and scroll widths matched at 768px (753px), 390px (375px) and 320px (305px); all four duration controls measured 44px high on narrow mobile. Captures are `service-duration-{1440,768,390,320}.jpg`. All twelve cart tests, formatting, the production build and whitespace checks passed. The new data checks cover supported/invalid duration input, distinct configurations, removal/undo, billing and checkout payloads.

## Service cards with periods — 2026-10-01

Service and family plan cards now display the chosen period in a calendar tag, explicit monthly/project billing beside the rate, and a period estimate for monthly plans. Project prices keep their existing amounts. Cart rows highlight saved periods and show multi-month estimates above the features disclosure. Period-specific Edit and Remove labels distinguish otherwise identical selections.

Verified six-month Partnership at CHF 1'450/month and CHF 8'700 for the period, then edited it to twelve months and confirmed CHF 17'400 with five total items. Undo restored the twelve-month item correctly. Removed the temporary selection and restored the original four QA items. No customer data was entered. All thirteen cart tests, formatting, the production build and whitespace checks passed; browser error logs were empty.

Inspected desktop, tablet and narrow mobile. Client and scroll widths matched at 768px (753px), 390px (375px) and 320px (305px). The final mobile adjustment keeps the calendar tag compact and allows the billing suffix to wrap separately from the price. Captures are `service-period-cards-{1440,390,320}.jpg` and `cart-service-period-{1440,390,320}.jpg`; these are viewport captures rather than full-page images.

## Department filters and inline cart periods — 2026-10-01

The bundle builder now filters choices by All, Design, Development, Marketing, IT support and Hosting. Selected services stay in the estimate when hidden by a filter; the filter status identifies selections in other departments. Quick-start bundles reset to All. The builder also displays and saves the chosen numeric service period.

All service cart rows have native 1-, 3-, 6- and 12-month controls that save without leaving the page. Period changes preserve scope, rates and billing, update configuration links and checkout data, retain focus on the updated selector, and offer Undo. Matching configurations combine; Undo restores the original items. Older rows show Choose period until a numeric term is chosen, preserving their saved duration in the meantime.

Browser checks covered cross-department Graphic design/SEO selection, preserved hidden selections and counts, Care quick-start resetting to All, and keyboard filter activation. Added a temporary three-month Care bundle, changed it to six months in the cart, refreshed, reopened its builder with all three services and six months restored, cancelled editing, and confirmed the six-month item in the empty checkout form. Mobile checks changed the original Focus, Care and Launch rows and restored each with Undo. The temporary Care bundle was changed to twelve and three months, then removed; the original four QA items were restored. No customer details were entered.

Inspected 1440px, 768px, 390px and 320px. Client and scroll widths matched at tablet and mobile sizes (753px, 375px and 305px), and filters and period controls measured 44px high. Captures are `service-department-filter-{1440,390,320}.jpg` and `cart-inline-period-{1440,390,320}.jpg`. All sixteen cart tests, formatting, the production build and whitespace checks passed; browser error logs were empty. New tests cover department catalog filtering, period persistence and checkout data, preserved prices and scope, duplicate combination, Undo and on-request estimates.

## Builder step order and duration placement — 2026-10-01

Choose how we work is now step 1 in the DOM, followed by Pick your services as step 2. The duration selector sits inside Pick your services immediately above department filtering and service choices. Work-type buttons expose their selected state, and the duration rail can wrap within the builder's available width.

Verified keyboard order from One-off project to Ongoing partnership, keyboard selection of partnership and three months, and Design filtering with a selected Development service retained in the estimate. The summary showed the chosen engagement and period. Restored One-off project, one month and All departments afterward; no cart items or customer data were changed.

Inspected 1440px, 1024px, 390px and 320px. Client and scroll widths matched (1425px, 1009px, 375px and 305px), and duration and department controls remained 44px high. Narrow mobile retained the two-by-two duration layout and scrolling department rail; keyboard focus remained visible. Captures are `service-builder-order-{1440,390,320}.jpg`. The production build, formatting and whitespace checks passed, and browser error logs were empty. This layout-only pass did not rerun the cart data tests.

## Cart aligned with the builder — 2026-10-01

Service rows now separate How we work, Service duration and Selected services, using the builder's shared native pill radios. Each row has an independent group and unique heading/hint IDs. Selected service names and catalogue department labels are visible without opening the retained native feature disclosure. Bundle links say Edit in builder; individual plans say Edit plan. Rates, stored legacy wording and the separate monthly/project overview remain intact.

Keyboard selection changed the legacy Focus item to three months while Care and Launch stayed unselected; Undo restored Focus's original wording and returned focus to its duration controls. Changed Care to six months, confirmed CHF 3'828/month and CHF 22'968 over the period, opened/closed its service features, and restored it with Undo. Added a temporary two-service custom bundle with three months and ongoing partnership, changed it to six months by keyboard, refreshed, and reopened Edit in builder with both selected services, partnership and six months intact. Cancel left it saved. The empty checkout form included six months and CHF 2'755/month. Removed the temporary bundle and restored the original four QA items; no customer details were entered.

Inspected 1440px, 768px, 650px, 390px and 320px. Client and scroll widths matched (1425px, 753px, 635px, 375px and 305px); duration targets measured 44px. Intermediate-width duration rails measured 53.6px high rather than stretching vertically, and narrow mobile used the shared two-by-two layout. No duplicate IDs or browser errors were found. Captures are `cart-builder-aligned-{1440,390,320}.jpg`. All sixteen cart tests, formatting, the production build and whitespace checks passed.

## Service filtering within department plans — 2026-10-01

Department comparisons with multiple services now have a native Filter by service dropdown before the selected scope and duration controls. The department overview remains available. Selecting a child service updates all three plan scopes, features and cart selections, retaining published prices and the chosen duration. The plan-service query parameter restores the choice on refresh and Edit plan. Single-service departments and service-detail pages retain their fixed scope without another filter.

Verified Design's department overview, Graphic design and Brand development comparisons at twelve months, including matching Focus/Connected/Partnership scope and published features. Native keyboard navigation changed the overview to Graphic design without changing duration. Added a temporary Brand development Focus plan, changed twelve months to three in the cart, refreshed, and reopened the department comparison with Brand development and three months restored on all cards. Cancel preserved it. The empty checkout form carried only the chosen service at CHF 1'800/project and three months. Removed the temporary plan and restored the original four QA cart items. Confirmed that Hosting and Graphic design detail show no filter; no customer details were entered.

Inspected 1440px, 768px, 390px and 320px. Client and scroll widths matched (1425px, 753px, 375px and 305px). The native dropdown measured 54px high; mobile duration targets remained 44px. Full selected service names remain visible in the scope lockup beneath the compact dropdown. Captures are `department-plan-filter-{1440,390,320}.jpg`. All seventeen cart tests, formatting, the production build and whitespace checks passed; browser error logs were empty. The new test covers catalogue scope resolution, invalid/cross-department fallback, matching plan features and preservation of the service filter during cart period updates.

## Refined service dropdown — 2026-10-01

Filter by service now uses a branded select-only combobox and rounded listbox instead of the browser's operating-system menu. Full names wrap naturally; each option includes existing catalogue capability hints, and the saved selection has a checkmark. The panel opens above or below the control to fit the viewport and scrolls when needed.

Arrow keys, Home/End, type-ahead, Enter/Space and Tab support selection. Escape, outside click and focus departure dismiss the panel; Escape and outside click preserve the saved choice. DOM focus stays on the control during list navigation and pointer selection. Changing department or the saved service closes the panel. Existing duration, plan updates and URL restoration remain intact.

Desktop, 390px and 320px captures are `refined-service-dropdown-{desktop,390,320}.png`. The cart regression suite, production build, formatting and whitespace checks passed.

## One plan system, comparison and live cart — 2026-10-01

Starter, Complete and Ongoing replace Focus/Connected/Partnership, Essential and Launch everywhere. Prices come only from `service-catalog.js` and `software-catalog.js` (per-service plan price plus a saving that never drops). The cart suite now has 26 tests covering:

- legacy migration;
- an exhaustive check that savings never drop across every service and software subset;
- builder, plan card and cart producing the same item and price;
- plan, commitment and term switching with merge and Undo;
- totals, including the total for chosen periods and savings;
- overlap fixes that keep the higher plan;
- checkout preferences.

Verified in the browser (local preview only; test contact values; nothing sent):

- **Services builder:** for brand + web development it shows Starter CHF 3'420, Complete CHF 7'980 (recommended) and Ongoing CHF 2'755/month. Switching to Ongoing shows the Monthly commitment and the period total, and writes `services`/`plan` to the URL. The compare dialog opens with focus on Close, locks scrolling, closes on Escape and returns focus to its trigger.
- **Graphic design plan cards:** Starter is recommended for a single service. The cards show "Everything in Starter, plus…", Ongoing carries the commitment pills, and Compare and all-plans links follow the cards.
- **Software:** the builder shows HR Starter CHF 33 (recommended), Complete CHF 40 and Ongoing CHF 48, matching the product page. The compare view `#/plans/suite/…` shows Complete recommended. Switching the term to 12 months gives CHF 125/150/181, with 12-month totals, without scrolling.
- **Cart:**
  - Plan switches (real click) keep focus on the chosen radio. Undo restores the item and focus.
  - Compare plans marks the current plan, and "Switch to Starter" closes the dialog and updates the item.
  - Changing Care to 12 months gives CHF 45'936, and the total for chosen periods updates.
  - The cart check flagged Website management inside the Care bundle; its fix removed the separate item and focused Undo.
  - Refresh keeps plans, terms and commitments.
- **Checkout:** choosing Phone without a number shows an error and focuses the phone field. The preview shows the preferences, each plan and period, and the totals.
- **`/plans`:**
  - The desktop table keeps prices on one line.
  - Below 900px each row becomes a card.
  - Compare-and-choose adds Website management on Ongoing (recommended).
- **Compact duration pills** show one even row or an even 2 × 2 grid at card widths of 285–461px. Cart terms stack evenly on mobile.
- **No horizontal overflow** at 320, 390, 768 and 1440px on `/services`, a family and a service view, `/software`, a product page, the compare view, `/cart`, `/checkout` and `/plans`.

The in-app browser pane was narrow, so desktop layouts were checked by measurement rather than full-size screenshots.
