# OrgTik frontend

React + Vite implementation of the supplied **OrgTik Website3.html** reference. See the [repository README](../README.md) for routes and scope.

## Development

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

## Verification

```sh
npm run format:check
npm run test:cart
npm run build
```

Output: `dist/client`. Configure an SPA fallback for every page path.

## Editing

The ten page components in `src/reference` contain each page's content, presentation, and interaction state. `site.css` contains global accessibility and typography rules; `states.css` preserves the reference's hover treatments. Navigation lives in `src/reference/navigation.js` and `src/App.jsx`. Assets use root-relative URLs and local fonts, so nested routes do not depend on third-party CDNs.

The import utility converts the supplied export into regular React source. It is a migration tool, not a build step. Do not rerun it over subsequent manual changes without reviewing the diff. The bundled document runtime and editable image-upload widget are not shipped. `image-slot.js` is a display-only image element preserving the reference's image framing and logo mirrors.

## Purchasing and CRM handoff

`/plans` is the Bundles & pricing directory. Each service and software product has one package with identical published features across 1, 3, 6, and 12 months. Department bundles and separate service/software builders feed one editable cart. Hosting is purchased externally at https://orgtik.ch.

`src/reference/purchase-catalog.js` owns sample CHF monthly prices, bundle templates, URL compatibility, migration, and pricing. Each line receives the larger of its duration saving and configured-group item-count saving, without stacking. Prices are rounded once per full-period line and summed. Tax calculation is unconfigured.

Cart v2 preserves legacy selections for review, supports mixed durations and per-item renewal, explicit duplicate resolution, Save/Cancel content edits, and immediate changes with Undo. Only cart configuration persists in localStorage; customer details remain in memory.

Checkout offers guest or demo sign-in, minimal billing details, and a simulated payment with success/decline/cancel outcomes. Successful purchases proceed to a separate CRM handoff, with ready/pending/failed account setup and independent retries. Software activates after payment; service periods await CRM onboarding. A non-sensitive session receipt survives refresh without retaining verified identity.

`src/reference/purchase-adapter.js` defines the mock payment and CRM boundary. No actual charges, account creation, emails, or invoices occur. An unset `VITE_CRM_PORTAL_URL` opens a labeled handoff preview. Production pricing, payment verification, identity, onboarding, invoices, and customer dashboards belong to the backend and separate CRM project.

See [PURCHASING.md](PURCHASING.md) for the contract, storage, legacy-link behavior, integration configuration, and QA scenarios. Older tier and enquiry documents describe previous iterations.

The [purchasing journey review](qa/journey-review/README.md) records the latest UX changes, before/after screenshots, and browser checks.
The follow-up [design corrections](qa/design-fixes/README.md) address pricing hierarchy, spacing, card alignment, and mobile controls.

## Browser verification

`tools/verify.cjs`, `tools/interactions.cjs`, and `tools/capture.cjs` use Playwright and connect to a local browser debugging endpoint at port 9222. Set `PLAYWRIGHT_MODULE_PATH` to the available Playwright package when it is provided by the workspace runtime. These are development checks, not production dependencies. See `design-qa.md` for the actual coverage and build status.
