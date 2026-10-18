# OrgTik frontend project plan

Prepared: 20 September 2026  
Status: frontend implementation in progress; P01–P18 public template families are available as a routed local preview, with final content approval and release polish still pending.
Scope: UI/UX, customer experience, product design, and frontend only.  
Source brief: [Enhanced website IA](orgtik-website-ia.md).  
Brand source: [ORGTIK.pdf](ORGTIK.pdf), all 21 pages reviewed.  
Confirmed media decision: **use an animated video placeholder in the hero**.

Implementation update — 21 September 2026: the selected cinematic direction now extends across the planned frontend route inventory. Services include the later-approved fifth **OrgTik hosting** family. Forms, plan configuration, account/recovery, filters, and roadmap participation remain deterministic local previews with no backend behavior. Owner-approved client proof, legal text, pricing, roadmap commitments, and final product captures are still required before public release.

## 1. Recommended direction

Build a premium, cinematic OrgTik website that makes two paths immediately understandable: **build and grow with services**, or **run the business with modular software**. Let the brand's typography, composition, original artwork, and controlled motion create the premium feel.

Use deep plum and indigo, strong white typography, restrained violet light, generous space, and quieter light reading sections. The central visual motif is a fine connection line linking business needs, services, and modules. It is a proposed website treatment inspired by the PDF's technical patterns, not a motion rule defined by the brand manual.

The first implementation milestone will be the shared navigation, homepage, real animated hero placeholder, and contact preview at desktop and mobile sizes. This establishes a reviewable standard before extending the system across the full site.

## 2. What the review found and changed

The existing brief is strong on positioning, page reuse, content hierarchy, and accessibility intent. It needs a more explicit delivery contract and fewer ambiguous dependencies.

| Finding | Change made to the brief | Why it matters |
|---|---|---|
| Authentication, subscriptions, CMS, and participation appear alongside frontend deliverables. | Added a feature-by-feature frontend contract and honest demo outcomes. | Makes scope testable and avoids implying real transactions or messages. |
| Work appears in navigation but has no listing page. | Added P18 Work index at `/work`. | Visitors can browse evidence before opening a case study. |
| Categories and article slugs share one URL pattern. | Categories use `/insights/category/{category}`. | Removes ambiguous routes. |
| Three sections suggest different headers. | Defined one global navigation with optional local module links. | Visitors retain their bearings across services and platform content. |
| Home contains twelve potential marketing sections. | Defined seven core launch sections; other blocks are conditional. | Reduces competing decisions and repetitive proof. |
| Contact asks for a required mobile number. | Proposed name, email, message, and intent; phone/company optional. | Reduces enquiry effort while preserving context. |
| Some apparent brand tokens are website interpretations. | Added a PDF page/source map and labelled web-system additions. | Keeps the original brand accurate. |
| Bright violet could be used with small white labels. | Recorded the calculated 4.23:1 solid-color contrast limitation. | Provides a concrete button/text pairing decision. |
| Historical timeline PDFs and a route/content export are missing. | Marked inherited examples and counts as unverified. | Prevents draft claims from becoming published evidence. |
| Video assets are absent. | Recorded the user's animated video placeholder decision. | Development can proceed after plan review without waiting for final footage. |

The original Markdown is preserved in `docs/archive/orgtik-website-ia.2026-09-20.original.md`.

## 3. Brand and asset plan

### Verified foundations

- PDF page 8 specifies `#190B25`, `#3B1E59`, `#6C3CAA`, `#9458F4`, `#121649`, `#243089`, `#394BC6`, and `#4157F7`.
- Pages 5–6 show Montserrat and Arial. Use Montserrat for display and key interface text; Arial provides body/utility fallback where appropriate. Do not synthesize unsupported weights.
- Pages 3–4, 7, and 9–16 provide emblem, wordmark, color/application, safe-space, and icon references.
- Pages 17–20 provide raster brand mockups: cards, phone, glass card, and tablet. These are brand imagery, not proof of a functioning SaaS interface.
- There are vector paths in the logo/wordmark pages. Extract original shapes where practical and inspect exports; gradient/raster artwork may need a high-resolution transparent export.

### Asset preparation after plan review

| Output | Source and treatment | Acceptance |
|---|---|---|
| Dark/light logo variants | Extract original PDF artwork; retain emblem/wordmark proportions. | No retyping, redrawing, distorted geometry, background fringes, or unsafe crops. |
| Emblem and favicon set | Use the original mark and page 16 application reference. | Legible at actual icon sizes; retain a simplified approved solid variant when needed. |
| Brand textures/mockups | Export suitable artwork with recorded source page and intended use. | No guideline labels accidentally included; no claim that mockups show real product features. |
| Font files | Use an approved Montserrat web-font source; obtain only the necessary weights. | License/source recorded; stable fallback layout; no unlicensed Arial redistribution. |
| Hero placeholder | New, temporary animation made from appropriate original brand artwork. | Actual playable video, desktop/mobile composition, posters, clear replacement instructions. |
| Product/project visuals | Use owner-approved captures when available. | Otherwise a clearly labelled concept/example; no fabricated dashboard features or client results. |

Create an asset manifest with source page/file, variant, dimensions, transparency, crop/focal point, approval status, and usage. Keep the original PDF unchanged. Export only useful assets rather than shipping the 32.7 MB manual as a website background.

### Proposed web design tokens

Use CSS variables for color, typography, spacing, radius, elevation, and motion. These specifications extend the manual for the web:

| Token group | Starting direction |
|---|---|
| Layout | Approximately 1280 px maximum content width; 12/8/4-column desktop/tablet/mobile grids. |
| Gutters | Approximately 64 px desktop, 32 px tablet, 20 px mobile, adjusted to content. |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px scale. |
| Type | Fluid hero approximately 40–88 px, section titles 30–56 px, body 16–18 px; verify long German labels. |
| Reading width | Around 60–70 characters; comfortable line height and visible paragraph rhythm. |
| Radius | Restrained 8–12 px controls, 16–24 px major media frames; avoid universal pill styling. |
| Surfaces | Plum/indigo foundation; white or proposed warm-white reading sections; subtle borders. |
| Actions | White on dark plum, or white on deeper violet/blue; bright violet used selectively. |

Calculated opaque color pairings from the supplied hex values: white/deep plum approximately **18.82:1**, white/deep indigo **16.98:1**, white/violet `#6C3CAA` **7.33:1**, and white/electric blue **5.34:1**. White/bright violet `#9458F4` is approximately **4.23:1**, and deep plum/bright violet is approximately **4.45:1**. Neither of the latter two is a default small-text pairing. Re-test actual gradients, opacity, focus states, and video frames.

## 4. Customer journeys and page scope

| Journey | Intended sequence | Frontend completion |
|---|---|---|
| Buy a service | Home → Services → family/detail → relevant work → Contact | Enquiry context carried forward; validation and explicit preview outcome. |
| Evaluate software | Home → Platform → module → Plans → review → Contact | Selections persist locally; honest pricing availability; no checkout. |
| Validate expertise | Work → filters → case study → relevant service/contact | Evidence is easy to scan; every project card has a meaningful destination. |
| Learn through content | Insights → category/article → related solution | Readable content, working filters and pagination, clear next action. |
| Existing customer | Persistent Sign in → account/recovery preview | Demonstrates the interface only; no real credentials requested or stored. |
| Explore the roadmap | Timeline → filters → idea drawer → demo participation | Clearly labelled local interaction and recoverable states. |

Use **Start a project** as the consistent navigation CTA, **Explore the platform** as the homepage hero's primary CTA, and **Choose this module** for module selection. Limit each section to one primary decision. Do not gate pricing information behind an account preview.

### Homepage composition

1. **Cinematic hero:** stable HTML headline “Build the business. Run it better.”, concise positioning, two clear paths, branded animated video placeholder.
2. **Decision gateway:** “Run the business” and “Build and grow”; make both destinations understandable without hover.
3. **Platform overview:** six selectable modules update one focused visual and benefit statement; static equivalent for reduced motion.
4. **Services:** four editorial rows/pathways with concrete deliverables, avoiding another repeated card grid.
5. **Selected work:** one lead story and supporting projects using approved evidence or explicitly labelled private-preview samples.
6. **Partnership process:** Understand → Design → Deliver → Evolve, with useful outputs at each step.
7. **Closing action and footer:** platform or project enquiry, contact routes, clear navigation, brand signature.

### Full template inventory and build order

| Delivery group | Templates |
|---|---|
| First reviewable milestone | P01 Home, P08 Contact, shared header/footer/navigation/media system. |
| Commercial journeys | P02 Services, P03 Service family, P04 Service detail, P13 Platform, P14 Module, P15 Plans. |
| Trust and evidence | P07 About, P18 Work index, P17 Case study. |
| Content and participation | P05 Insights, P06 Article, P12 Timeline/Roadmap. |
| Utility and account preview | P09 Legal, P10 Sitemap, P11 Error, P16 Sign in/recovery preview. |

Total: **18 templates**, **15 priority mobile layouts**, and targeted mobile validation for Legal, Sitemap, and Error. Shared templates populate the four service families, ten service details, and six modules from structured local data. Start content QA with a short article, a long article, a local/editorial variant, and representative case studies; importing all 95 inherited articles is not assumed without a supplied export.

Use `/work` for the missing work listing and `/insights/category/{category}` for categories. Keep article routes at `/insights/{slug}`. URL/query changes must preserve filters through Back/Forward, reset invalid pagination, and fail gracefully for unknown entries.

## 5. Animated hero video placeholder

The requested placeholder will be **a real looping video**, not a static poster or a CSS-only substitute. Keep it configurable so final media can replace it without changing hero markup or layout.

### Art direction and storyboard

Use a restrained **10–15 second** sequence. The times below describe a proposed 12-second version:

| Time | Motion |
|---|---|
| 0–3 seconds | Deep plum field with slow directional violet illumination; headline area stays quiet. |
| 3–7 seconds | Original emblem or a suitable extracted brand application enters a subtle light pass; preserve its shape and safe space. |
| 7–10 seconds | The source-inspired connection pattern advances gently into indigo depth. |
| 10–12 seconds | Light and composition return smoothly to the opening for a seamless loop. |

Desktop: reserve the left portion for readable copy and place visual emphasis toward the right. Mobile: recompose the focal object above or behind a controlled dark field; do not rely on a blind center crop. Keep all headlines and CTA text in HTML. Do not include invented people, client work, product screens, metrics, or claims in the placeholder.

### Media delivery and behavior

- Supply a widely compatible MP4 and an optimized WebM alternative, with desktop/mobile assets and a poster per composition. Load only the appropriate rendition.
- Proposed project budgets: desktop video **up to 4 MB**, mobile video **up to 2 MB**, desktop poster **up to 200 KB**, mobile poster **up to 120 KB**. These are engineering budgets, not external standards; adjust composition before relaxing them.
- Render a correctly sized poster and readable content immediately. Attach/start the video only when playback is appropriate; `preload` alone does not guarantee deferred loading when autoplay is present. Use muted inline playback and handle rejected playback. [MDN video behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video).
- Provide a visible, keyboard-operable pause/play control whose label matches the actual playback state. Keep it readable over every frame. Auto-playing movement lasting more than five seconds needs a pause/stop/hide mechanism. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
- Use a static poster when reduced motion is requested; when a supported data-saving signal is present; or when playback fails. Do not depend on a universally available battery API.
- Pause off-screen and in hidden tabs; resume automatically only if the visitor has not explicitly paused. Respect preference changes while the page is open.
- No audio track is needed for this decorative placeholder. Hide purely decorative media from assistive technology, retain accessible controls, and preserve all meaning in text.
- Record the placeholder status in the asset manifest and review documentation. Do not present it as a finished commissioned brand film.

Hero acceptance: normal playback verified, seamless loop, legible text during the full loop, responsive crop checked, no layout jump, and usable poster/controls in reduced-motion, rejected-autoplay, and media-failure states.

## 6. Premium motion and effects specification

Motion should establish hierarchy, show cause and effect, and reward exploration. Use one focal effect at a time.

| Element | Proposed treatment | Reduced-motion / touch behavior |
|---|---|---|
| Hero | Slow video lighting, restrained emblem moment, short copy entrance with no waiting screen. | Poster and immediately visible copy. |
| Header | Transparent-to-solid surface change as the hero leaves view; stable size. | Immediate surface change; never obscure focused controls. |
| Section reveals | 350–550 ms opacity/12–20 px translation, once per section; small 50–80 ms stagger. | Visible by default; remove positional movement. |
| Module selector | 200–300 ms visual crossfade plus selected-line movement; stable content area. | Instant or brief opacity change; explicit tabs/buttons work by touch and keyboard. |
| Service/project media | Subtle mask reveal and up to approximately 1.025 image scale on capable pointer devices. | Static media; descriptive text and action remain visible. |
| Timeline | Progress line reflects scroll position without controlling scrolling. | Full static line and readable chronology. |
| Plan builder | Selection highlight and 180–250 ms summary transition, with stable layout. | Immediate update; polite status feedback for meaningful changes. |
| Menus/drawers | 180–280 ms enter/exit with correct focus and Escape behavior. | Short fade or immediate state change. |
| Buttons/links | 120–180 ms color, underline, and small arrow feedback. | Equivalent visible focus/pressed state; no hover-only meaning. |

Use a consistent easing family, starting with `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and a quicker ease-out for controls. Verify perceived pacing in the browser instead of treating timings as immutable.

Prefer opacity and transform animations, static grain/texture, and small local highlights. Keep native scrolling, the system cursor, and predictable focus. Avoid scroll hijacking, perpetual particles, background WebGL by default, large animated blur fields, bouncing cards, mandatory loading intros, and constant moving text.

Use a shared reduced-motion policy plus explicit handling for video and bespoke effects; a component animation setting alone does not control the entire media system. [Motion accessibility guidance](https://motion.dev/docs/react-accessibility).

## 7. Frontend engineering approach

Recommended baseline: **React + TypeScript**, a static frontend build such as **Vite**, scoped component styling/CSS variables, one established icon family, and **Motion for React** for the few interactions that need orchestration. Prefer ordinary CSS for simple hover/focus transitions. Vite provides React/TypeScript project support; the exact template and compatible package versions will be checked when implementation begins. [Vite guide](https://vite.dev/guide/).

Select the appropriate Product Design web starter after the visual direction is chosen. Keep its existing build conventions where suitable rather than imposing an unnecessary second build system. Do not add multiple animation engines, a UI kit with an unrelated visual style, or a server runtime to solve this static site.

| Area | Planned approach |
|---|---|
| Components | Shared SiteHeader, MobileNav, SiteFooter, VideoHero, SectionHeading, Button, Accordion, Filters, Dialog/Drawer, MediaFrame, and form primitives. |
| Content | Typed local objects/JSON or build-time Markdown for services, modules, work, insights, and timeline; stable IDs and approval/demo status. |
| Routing | Real navigable paths, route-aware focus/title updates, deep-link support, validated query parameters, and a useful not-found screen. |
| State | Local component state; non-sensitive plan/filter state in URL or session storage where appropriate; resilient in-memory fallback. |
| Forms | Semantic labels, intent-based fields, validation, error summary, preserved in-memory input, and explicit demo status. |
| Account preview | Synthetic example fields/scenarios; no authentication network requests or password persistence. |
| Assets | Responsive source sizes, original logos, explicit dimensions, appropriate alt text, priority hero poster, deferred below-fold images. |
| SEO preparation | Route titles/descriptions, semantic headings, sitemap from the registry, approved social-preview assets, and static pre-rendering where the chosen starter supports it. |
| Localization | English preview first; structured copy and locale-ready routes/components. Reviewed DE/FR/IT content activates those destinations later. |
| Verification | Production build/type checks, focused tests for state-heavy behavior, and manual browser/keyboard/visual checks. |

The output should be static frontend files. Build-time generation is acceptable; runtime APIs, databases, CMS administration, backend functions, checkout, live analytics, account services, mail delivery, and SaaS dashboards are excluded. Document deployment needs such as deep-link rewrites, cache/media headers, canonical host, and redirects without configuring a host in this phase. Private preview content should not be represented as an SEO-ready public release.

## 8. Delivery phases and review points

| Phase | Work and concrete deliverable | Exit condition |
|---|---|---|
| 0. Review and planning — complete | Inspect Markdown/PDF; preserve original; update IA, scope, routes, media decision, and this plan. | User receives the enhanced brief and plan before development. |
| 1. Visual direction and assets | Extract relevant original artwork; prepare three brand-grounded homepage visual options, including mobile intent and hero placeholder storyboard. | User selects one visual target; no application scaffolding before selection. |
| 2. Foundation and first milestone | Initialize frontend; implement tokens, shared shell, accessible navigation, Home, animated video placeholder, and Contact preview. | Desktop/mobile preview makes positioning clear and proves the media/motion approach. |
| 3. Commercial and proof pages | Build service and platform families, plan builder, About, Work index, and case-study template. | Both service-to-enquiry and module-to-plan-review journeys work with local data. |
| 4. Remaining templates and edge states | Complete Insights/Article, Roadmap demos, Legal/Sitemap/Error, and Sign in/recovery preview; populate representative variants. | All 18 templates and visible navigation destinations are covered. |
| 5. Polish and handoff | Verify responsiveness, accessibility, state behavior, assets, performance, and visual fidelity; document remaining content/approval gaps. | Reproducible local preview/static build, asset manifest, QA record, and handoff notes. |

Phases are sequence and review points, not a promise that all templates fit into one quick implementation pass. The three concepts will explore **cinematic brand**, **editorial technology**, and **connected systems** within the same PDF palette/logo/typography. This plan does not select a final visual composition on the user's behalf.

Review the first milestone before propagating its styling across the other templates. Reserve final footage replacement, bulk content migration, live integrations, and deployment for separately requested work.

## 9. Acceptance and verification

### Experience and responsive quality

- All top-level destinations, logo/home links, breadcrumbs, CTAs, filters, pagination, and drawers work with no misleading dead ends.
- One consistent global header; services and software paths are understandable in the first two sections.
- Test representative widths at 360/390, 768, 1024, 1440, and 1920 px, plus narrow reflow and text zoom; include long headings and empty/missing media.
- Mobile navigation, comparison layouts, forms, and sticky actions remain usable; avoid horizontal document overflow and content covered by fixed controls.
- Browser checks in available Chromium/Edge, plus Safari/iOS and Firefox when those environments are available. Report unavailable coverage rather than implying it passed.

### Accessibility and motion quality

- Target WCAG 2.2 AA for the delivered UI; verify semantic structure, meaningful headings, labels, keyboard reachability, visible focus, error announcements, and drawer focus return.
- Contrast-check real rendered surfaces, including video overlays and interaction states. Design primary controls around comfortable 44 px interaction areas.
- Verify reduced motion, explicit pause persistence, keyboard media controls, hidden-tab/off-screen pausing, and no essential hover-only information.
- Keep content visible if enhancement scripts fail; no entrance animation should permanently hide the page.
- An automated score alone is not an accessibility conformance claim; record manual checks and any remaining issues.

### Performance quality

Use **LCP ≤2.5 s**, **INP ≤200 ms**, and **CLS ≤0.1** as eventual field targets at the 75th percentile, segmented by desktop/mobile. Local lab checks guide optimization but cannot establish field INP or claim real-user performance without production data. [Core Web Vitals guidance](https://web.dev/articles/vitals).

Project budgets: initial route JavaScript approximately **≤200 KB gzip**, initial CSS **≤50 KB gzip**, and critical first-load assets **≤1 MB excluding deferred video**. Check actual output and critical requests; split heavier interactive templates and keep the homepage payload focused. These are proposed project budgets, not measured results or universal requirements.

Verify video/poster budgets from section 5, avoid downloading both mobile and desktop loops, reserve media dimensions, and prevent noncritical imagery from competing with the hero poster/font loading.

### Meaningful functional checks

- Plan selection survives navigation and handles invalid query state/storage failure.
- Combined filters, result counts, pagination reset, and Back/Forward restoration are correct.
- Drawers open from deep links, close with Escape, and return focus to the correct trigger.
- Form validation preserves input; every simulated result explicitly states no message/account/transaction was created.
- Video failure and autoplay rejection preserve the poster and usable content.
- A clean production build and type check pass. Use targeted tests for these behaviors rather than testing every decorative style.

## 10. Defaults, dependencies, and next decision

| Item | Default for frontend work | What requires later owner input |
|---|---|---|
| Hero media | Confirmed animated branded video placeholder. | Final footage and preferred replacement crop. |
| Visual direction | Three PDF-grounded options after this plan is reviewed. | Selection of one option before coding. |
| Brand/product name | OrgTik; “Business Suite” remains a working product label. | Final product naming. |
| Product features | Use inherited descriptions as review copy; label unavailable captures as concepts. | Which modules/features are live, beta, or planned. |
| Pricing | Contact for pricing; functional local module selection. | Approved prices, bundles, limits, tax/billing copy. |
| Enquiry/account/roadmap | Explicit local demos; no external submission. | Future endpoints and policies only if integration is separately requested. |
| Customer proof | Omit unsupported metrics/endorsements; use labelled private-preview samples. | Approved projects, media, quotations, and measurement sources. |
| Languages | English preview with localization-ready structure. | Reviewed DE/FR/IT copy and launch language scope. |
| Legal/contact | Owner-supplied content; mark inherited information unverified. | Legal entity, final policies, and verified contact details. |
| Figma/deployment | Neither is required or performed by this planning step. | Separate request if an editable Figma handoff or hosted release is wanted. |

**Next step:** review this plan, then authorize visual exploration. The next output is three homepage directions using the real PDF brand assets and the animated video placeholder concept; frontend coding follows selection of the preferred direction.
