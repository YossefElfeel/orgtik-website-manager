# OrgTik website

OrgTik's responsive React website, updated from the supplied **OrgTik Website3.html** reference on 28 September 2026. The reference's ten page groups, detail views, layouts, content, imagery, motion, and local interactions are ported to editable React components.

## Run and build

```sh
cd landing-directions
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run build
```

The static build is written to `landing-directions/dist/client`. Hosts must serve `index.html` for client-side routes; the existing Vercel rewrite is included.

## Pages

| Route                | Content                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `/`                  | Homepage, services accordion, software explorer, selected work, process                     |
| `/services`          | Five service families, service details, service builder with Starter/Complete/Ongoing plans |
| `/software`          | Six products, product details, workspace builder with inline plan choice, plan comparison   |
| `/plans`             | Plans & pricing: every service and software plan with its price, compare and choose         |
| `/cart`, `/checkout` | Editable cart with plan switching, live totals and cart check; enquiry preview              |
| `/work`              | Filterable projects and project stories                                                     |
| `/about`             | Studio story, mission, journey, capabilities                                                |
| `/insights`          | Searchable and filterable insights and articles                                             |
| `/contact`           | Project, software, and ongoing-care enquiry previews                                        |
| `/roadmap`           | Roadmap filters, local voting, suggestion preview                                           |
| `/legal`             | Imprint, privacy, terms, sitemap previews                                                   |
| `/sign-in`           | Sign-in and account recovery previews                                                       |

Detail views retain the reference's hash routes, for example `/software#/product/hr` and `/services#/family/design`. Previous `/platform`, `/projects`, service-detail, insight-detail, pricing, and legal URLs resolve to the corresponding new journeys.

## Source

- `landing-directions/src/reference/`: editable page components and reference styling.
- `landing-directions/src/App.jsx`: lazy-loaded page routing and browser history.
- `landing-directions/public/assets/`: supplied brand images, videos, logos, and local fonts.
- `landing-directions/tools/import-reference.mjs`: one-time export conversion utility; runtime does not require the export or its viewer.
- `landing-directions/design-qa.md`: current verification results.

The original plans and information architecture are retained as historical planning documents. The September 28 HTML reference takes precedence for the current implementation.

## Preview boundaries

Frontend only. Forms, sign-in, password recovery, voting, and plan choices are local demonstrations. They do not send messages, authenticate accounts, create subscriptions, or charge payments. Placeholder client logos, sample work, estimates, and legal copy retain their preview labels. No backend or deployment is included.
