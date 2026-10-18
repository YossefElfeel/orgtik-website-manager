# OrgTik website: templates, content, branding, and UX/UI scope

Review date: 20 September 2026  
Review basis: this Markdown brief and all 21 pages of `ORGTIK.pdf`. References to former-site findings are inherited discovery notes, not a new live-site audit.  
Prepared for: UI/UX, customer experience, product design, and frontend implementation planning.  
Scope: frontend only, with reusable templates and local content. No backend development.  
Delivery sequence and acceptance criteria: [Frontend project plan](orgtik-frontend-project-plan.md). Development begins only after the user has reviewed the plan and authorizes the next stage.

## Current delivery contract

This section governs the current build. The detailed page inventory below also preserves future product behavior and historical content for reference; neither expands the frontend-only scope.

### What this project delivers

- A responsive public website with **18 reusable page templates**, including the previously missing **P18 Work index**.
- A brand system based on the actual PDF: extracted logo artwork, its eight specified colors, Montserrat/Arial typography, and approved imagery/textures.
- A real background video in the homepage hero, plus responsive posters, pause/play, reduced-motion handling, and failed-playback recovery. A CSS gradient alone does not satisfy the video requirement.
- Premium motion that clarifies hierarchy and interaction: one signature hero sequence, restrained section reveals, purposeful module/plan transitions, and polished navigation.
- Working browser interactions using local fixtures, including navigation, filters, pagination, accordions, drawers, plan selection, and validation.
- Responsive, accessibility, route, media, and performance verification. These are acceptance checks to complete during implementation, not claims that the website is already tested.

### Frontend behavior by feature

| Feature | Current implementation | Boundary |
|---|---|---|
| Services, modules, work, articles | Local structured content and shared templates; filters/search operate on supplied entries. | No CMS, database, scraping, or full legacy-content migration. |
| Contact and newsletter | Validation and clearly labelled preview states; verified email/phone links may open the visitor's own app. | No message delivery, mailing-list signup, third-party form service, or false “sent” confirmation. |
| Plans | Module/bundle selection, comparison, non-sensitive URL/session state, and a review summary. Use “Contact for pricing” until commercial data is approved. | No checkout, payment provider, subscription creation, or invented prices. |
| Sign in and recovery | Clearly labelled interface preview using synthetic demo inputs and deterministic states. | No authentication, account creation, password transmission/storage, token handling, or dashboard access. |
| Roadmap | Local search/filter/view controls, idea drawer, and labelled demo vote/comment/submission states. | No real votes, public comments, moderation service, email notifications, or durable shared state. |
| Localization | English-first preview; shared layouts and content keys prepared for DE/FR/IT. | Only expose languages with actual reviewed content; do not present English as a completed translation. |
| Legal/privacy | Editorial layout with owner-supplied content. Keep missing legal copy visibly marked in the private preview. | No invented legal terms or compliance claims; no tracking services added in this phase. |
| Future integration | Document component inputs and intended UI states. | No API endpoints, server actions, serverless functions, backend SDKs, or integration implementation. |

Never store real passwords, personal form content, or authentication tokens in browser storage. Plan/module IDs and demo vote IDs may be stored locally with a reset path and in-memory fallback. Demo feedback must say what actually happened, for example: **“Preview complete. No message was sent.”**

### Source confidence and missing inputs

- **Verified in this review:** the brand manual has 21 pages, eight explicit palette colors, Montserrat and Arial examples, vector logo/wordmark paths, raster application mockups, and no embedded media annotations or attached video files.
- **Available files:** this brief and `ORGTIK.pdf`. There is no existing frontend code, standalone logo export pack, font pack, video, product capture pack, or content export in the supplied workspace.
- **Inherited, unverified inventory:** 120 routes, 95 articles, contact details, client names, testimonials, milestones, feature claims, and commercial terms. Retain them as discovery inputs; do not treat them as published facts.
- **Missing historical references:** the two timeline PDFs mentioned in the earlier brief are not present. Their transcribed examples below are draft fixtures, not evidence or approved customer quotations.
- **Asset approach:** extract suitable original artwork from the PDF before requesting replacements. Use vector-preserving exports where available; inspect transparency, crop, safe space, and small-size legibility. Never redraw or retype the OrgTik mark.
- **Confirmed hero decision:** the user requested an **animated video placeholder**. During implementation, create a short branded placeholder loop from suitable supplied artwork, with MP4/WebM outputs and poster fallbacks. Keep the media replaceable with final footage. This is a temporary video asset, not an approved final brand film or footage already contained in the PDF.

### Priority corrections from the review

| Issue | Resolution |
|---|---|
| Backend-dependent flows were mixed into a design brief. | Apply the feature contract above and label simulated outcomes. |
| Work appears in the sitemap but has no listing template. | Add P18 at `/work`, feeding P17 case studies. |
| Article and category paths both use `/insights/{value}`. | Reserve `/insights/category/{category}` for categories. |
| Header instructions differ across sections. | Use one global header; product sections may add local in-page navigation. |
| White on bright violet is risky for small text. | Calculated solid-color contrast is about 4.23:1 for `#FFFFFF` on `#9458F4`; use a darker approved surface for small white labels. |
| Video and motion have art direction but few acceptance criteria. | Add delivery budgets, explicit state behavior, and reduced-motion checks in the project plan. |
| The homepage has too many competing proof/marketing sections. | Launch with seven core sections; add supporting bands only when content earns the space. |
| Many decisions were framed as blockers before any design. | Proceed with declared preview defaults; reserve business/content approvals for the affected feature or public release. |

### Recommended homepage launch sequence

1. Video hero: proposition, **Explore the platform**, secondary **Start a project**.
2. Platform/Services decision gateway, with a compact approved trust line if available.
3. Interactive six-module overview using genuine captures or clearly labelled concept visuals.
4. Four service families explained through outcomes and concrete deliverables.
5. Selected work with approved evidence; use a labelled layout sample in private review if evidence is missing.
6. Partnership process with one contextual proof element.
7. Final conversion and global footer.

Roadmap, insights, and hosting remain accessible through navigation/contextual links. Add their homepage preview bands only when they improve the visitor's decision and have approved material. The longer P01 blueprint below is a content library, not a requirement to stack every section.

## Brand foundation — OrgTik

The supplied 2026 OrgTik brand manual is the visual source of truth for the redesign. The former website remains the content and information-architecture source.

### PDF source map

| PDF pages | Verified source material | Web use |
|---|---|---|
| 2–4, 7 | Tagline, O + T emblem, custom wordmark, outline/solid/gradient examples | Preserve original shapes; use appropriate exported variants. |
| 5–6 | Montserrat and Arial examples | Typeface direction; web-font files/licensing are separate from the PDF. |
| 8 | Eight explicit plum/violet/indigo/blue hex values | Exact brand color tokens. |
| 9–10 | Safe-zone construction and contrast/application examples | Preserve safe space; test chosen header/favicon sizes. |
| 11–16 | Color variants and app-icon applications | Source material for dark/light branding and icons. |
| 17–20 | Business-card, phone, glass-card, and tablet mockups | Brand mood and selected approved raster assets; these are not screenshots of the SaaS product. |

The near-black `#08060D`, white utility token, warm-white reading surface, gradients, web type scale, spacing, and motion timings are proposed web-system additions or interpretations. Only the eight hex values on page 8 are explicitly specified palette values. The manual does not supply a motion system or hero video.

### Brand architecture

**OrgTik is the definitive brand across the company website, services, SaaS platform, legal presentation, communications, and account experience.** All migrated copy should use OrgTik consistently. The former name and logo must not appear in the redesigned public experience.

### Brand idea and tagline

- Brand name: **OrgTik** with a capital **O** and **T**.
- Manual tagline: **WE DONT CHASE ATTENTION WE ATTRACT IT**.
- Recommended web punctuation: **We don’t chase attention. We attract it.** Confirm that this editorial correction is approved before launch.
- Intended impression from the manual: confident, premium, technological, focused, and visually magnetic rather than noisy.

### Logo system

- Emblem construction: the manual describes an **O + T** monogram combined into a circular symbol.
- Primary lockup: gradient emblem positioned above the bold OrgTik wordmark.
- Secondary lockups: solid dark-purple on light backgrounds; solid white on dark, purple, or indigo backgrounds; monochrome dark/white variants.
- App/favicon mark: emblem alone inside a rounded-square container.
- Preserve the custom wordmark and angled terminal on the final **k**; do not retype the logo in a standard font.
- Clear space: reserve at least the emblem-unit safe zone shown in the manual on every side of the complete lockup.
- Minimum digital sizes are not specified in the manual; test and document them before handoff, especially the detailed gradient emblem and wordmark terminal.

### Color palette

| Role | Token | Hex | Recommended website use |
|---|---|---|---|
| Deep plum | `brand.plum.950` | `#190B25` | Primary dark background, navigation, footer, cinematic hero overlay. |
| Plum | `brand.plum.800` | `#3B1E59` | Elevated dark surfaces, borders, muted decorative fields. |
| Violet | `brand.violet.600` | `#6C3CAA` | Secondary actions, selected states, supporting graphics. |
| Bright violet | `brand.violet.400` | `#9458F4` | Primary accent, gradient endpoint, focus/highlight—subject to contrast testing. |
| Deep indigo | `brand.indigo.950` | `#121649` | Alternative dark surface and blue-gradient foundation. |
| Indigo | `brand.indigo.700` | `#243089` | Product surfaces, active navigation, data accents. |
| Blue-indigo | `brand.indigo.500` | `#394BC6` | Interactive accents and gradient midpoint. |
| Electric blue | `brand.blue.500` | `#4157F7` | Bright product accent and gradient endpoint. |
| White | `neutral.white` | `#FFFFFF` | Primary text and marks on dark brand surfaces. |
| Near black | `neutral.ink` | `#08060D` | High-contrast dark foundation where deeper than plum is needed. |

Primary brand gradients may move from `#190B25` → `#6C3CAA` → `#9458F4`, or from `#121649` → `#394BC6` → `#4157F7`. Use gradients selectively for the emblem, hero lighting, focus moments, and premium product cues—not as a fill on every component.

All text/background combinations, button states, focus rings, charts, and video overlays require WCAG contrast testing. Bright violet should not be assumed accessible for small text on white.

### Typography

| Role | Typeface | Weights shown in the manual | Website guidance |
|---|---|---|---|
| Primary brand/display | **Montserrat** | Thin, Light, Medium, SemiBold, Bold, Black | Use Medium–Black for display headings, navigation emphasis, numbers, and product statements. Avoid Thin/Light over video or at small sizes. |
| Secondary/system | **Arial** | Regular, Medium, Bold | Use as the fallback and for utility/system contexts when Montserrat is unavailable. |

The manual does not define a complete web type scale. The design system must add responsive sizes, line heights, tracking, paragraph width, link styles, and multilingual fallback coverage without altering the logo typography.

### Visual language

- Dark plum/near-black canvases with controlled violet or indigo illumination.
- High-contrast white typography and restrained, generous composition.
- Subtle technical line/node patterns and fine horizontal rules.
- Soft atmospheric texture, metallic/foil highlights, glass-like product moments, and dramatic light falloff.
- Gradient emblem used as a focal asset, not repeated as decoration.
- Device/product mockups and interface crops treated with purple cinematic lighting.
- Avoid generic neon cyberpunk, excessive glow, constant glassmorphism, and purple gradients on every surface.

### Applying the brand to video heroes

- Grade footage toward deep plum/indigo rather than placing an opaque purple filter over every clip.
- Use a `#190B25`/near-black contrast gradient behind white headings and CTAs.
- Reserve bright violet/blue light for focal motion and transitions.
- The OrgTik emblem may appear in the opening/poster composition, but should not float continuously over every video.
- Poster frames, reduced-motion fallbacks, and mobile crops must preserve the same lighting and focal direction.
- White or monochrome logos are preferred over complex gradients when video detail makes the gradient mark hard to read.

### Required brand assets before production

- Master logo files: SVG/EPS/PDF plus transparent PNG exports.
- Horizontal and stacked lockups.
- Gradient, solid, white, and monochrome variants.
- Standalone emblem/favicon/app icons at required sizes.
- Font licenses/files or approved web-font source for Montserrat.
- Background textures/patterns from the manual, if licensed for digital use.
- Approved color/gradient tokens and contrast-tested UI pairings.
- Confirmation of the registered legal entity wording required for the Imprint, Privacy Policy, Terms, contracts, and invoices.

The mockups in the manual demonstrate mood and application; they are not instructions to reproduce business cards, devices, foil effects, or photography literally on every website screen.

## Senior UX direction

### Experience thesis

OrgTik is not only an agency and not only a SaaS platform. The website should position it as a **digital operating partner**: OrgTik builds the public-facing systems that help a business grow, then provides the software that helps the team run the business behind the scenes.

The experience should make this distinction understandable within the first viewport:

- **Build and grow** → web, development, marketing, IT, hosting, and ongoing support.
- **Run the business** → HR, CRM, files, tasks, marketing operations, and website management software.

The two paths share one brand, one trust story, and one account—but they should never be blended into a vague list of capabilities.

### Primary audiences and jobs

| Audience | Situation | Primary job | Best first destination |
|---|---|---|---|
| Owner or managing director | Business has fragmented tools and suppliers | Understand whether OrgTik can consolidate the operation | Home → Platform or Services gateway |
| Operations/HR lead | Needs clearer processes and ownership | Evaluate HR, Tasks, and Files | Platform → Operations Bundle/module detail |
| Sales/marketing lead | Needs pipeline, campaigns, and website visibility | Evaluate CRM, Marketing, and Website Manager | Platform → Growth Bundle/module detail |
| Founder or project buyer | Needs a website, brand, campaign, software, or technical partner | Understand expertise, proof, process, and engagement | Services → Family → Detail → Consultation |
| Existing customer | Wants to access subscribed systems | Sign in without navigating marketing content | Persistent Sign in action → P16 |
| Research-stage visitor | Arrives through search or an article | Learn, validate expertise, and find a relevant service/product | Article → Contextual offer → Contact or plan |
| Client/partner contributor | Wants to see progress or suggest an idea | Review the roadmap and participate | Timeline/Roadmap → Idea detail/submission |

### Recommended global information architecture

```text
Home
├── Platform
│   ├── Platform overview
│   ├── HR
│   ├── CRM
│   ├── Files
│   ├── Tasks
│   ├── Marketing
│   ├── Website Manager
│   ├── Plans & bundles
│   └── Sign in
├── Services
│   ├── Marketing
│   │   ├── Social Media Marketing
│   │   ├── Digital Advertising
│   │   └── SEO
│   ├── IT Support
│   │   ├── Website Management
│   │   └── Software Support & Error Fixing
│   ├── Development
│   │   ├── Web Development & Programming
│   │   └── Custom App Development
│   └── Web & Brand Design
│       ├── Graphic Design
│       ├── Brand Development
│       └── Web Design & Application Development
├── Work
│   └── Case-study detail pages
├── Insights
│   ├── All insights
│   ├── Web Design
│   ├── Development
│   ├── IT Support
│   └── Marketing
├── Company
│   ├── About
│   ├── Timeline & Roadmap
│   └── Contact
├── Pricing
├── Legal
│   ├── Imprint
│   ├── Privacy
│   └── Terms
└── Utility
    ├── Sitemap
    └── Error states
```

### Recommended route model

| Content type | Route pattern | Notes |
|---|---|---|
| Platform overview | `/platform` | Main SaaS acquisition page. |
| Module detail | `/platform/{module}` | Six local content entries using P14; translated entries only when reviewed. |
| Plans | `/pricing` | Includes bundle comparison and custom builder. |
| Services overview | `/services` | Outcome-led service navigation. |
| Service family | `/services/{family}` | Four reusable family entries. |
| Service detail | `/services/{family}/{service}` | Ten reusable detail entries; redirect legacy slugs. |
| Insights index | `/insights` | Replace “Blogs” in visible navigation; preserve redirects for old URLs. |
| Insight category | `/insights/category/{category}` | P05 filter state; distinct namespace prevents article/category slug collisions. |
| Article | `/insights/{slug}` | Keep stable slugs; include canonical and localized alternates. |
| Work index | `/work` | P18 listing of approved case studies, with local filters. |
| Case study | `/work/{slug}` | All projects use P17. |
| About | `/about` | Company story and principles. |
| Roadmap | `/roadmap` | Timeline and community roadmap. |
| Contact | `/contact` | Intent-led enquiry form. |
| Sign in | `/sign-in` | P16 interface preview in this phase; no real authentication. |
| Password recovery | `/sign-in/recovery` | P16 state/route, not an additional template; preview only. |
| Legal | `/legal/imprint`, `/legal/privacy`, `/legal/terms` | P09 with approved local content. |
| Sitemap | `/sitemap` | P10 generated from the local route/content registry. |
| Not found | Unmatched route | P11 frontend recovery; hosting HTTP status behavior is a later deployment concern. |

Use English for the initial preview; preserve room for a consistent locale-prefix strategy when translated content is available. The legacy URL inventory is not supplied, so redirect mapping is a future content/handoff deliverable, not an implemented server feature. Filter/search/page state should survive Back/Forward through validated query parameters. Reset pagination when filters change and handle unknown slugs with P11.

### Header architecture

Recommended desktop navigation:

```text
[OrgTik logo]  Platform ▾  Services ▾  Work  Insights  Company ▾  Pricing
                                      Sign in   [Start a project]
```

- **Platform mega menu:** six modules, Platform overview, Plans & bundles, and a compact “One workspace” explanation.
- **Services mega menu:** four families with child services, a Selected Work link, and a consultation CTA.
- **Company menu:** About, Timeline/Roadmap, and Contact.
- **Sign in:** visually quiet but persistent; never hidden inside a menu on desktop.
- **Start a project:** the single high-emphasis navigation CTA.
- Home is accessed through the logo; a separate Home label is unnecessary on desktop.
- When a visitor is in the SaaS journey, the contextual primary CTA can change to **Build your plan**, while navigation placement remains stable.

### Mobile navigation

The mobile drawer should use this order:

1. Platform.
2. Pricing.
3. Services.
4. Work.
5. Insights.
6. Company, including a direct Contact link.
7. Sign in (labelled preview while unconnected).
8. Language, only when more than one reviewed locale exists.
9. Full-width **Start a project** CTA.

Platform and Services expand in place. Keep first-level rows large and scannable; do not expose all twenty child links at once. Preserve the current route when changing language whenever a localized equivalent exists.

### Footer architecture

| Group | Links/content |
|---|---|
| Platform | Overview, HR, CRM, Files, Tasks, Marketing, Website Manager, Plans |
| Services | Marketing, IT Support, Development, Web & Brand Design |
| Company | About, Selected Work, Timeline/Roadmap, Contact, Careers if introduced later |
| Insights | All insights and four topic categories |
| Account | Sign in, Support/contact path, System status if available |
| Legal | Imprint, Privacy, Terms, Sitemap, cookie preferences |
| Trust | Swiss address, verified phone/email, languages, approved certifications only |

The footer should close with the OrgTik statement **“We don’t chase attention. We attract it.”** as a brand signature, not as another sales headline.

### Conversion model

Every page should have one dominant next action based on visitor intent:

| Intent | Primary CTA | Secondary CTA |
|---|---|---|
| Exploring the platform | **Explore modules** | Compare plans |
| Evaluating one module | **Choose this module** | Add to a custom plan |
| Comparing subscriptions | **Build your plan** | Talk to sales |
| Buying a service | **Start a project** | View relevant work |
| Reading an article | **Explore the related solution** | Talk to an expert |
| Reviewing the roadmap | **Submit an idea** | Start a project |
| Existing customer | **Sign in** | Get support |

Avoid “Learn more,” “Discover,” “Get started,” and “Subscribe now” when a more specific action can describe the destination.

### Content and voice system

- Lead with the business outcome, then explain the system or service that creates it.
- Prefer short, direct sentences and concrete verbs: connect, assign, publish, track, approve, secure, launch.
- Replace generic claims such as “cutting-edge,” “professional,” “high quality,” and “tailored solutions” with workflow detail or verified evidence.
- One headline should communicate one idea. Do not join several offers with “and.”
- Use sentence case in navigation, buttons, cards, and headings.
- Keep paragraphs to two or three sentences on marketing pages.
- Present feature names as nouns and benefits as complete sentences.
- Never publish customer counts, uptime, performance gains, accessibility scores, roadmap dates, or testimonials without approval and source evidence.
- Use the brand line selectively—Home, About, and Footer are sufficient. Repetition weakens it.

### Visual concept — connected infrastructure, made visible

The signature visual idea is a **living connection line** that moves through footage, product fragments, timelines, and section transitions. It represents OrgTik connecting brand, technology, operations, and growth.

- First viewport: cinematic video occupies the full field; the connection line resolves into the OrgTik emblem before becoming a path through real business and product moments.
- Dark sections: deep plum and indigo, white type, restrained gradient light, fine technical lines.
- Light sections: warm white rather than cold grey, dark plum type, generous negative space, limited violet accents.
- Product moments: real UI crops arranged as connected working surfaces, not floating generic dashboard cards.
- Service moments: authored photography/process imagery with precise annotations, deliverables, or results.
- Proof moments: large verified numbers paired with context and source labels, never decorative counters.
- Section pacing: cinematic opening → quiet decision gateway → dense product proof → light service explanation → immersive case study → calm final conversion.

### Page rhythm and composition rules

- Use a 12-column desktop grid, 8-column tablet grid, and 4-column mobile grid with a consistent content width across templates.
- Alternate scale and density; do not stack repeated card grids from top to bottom.
- Each page gets one memorable composition: a module constellation, service pathway, timeline spine, comparison rail, editorial lead story, or contact signal—not the same bento layout everywhere.
- Use cards only for selectable or repeatable objects. Narrative, proof, and positioning sections should remain spatial compositions rather than card collections.
- Keep corner radii, borders, and shadows restrained. Brand character should come from typography, composition, footage, and motion—not excessive glass panels.
- Product screenshots must remain legible at the size shown. If the interface cannot be read, use a focused crop or annotated sequence instead of shrinking a complete dashboard.

### Component art direction

- **Primary buttons:** white with deep-plum text on dark/video fields; deep plum with white text on light fields. Violet is an accent/focus color unless the tested pairing passes contrast.
- **Secondary buttons:** transparent with a clear one-pixel border and explicit hover/focus change; reserve text-only links for low-priority actions.
- **Corners:** use a controlled medium radius for interactive components and a larger radius only for major media/product frames. Avoid turning every label and container into a pill.
- **Cards:** light cards use a warm-white surface and subtle plum rule; dark cards use a tonal plum/indigo surface. Hover should reveal useful information or destination—not float the card for decoration.
- **Forms:** persistent labels above fields, generous input height, visible required/optional language, inline validation, and a stable area for status messages.
- **Icons:** use one geometric line system with the diagonal cut suggested by the OrgTik emblem. Do not mix filled, cartoon, and outline families.
- **Diagrams:** thin technical lines, solid nodes, concise labels, and one highlighted path. They should explain a workflow or relationship, not function as background decoration.
- **Data/results:** combine the number with unit, period, baseline, and short interpretation. Do not use gradients inside data text or low-contrast chart labels.
- **Photography:** decisive crops, credible environments, and real work. Avoid generic handshakes, staged laptop meetings, and anonymous “tech” server imagery.

### Motion language

- One orchestrated connection-line sequence establishes the brand; section reveals should remain simple and quick.
- Video heroes use slow directional movement, focus pulls, interface transitions, or system connections—not montage cuts every second.
- Module hover/focus states reveal one concise workflow, not decorative 3D tilt.
- Timeline motion follows chronological progress; plan-builder motion confirms selection and price updates.
- All motion must preserve visible content by default, support keyboard interaction, and honor reduced-motion preferences.

### Responsive design principles

- Mobile is a recomposed experience, not a scaled desktop page.
- Replace horizontal comparisons with a selected-plan/module comparison rather than forcing wide tables.
- Convert mega menus into progressive disclosure.
- Keep video poster artwork intentionally framed for portrait screens.
- Pin only one context-relevant mobile CTA and leave enough space above system/browser controls.
- Preserve reading order when visual compositions reflow; product imagery must not separate a heading from its explanation.
- Test German, French, and Italian expansion, long plan names, long service titles, and 200% text zoom.

### Accessibility and trust baseline

- WCAG 2.2 AA is the minimum target for navigation, content, forms, dialogs, filters, and authentication.
- Use visible keyboard focus, skip links, landmark structure, descriptive link text, and semantic form labels.
- Background video must have pause controls, muted autoplay, poster fallbacks, and no critical information embedded in the footage.
- Voting, commenting, plan selection, and form submission require clear loading, success, failure, and retry feedback.
- Pricing must expose billing interval, recurring total, tax/setup fees, renewal, cancellation, and trial terms before commitment.
- Security and hosting language must be factual, specific, and approved; visual seriousness is not evidence of security.

## The actual design scope

You do **not** need to design 120 individual routes or 95 individual blog pages.

The inherited website inventory, timeline/roadmap concept, new SaaS acquisition journey, and recommended proof system can be represented by **18 unique page templates**:

| ID | Unique template | Existing instances covered | Design once? |
|---|---|---:|---|
| P01 | Home | 1 page | Yes |
| P02 | Services overview | 1 page | Yes |
| P03 | Service-family landing | 4 service families | Yes |
| P04 | Service-detail page | 10 service pages | Yes |
| P05 | Insights index / category results | Insights index + all category and pagination views | Yes |
| P06 | Article detail | 95 blog articles + 1 location SEO article | Yes |
| P07 | About | 1 page | Yes |
| P08 | Contact | 1 page | Yes |
| P09 | Legal/editorial page | Imprint + Privacy + Terms | Yes |
| P10 | Sitemap/content index | 1 page | Yes |
| P11 | Error / not-found state | Broken routes, 404s, loading failures | Yes |
| P12 | Timeline / public roadmap | 1 new page + idea-detail drawer | Yes |
| P13 | SaaS platform overview | 1 public product page | Yes |
| P14 | SaaS module detail | 6 product modules | Yes |
| P15 | Plans and subscription builder | Plans, bundles, and custom configuration | Yes |
| P16 | Sign in / account access | Sign in + recovery states | Yes |
| P17 | Case-study detail | All current and future client stories | Yes |
| P18 | Work index | Selected work + filtered project results | Yes |

## What should not become separate designs

These are content instances or states of the templates above:

- The 95 blog articles are instances of **P06 Article detail**.
- The four content categories are filtered states of **P05 Insights index / category results**.
- Blog pages 1–4 are pagination states of **P05**.
- The four service families are content variants of **P03 Service-family landing**.
- The ten individual services are content variants of **P04 Service detail**.
- The Affoltern im Emmental SEO landing page can use **P06 Article detail**.
- Imprint, Privacy Policy, and Terms use **P09 Legal/editorial page**.
- German, English, French, and Italian reuse the same templates with localized content.
- Desktop and mobile are responsive variants, not new information-architecture pages.
- The earlier brief describes two timeline references as one page and one interaction state. Those source PDFs are not present in this workspace.
- HR, CRM, file management, task management, marketing, and website management are six content instances of **P14 SaaS module detail**, not six unrelated page designs.
- Pricing cards, bundle comparison, and the custom subscription configurator belong to **P15**, not separate pages for every plan.
- The authenticated product dashboards, account administration, billing portal, and internal navigation shell are intentionally outside this website-design scope.
- Every client project/case study is a content instance of **P17 Case-study detail**, not a new layout.

---

## P01 — Home

### Purpose

Position OrgTik as one partner for building and running a modern business, help visitors choose between the SaaS platform and expert services, establish trust, and move each audience toward the right conversion.

### Unique content structure

1. Global header.
2. Video hero presenting the combined company proposition.
3. Trust/proof strip.
4. Two-path decision gateway: Platform or Services.
5. SaaS suite demonstration and six-module navigator.
6. Service-family pathway.
7. Selected work with measurable outcomes.
8. Four-step partnership model.
9. Hosting/infrastructure trust band, if verified and strategically retained.
10. Timeline/innovation preview.
11. Authentic testimonials or client proof.
12. Latest insights.
13. Split final CTA for platform and services.
14. Global footer.

### Existing-site content to carry forward

| Section | Existing content |
|---|---|
| Hero | **OrgTik High-Performance Digital Systems.** “We help Swiss businesses design, build, and manage secure digital infrastructures that support long-term success.” CTA: **Talk to Our Experts** → Contact. |
| Client strip | Mercan, Zebralo, and Goldpferd logos. |
| Services | **Our Digital Services.** “A full range of Web, IT, and Marketing services designed to support your business at every stage of growth.” Cards: Marketing Services, IT Support, Development Services, and Web Design Services. |
| Hosting | **Where True Hosting Power Begins / Premium Hosting Features.** Speed, reliability, and security positioning. CTAs: **Choose Your Plan** and **Subscribe Now**. |
| Hosting proof | 99.9% uptime SLA, 500+ CDN edge nodes, 24/7 support, and 50k+ customers. These claims need business verification before reuse. |
| Hosting features | SSD Storage & Speed; Free SSL & Security; Global CDN Network; Unlimited Email; Daily Backups; 99.9% Uptime; 30-day money-back guarantee. |
| SaaS suite — new | Eyebrow: **One workspace. The tools your business needs.** Heading: **Meet OrgTik Business Suite.** Body: “Choose one business system, combine the tools you need, or bring your operations together in one complete suite.” Module links: HR, CRM, Files, Tasks, Marketing, and Website Manager. CTAs: **Explore the suite** → P13 and **Compare plans** → P15. Supporting line: “One secure sign-in. Flexible subscriptions. Upgrade as your team grows.” Product name is a working label pending approval. |
| Process | **How We Work.** Discovery & Planning → Design & Development → Testing & Quality Assurance → Launch & Support. |
| Projects | **Our Previous Projects.** ZOOM, Mercan, SWS, and Goldpferd; each card lists hosting, marketing, design, and/or website building and links to the external project. |
| Testimonials | **Trusted by Our Clients / What Our Clients Say.** The current page repeats three generic testimonials attributed to Jane Smith, John Doe, and Michael Johnson. Replace with approved, authentic client proof. |
| Contact | **Get in Touch.** Phone `+41 31 812 74 84`; email `info@orgtik.ch` (verify before launch); Muristrasse 3, 3123 Belp; Mon–Fri 08:00–17:00. Fields: Name, Email Address, Mobile Number, Time Preference, Message. |

### Recommended rebrand section blueprint

| Order | Section | Recommended content | Visual direction | Primary action |
|---:|---|---|---|---|
| 1 | Hero | Eyebrow: **Digital services + business software.** Headline: **Build the business. Run it better.** Body: “OrgTik combines expert digital services with modular business software, so your brand, systems, and operations move as one.” | Full-field video: real business activity transitions into connected product/interface moments; one connection line resolves into the OrgTik emblem. Keep copy left-aligned within a stable dark contrast field. | **Explore the platform**; secondary **Start a project** |
| 2 | Proof strip | Approved clients, Swiss location, verified systems delivered, support response, or uptime evidence. If no proof or logo permissions are approved, omit this strip. | Quiet horizontal band; approved monochrome logo variants; no animated counter carousel. | Optional **See selected work** |
| 3 | Decision gateway | Heading: **What do you need to move forward?** Path A: “Run the business” for the software suite. Path B: “Build and grow” for services. | Two large spatial fields connected by the brand line; product UI on one side, real project/process footage on the other. Avoid small cards. | **Explore the platform** / **Explore services** |
| 4 | Platform suite | Heading: **Six systems. One OrgTik workspace.** Body: “Start with one module or connect the tools your team needs.” Show HR, CRM, Files, Tasks, Marketing, Website Manager. | Interactive module constellation or connected rail. Selecting a module changes one large product crop and outcome statement. | **See the full platform** |
| 5 | Services | Heading: **Expert teams for the systems customers see.** Explain Marketing, IT Support, Development, and Web & Brand Design through outcomes. | Alternating editorial rows or one service pathway; avoid another six-card grid immediately after modules. | **Find the right service** |
| 6 | Selected work | Heading: **Work that changed how the business operates.** Each story needs challenge, intervention, and verified result—not only service tags. | One large lead case plus two supporting stories; use real imagery and interface/process details. | **Start a similar project** |
| 7 | Partnership model | Heading: **From first conversation to continuous improvement.** Steps: Understand → Design → Deliver → Evolve. | Connection line becomes the process spine; concise outputs at each stage. | **See how we work** or **Start a project** |
| 8 | Infrastructure trust | Heading: **The infrastructure behind the experience.** Describe hosting, security, backups, monitoring, and support using only approved specifications. | Dense, technical dark band with one infrastructure diagram; no unsupported “50k+” or edge-node counters. | **Discuss hosting** → `/contact?intent=services` |
| 9 | Roadmap preview | Heading: **What we’ve built—and what comes next.** Show one shipped, one in-progress, and one planned milestone. | Cropped timeline with a visible continuation beyond the viewport. | **Explore the roadmap** |
| 10 | Client proof | Heading: **Trusted when the system has to work.** Use named, approved clients and specific outcomes. | One high-impact quote beside contextual project imagery; avoid repeated generic testimonial cards. | Optional case/project link |
| 11 | Insights | Heading: **Ideas for better digital systems.** Three current articles: one platform, one service, one strategic guide. | Editorial covers with distinct art direction; category and reading time visible. | **View all insights** |
| 12 | Final conversion | Headline: **Choose your next move.** Platform path: “Build your workspace.” Service path: “Build your next project.” | Calm dark closing field with two clear actions and the OrgTik brand signature. | **Build your plan** / **Start a project** |

### Design decision

The hero introduces the combined proposition, but **Explore the platform** is the primary action because SaaS requires more education and discovery. **Start a project** remains the persistent commercial CTA in navigation and the secondary hero action. The decision gateway immediately below the proof strip gives equal clarity to both business models without forcing two competing visual treatments into the first viewport.

### Responsive behavior

- Desktop: full navigation, cinematic hero, horizontal proof, two-path gateway, large module demo, and editorial case-study composition.
- Mobile: portrait video or poster, sequential Platform/Services gateway, selectable module rail, vertically ordered proof stories, and one sticky context CTA.

---

## P02 — Services overview

### Purpose

Help visitors understand OrgTik’s capabilities and choose the correct service family.

### Unique content structure

1. Header and breadcrumb.
2. Services overview hero.
3. Four service-family cards:
   - Marketing Services.
   - IT Support.
   - Development Services.
   - Web Design Services.
4. Testimonials or client proof.
5. General services FAQ.
6. Consultation CTA.
7. Footer.

### Existing-site content to carry forward

- Page label/title: **Our Services — OrgTik**.
- Four destinations: Marketing Services, IT Support, Development Services, and Web Design Services.
- Proof block: **Trusted by Our Clients / What Our Clients Say** with the same testimonial set used on Home.
- FAQ intro: **Frequently Asked Questions.** “Answers to common questions about our services and processes.”
- FAQ: “What services does your digital agency offer?” Answer references UI/UX design, web development, branding, digital marketing, and tailored software solutions.
- FAQ: “How do I get started with your agency?” Answer directs visitors to the contact form or email, followed by a consultation covering goals, budget, and timeline.
- Persistent CTA: WhatsApp → `+41 31 812 74 84`.

### Template rule

This is a navigation and comparison page. Do not duplicate the full service descriptions that belong on P03 or P04.

---

## P03 — Service-family landing

### Existing content instances

- Marketing Services: three subservices.
- IT Support: two subservices.
- Development Services: two subservices.
- Web Design Services: three subservices.

### Purpose

Explain one service family and help the visitor select a specific service.

### Unique content structure

1. Header and breadcrumb.
2. Service-family hero.
3. Short family-level positioning statement.
4. Two or three subservice cards.
5. Optional family-level proof/results.
6. Consultation CTA.
7. Footer.

### Existing-site content variants

| Family | Existing positioning and child services |
|---|---|
| Marketing Services | Digital visibility and customer acquisition. Children: **Social Media Marketing**, **Digital Advertising Switzerland**, and **SEO Services**. |
| IT Support | Ongoing operational support, maintenance, and troubleshooting. Children: **Website Management** and **Software Support and Error Fixing**. |
| Development Services | Custom digital products and technical implementation. Children: **Web Development and Programming** and **Custom App Development**. |
| Web Design Services | Brand and interface creation for websites and applications. Children: **Graphic Design**, **Brand Development and Corporate Branding**, and **Web Design and Application Development**. |

Each populated family page should keep the old service names for migration, but its hero copy should be rewritten around outcomes, audience, and proof instead of repeating generic agency language.

### Content fields (local data; future CMS mapping)

- Family name.
- Introductory copy.
- Hero media.
- Subservice collection.
- Proof points.
- CTA label and destination.

### Template rule

Design one flexible grid that supports two or three items. Do not create four separate Figma pages unless stakeholders need populated examples for review.

---

## P04 — Service detail

### Existing content instances

1. Social Media Marketing.
2. Digital Advertising Switzerland.
3. SEO Services.
4. Website Management.
5. Software Support and Error Fixing.
6. Web Development and Programming.
7. Custom App Development.
8. Graphic Design.
9. Brand Development and Corporate Branding.
10. Web Design and Application Development.

### Purpose

Explain a specific service, demonstrate value, and convert a qualified visitor into a lead.

### Unique content structure

1. Header and breadcrumb.
2. Service hero with clear outcome statement.
3. Problem/solution introduction.
4. Service capabilities.
5. Three benefit or differentiator blocks.
6. Process or deliverables.
7. Proof, project, testimonial, or measurable result.
8. Pricing approach or engagement model.
9. FAQ.
10. Primary consultation CTA.
11. Related services.
12. Footer.

### Existing-site service content matrix

| Detail page | Core content to preserve in the redesign |
|---|---|
| Social Media Marketing | Strategy, channel/content planning, publishing, community engagement, campaign management, performance tracking, and brand-consistent social presence. |
| Digital Advertising Switzerland | Paid campaign planning and management for Swiss audiences; targeting, creative, budget control, optimization, and measurable lead/conversion performance. |
| SEO Services | Search visibility, technical/on-page improvement, content and keyword work, local relevance, measurement, and sustainable organic growth. |
| Website Management | Ongoing updates, monitoring, backups, security, performance, content changes, and day-to-day website care. |
| Software Support and Error Fixing | Diagnosis, bug fixing, stabilization, compatibility work, maintenance, and responsive technical support. |
| Web Development and Programming | Requirements, architecture, front- and back-end implementation, integrations, testing, deployment, and support. |
| Custom App Development | Product discovery, UX/UI, tailored application development, integrations, testing, launch, and iteration. |
| Graphic Design | Brand-consistent visual communication for digital and print applications, including campaign and business assets. |
| Brand Development and Corporate Branding | Brand strategy, identity direction, logo/visual system, guidelines, and consistent rollout across touchpoints. |
| Web Design and Application Development | UX/UI, responsive web design, application interface design, implementation, testing, and ongoing optimization. |

### Shared old-page copy pattern

All ten detail pages currently follow the same content rhythm: service title and short promise → explanatory introduction → three feature/benefit blocks → **Flexible Pricing Options**. Preserve the service-specific meaning, but replace the unfinished pricing ending with one of these complete outcomes: a scoped-price explanation, “Request an estimate,” or “Book a consultation.”

### Required variants

- Short and long copy.
- Two, three, or multiple capability blocks.
- With and without case-study proof.
- With and without FAQ.

### Existing-site issue to solve

The current detail pages end with “Flexible Pricing Options” but show no pricing content or follow-up CTA. The redesign needs a complete decision point.

---

## P05 — Insights index and category results

### Existing states covered

- Main blog index.
- Web Design category.
- Development category.
- IT Support category.
- Marketing category.
- Pagination pages.
- Empty category state.

### Purpose

Help visitors discover useful content by topic without exposing the complexity of 95 separate entries.

### Unique content structure

1. Header and breadcrumb.
2. Insights/blog hero.
3. Category navigation or filter.
4. Featured article, if editorially useful.
5. Article-card list or grid.
6. Pagination or Load More.
7. Optional latest/popular content module.
8. Newsletter or consultation CTA.
9. Footer.

### Existing-site content to carry forward

- Main collection label: **Blogs**.
- Category system: **Web Design**, **Development**, **IT Support**, and **Marketing**.
- The index uses article cards plus a categories module, a latest-posts module, and numbered pagination.
- The current archive contains 95 articles across four result pages. Titles, excerpts, dates, category, thumbnail, and slug are CMS fields—not separate layouts.
- Keep the editorial topics, but review duplicate, outdated, thin, and mixed-language entries before migration.

### Required UI states

- All articles.
- One category selected.
- Page 2+.
- No results.
- Loading/skeleton.
- Failed-to-load state.

### Responsive behavior

The current mobile page places Categories and Latest Posts before the article list. The redesign should decide intentionally whether filters belong above the list, in a drawer, or in a horizontal control.

---

## P06 — Article detail

### Existing content instances

- 95 blog articles.
- The location SEO page under `/sitemap/...`.

### Purpose

Provide a readable long-form experience, build expertise, and lead the reader to a related service or consultation.

### Unique content structure

1. Header and breadcrumb.
2. Category, title, summary, and metadata.
3. Hero image or editorial visual.
4. Article body:
   - H2/H3 hierarchy.
   - Paragraphs.
   - Lists.
   - Images.
   - Quotes/callouts.
5. Optional table of contents.
6. Contextual related-service CTA.
7. FAQ, when available.
8. Related articles.
9. Author/editorial information, if the new brand requires it.
10. Footer.

### Existing-site content model

Each of the 95 articles supplies: breadcrumb, category, title, publication date, lead/summary, hero image when available, rich-text body, headings, lists/media, FAQ when present, latest/related posts, and a service or contact path. The location page for **Affoltern im Emmental** uses the same long-form structure and can remain a populated SEO variant of this template.

Do not copy old articles into Figma one by one. Populate only three realistic samples: a short article, a long article with contents/FAQ, and the local SEO variant.

### Required variants

- Short and long article.
- With and without hero image.
- With and without FAQ.
- With and without table of contents.
- Mixed-language and long-word handling.

### Template rule

Do not design each article. Build reusable rich-text blocks around local content; any future CMS mapping uses the same content model without adding CMS work now.

---

## P07 — About

### Purpose

Build confidence in the company, its approach, and its people.

### Unique content structure

1. About hero.
2. Company story.
3. Values.
4. Working approach.
5. Differentiators.
6. Company journey/timeline.
7. Mission and principles.
8. Team or leadership, if approved for the rebrand.
9. Consultation CTA.
10. Footer.

### Existing-site content to carry forward

- Hero/title: **About OrgTik**.
- Values/commitment statement: **We are committed to delivering excellence in every project.**
- Company-history section: **Our Journey**, currently presented as four milestones.
- Purpose section: **Our Mission**.
- Persistent WhatsApp contact action and the global company details in the footer.

The old page exposes several visually separated statements without strong descriptive headings. During content migration, group those statements into: who OrgTik serves, what the company believes, how it works, the four journey milestones, and the mission. Do not invent team biographies or numerical claims until approved.

### Design note

The current page is text-heavy. The redesign should create a stronger narrative hierarchy rather than turning each paragraph into a card.

---

## P08 — Contact

### Purpose

Give visitors a low-friction path to start a conversation.

### Unique content structure

1. Contact hero.
2. Phone, email, address, and working hours.
3. Inquiry form.
4. Response-time expectation.
5. Map or location context, if useful.
6. Social channels.
7. Footer.

### Existing-site content to carry forward

| Block | Existing content |
|---|---|
| Intro | **Get in Touch.** “We’d love to hear from you. Contact us for any inquiries or support.” |
| Phone | `+41 31 812 74 84` |
| Email | `info@orgtik.ch` — verify ownership before launch. |
| Address | Muristrasse 3, 3123 Belp, Switzerland |
| Hours | Monday–Friday, 08:00–17:00 |
| Form fields | Name*, Email Address*, Mobile Number*, Time Preference (work hours 08:00–17:00), Message, **Send Message**. |
| Alternate path | WhatsApp using the same Swiss phone number. |

### Required form states

For this frontend phase, use an intent choice (Services, Platform, Support, Partnership, Other), Name, Email, and Message. Company and phone are optional; reveal preferred callback time only when a callback is selected. Carry service/module context into the form without asking visitors to repeat it. Present a preview notice before any submission action; success/failure states below are labelled simulations. Preserve in-memory input on validation errors and make no response-time promise unless confirmed.

- Default.
- Field focus.
- Validation errors.
- Invalid email/phone.
- Sending.
- Success confirmation.
- Server failure and retry.
- Privacy/consent text.

### Existing-site issues to solve

- Visible asterisks do not map to semantic required fields.
- Inputs are not inside a semantic form element.
- No visible validation model is defined.
- Mobile navigation lacks a direct Contact item.

---

## P09 — Legal/editorial page

### Existing content instances

- Imprint.
- Privacy Policy.
- Terms and Conditions.

### Purpose

Present structured, readable, trustworthy legal content.

### Unique content structure

1. Header and breadcrumb.
2. Page title and update date.
3. Long-form sectioned content.
4. Optional in-page table of contents.
5. Contact/legal entity details where applicable.
6. Footer.

### Existing-site content allocation

| Page | Old content sections to migrate |
|---|---|
| Imprint | Legal/company identity, address, contact details, authorized representation or registration information where supplied, liability/copyright notices, and external-link responsibility. |
| Privacy Policy | Data-controller/contact details, collected data, purposes and legal bases, cookies/analytics, third-party services, retention, security, user rights, international transfers where applicable, and updates. |
| Terms and Conditions | Scope, services, offers/contract formation, customer duties, prices/payment, delivery/performance, intellectual property, liability/warranty, termination, privacy reference, governing law, and venue. |

Legal wording must be migrated verbatim from the approved source and reviewed by the business/legal owner. Figma only needs one populated representative page plus the shared heading/table-of-contents behavior.

### Template rule

One editorial template covers all three pages. Content authors control sections; designers do not create three separate layouts.

---

## P10 — Sitemap/content index

### Purpose

Provide a human-readable directory of the public website.

### Unique content structure

1. Header and breadcrumb.
2. Page title and short explanation.
3. Grouped links:
   - Platform.
   - Company.
   - Services.
   - Work.
   - Insights.
   - Legal.
4. Footer.

### Existing-site content to carry forward

The current sitemap is incomplete. The redesigned index should expose the approved public structure:

- Company: Home, About, Contact, Timeline/Roadmap.
- Services: overview, four service families, and ten service-detail links.
- Work: all approved case-study detail pages.
- Platform: SaaS overview, six module pages, Plans, and Sign in.
- Insights: index plus the four category filters.
- Legal: Imprint, Privacy Policy, and Terms of Service.

Generate these groups from the shared local content/route registry so the page cannot drift out of date.

### Existing-site issue to solve

The inherited discovery notes describe a sitemap with only one marketing entry. Generate the redesign's sitemap from the local navigation/content registry; a future CMS may reuse that model.

---

## P11 — Error and not-found state

### Purpose

Recover visitors from missing pages, failed content loads, and invalid routes.

### Unique content structure

1. Clear human-readable error title.
2. Short explanation without technical server language.
3. Primary action: return home.
4. Secondary action: browse services or contact OrgTik.
5. Optional search or popular destinations.
6. Minimal global navigation/footer.

### Required states

- 404 page not found.
- General server error.
- Article failed to load.
- Retry state.

### Recommended content

- 404 title: **This page has moved or no longer exists.**
- Supporting copy: “Try one of the paths below, or tell us what you were looking for.”
- Primary CTA: **Go to homepage**.
- Secondary CTAs: **Explore services** and **Contact OrgTik**.
- Failed-load state: **We couldn’t load this content.** CTA: **Try again**.
- Server-error state: **Something went wrong on our side.** Include retry and contact paths; do not expose technical server messages.

---

## P12 — Timeline and public roadmap

### Purpose

Turn OrgTik’s company history, active work, future plans, and community suggestions into one traceable story. This is one page template with an **idea-detail drawer state**. The separate historical timeline PDFs are not available in this review; all transcribed examples below remain draft/demo content.

### Recommended page content

#### 1. Hero

- Eyebrow: **OrgTik Timeline**.
- Title: **From first commit to what’s next.**
- Body: “A living map of what we’ve shipped, what we’re building now, and where we’re going next—shaped in part by the people we build for.”
- Primary CTA: **Explore the timeline** → scroll to the timeline.
- Secondary CTA: **Get roadmap updates** → newsletter/update signup. This replaces the vague “Subscribe Now.”
- Proof row from the reference: **5 years building in Switzerland**, **40+ systems shipped**, **99.9% uptime maintained**. Verify each claim before publication.

#### 2. Timeline explorer

- Eyebrow: **The journey**.
- Heading: **Every milestone, mapped.**
- Intro: “Five years of shipped work, what’s in progress, and the road ahead—grouped by year. Filter by status or theme, search by project, or switch the way you view the story.”
- Status filters: **All**, **Past**, **Now**, **Next**.
- Theme filter: **All themes** plus Hosting & Infrastructure, Web & Design, Development, Marketing, Accessibility, IT Support, Security, and AI.
- Search placeholder: **Search projects**.
- View switcher: timeline/list.
- Result count: the supplied concept shows **22 milestones**; generate this count from content.
- Year navigation: derive available years from local entries. Do not display empty 2021–2027 placeholders as company history.

#### 3. Supplied milestones

| Year | Status | Milestone | Content |
|---|---|---|---|
| 2025 | Shipped | ZOOM Reinigungen — cleaning-service booking system | “An end-to-end booking experience: customers schedule, reschedule, and pay online, while the back office sees everything in one place.” Jan 2025. Result shown in reference: **78% of bookings online**; verify before launch. |
| 2025 | Shipped | Vela Clinic — accessibility-first clinic rebuild | “A full rebuild targeting WCAG 2.2 AA, with audited contrast, keyboard flows, and screen-reader checks—accessible care by design.” Apr 2025. Result shown: **100/100 accessibility score**; verify scope and tool. |
| 2025 | Shipped | Portier — hospitality platform and multi-site hosting | “A multi-property hospitality platform on OrgTik’s managed edge stack—one dashboard, multiple sites, each independently secured.” Aug 2025. Result shown: **47% faster TTFB**; verify baseline. |
| 2026 | In progress | OrgTik Cloud — multi-region hosting panel | “A single dashboard for clients to manage domains, email, backups, and edge caching across regions—OrgTik’s hosting platform made self-serve.” Internal, since Mar 2026; **68%** progress. |
| 2026 | In progress | Phase 2 — commerce and live analytics | “Extending last year’s build into online sales with a real-time analytics layer the team can act on the same day.” Mercan, since Apr 2026; **41%** progress. |
| 2026 | In progress | Headless storefront rebuild | “Re-platforming a legacy storefront onto a fast headless architecture built for speed, reliability, and security.” Retail client under NDA, since May 2026; **22%** progress. |
| 2026 | In progress | Embeddable status pages for hosted sites | “Live uptime and incident history that clients can embed—an idea from the community roadmap now in active development.” Internal, since May 2026; **35%** progress. |
| 2026 | Planned | AI support copilot for hosting clients | “An assistant that triages tickets, explains incidents in plain language, and resolves routine issues before a human is needed.” Planned Q3 2026; AI / IT Support. |
| 2026 | Planned | Edge CDN expansion — 200+ new nodes | “Extending the delivery network behind every hosted site so content reaches visitors faster and more reliably.” Planned Q4 2026; Hosting / Security. |
| 2027 | Exploring | Self-serve web-care subscriptions | “Transparent monthly plans for design updates, maintenance, and monitoring—the agency relationship with less back-and-forth.” Exploring Q1 2027. |
| 2027 | Exploring | OrgTik Labs — open Swiss-hosting toolkit | “An open-source toolkit that lets the Swiss community build on infrastructure patterns OrgTik has proven in production.” Exploring 2027. |

#### 4. Submit an idea

- Eyebrow: **Shape what comes next**.
- Heading: **Submit an idea.** This replaces the unrelated “Get in Touch” heading.
- Body: “Tell us what would make your digital work simpler, safer, or faster. We review every suggestion and connect strong ideas to the public roadmap.”
- Three-step explanation:
  1. **Tell us the idea** — “One sentence is enough. The clearer the problem, the easier it is to evaluate.”
  2. **We review it** — “Every suggestion is read, categorized, and checked for impact and feasibility.”
  3. **The strongest ideas move forward** — “Popular, useful ideas can become roadmap items, with credit to the contributor when appropriate.”
- Fields: Name*, Email Address*, Company, Idea category*, Message*.
- Category placeholder: **Choose a category**.
- Message placeholder: **Describe the idea and the problem it would solve.**
- Submit CTA: **Submit idea**. The submission requires consent/privacy copy, success, failure, spam protection, moderation, and notification states.

#### 5. Community roadmap

- Eyebrow: **Voted by you**.
- Heading: **The community roadmap.**
- Body: “Suggestions from clients and partners—vote them up, discuss the problem, and watch useful ideas move from open to shipped.”
- Search placeholder: **Search ideas**.
- Board states: **Open**, **Planned**, **In progress**, **Shipped**.

| State | Votes | Theme | Idea and attribution |
|---|---:|---|---|
| Open | 53 | IT Support | “A priority WhatsApp support line with a guaranteed response-time SLA.” — S. Frei, IT, SWS; 2 comments. |
| Open | 47 | Development | “A drop-in language toggle (DE/FR/IT/EN) for existing client sites.” — Claudia Vogt, Partner, Helvetia Web; 2 comments. |
| Open | 31 | Development | “A read-only API for booking data so we can pull it into our own reports.” — M. Lehmann, Operations, ZOOM Reinigungen; 0 comments. |
| Planned | 98 | Development | “One-click staging clones so we can test a campaign before it goes live.” — Tobias Brand, Founder, Zebralo; 2 comments. |
| Planned | 39 | Web & Design | “A dark-mode toggle for client dashboards, remembered per user.” — Renzo Galli, Product, Novelti; 1 comment. |
| In progress | 142 | Hosting & Infrastructure | “An embeddable status page showing live uptime and incident history for our hosted site.” — Lara Imhof, Operations Lead, Mercan; 4 comments. CTA: **Building now**. |
| Shipped | 118 | Marketing | “Built-in cookie consent plus a privacy-first analytics dashboard (DSG/GDPR).” — N. Achteni, Marketing, Goldpferd; 2 comments. CTA: **See what shipped**. |
| Shipped | 64 | Accessibility | “Make a WCAG 2.2 AA accessibility pass a standard part of every rebuild.” — OrgTik Team, internal; 1 comment. CTA: **See what shipped**. |

#### 6. Idea-detail drawer

The earlier brief describes a drawer/modal opened from a roadmap card. Its transcribed, unverified example is:

- Status: **Planned**.
- Themes: Development / Client.
- Votes: 98.
- Title: **One-click staging clones so we can test a campaign before it goes live.**
- Submitted by Tobias Brand, Founder, Zebralo, on 3 Feb 2026.
- Status stepper: Open → Planned → In progress → Shipped.
- Comment from Tobias Brand: “We’ve pushed a broken banner live twice now. A temporary clone to test on would fix that.”
- OrgTik response from Pascal R., 9 Feb 2026: “It’s on the roadmap and pairs naturally with OrgTik Cloud. Planned after the hosting panel ships.”
- Drawer controls: close, vote/unvote, comment list, add comment if authenticated, share/copy link, and status history.

#### 7. Closing CTA

- Heading: **The line keeps drawing.**
- Body: “Every project adds a node. Every idea can bend the road. Let’s build the next milestone together.”
- Primary CTA: **Start a project** → Contact.
- Secondary CTA: **Back to top**.

### Required UI and system states

- Default timeline and list views.
- Filtered, searched, empty, loading, and failed states.
- Year navigation and mobile year selector.
- Milestone card expanded/collapsed state.
- Roadmap board and mobile grouped-list variant.
- Vote: signed out, ready, submitted, reversed, and failed.
- Idea drawer: closed/open, deep-linked, and close-return focus behavior.
- Comment: signed out, composer, validation, posting, success, moderation, and failure.
- Idea form: default, validation, sending, success, duplicate/spam, and server failure.

### Content governance note

Dates, progress percentages, client names, performance results, roadmap commitments, votes, and comments transcribed in this brief are **draft content**. Their historical source PDFs are missing. Use clearly synthetic demo attributions and a visible demo label in the frontend until OrgTik confirms real material. Future roadmap publication needs an owner, update cadence, moderation policy, and a distinction between “planned” and a contractual promise; these are not backend deliverables in this phase.

---

## P13 — SaaS platform overview

### Purpose

Introduce OrgTik’s subscription software as one modular business platform, explain the six systems, and route visitors to the right module or plan.

### Working product position

- Working name: **OrgTik Business Suite**. Confirm whether the public name should be OrgTik, OrgTik Business Suite, or another approved product name.
- Primary promise: **Run your business from one connected workspace.**
- Supporting copy: “Start with one business system, combine only the tools your team needs, or subscribe to the complete suite—all through one secure OrgTik account.”
- Primary CTA: **Choose your plan** → P15.
- Secondary CTA: **Explore the modules** → module grid.
- Account CTA: **Sign in** → P16.

### Unique content structure

1. The shared global header, optionally followed by local in-page module navigation. Do not introduce a conflicting second global navigation.
2. Product hero and concise explanation of the modular subscription model.
3. Six-module overview grid.
4. “One workspace” platform-feature section.
5. Three subscription paths: one module, custom workspace, or bundle.
6. How evaluation works in this frontend: choose → configure → review → contact preview. Describe eventual onboarding only when confirmed.
7. Security, permissions, support, and data-management proof.
8. Module comparison table.
9. Pricing teaser and plan CTA.
10. Product FAQ.
11. Final conversion CTA.
12. Global footer.

### Module content

| Module | Outcome statement | Feature highlights |
|---|---|---|
| HR Dashboard | **Keep people, leave, documents, and onboarding organized.** | Employee directory; roles and departments; leave/absence requests; attendance records if enabled; onboarding checklists; employee documents; HR reports; permissions. |
| CRM Dashboard | **Turn contacts and opportunities into a visible sales pipeline.** | Companies and contacts; leads; deal stages; activities and reminders; notes and customer history; sales reporting; imports/exports. |
| File Management | **Give teams one secure place to organize and share business files.** | Folders and tags; upload/download; access permissions; internal/external sharing; version history; search; activity/audit history; storage controls. |
| Task Management | **Plan work, assign responsibility, and see what is moving.** | Projects and tasks; list/Kanban/calendar views; assignees; deadlines and priorities; comments and attachments; recurring tasks; status reporting; notifications. |
| Marketing Dashboard | **Plan campaigns and understand which activity creates results.** | Campaign calendar; channels and budgets; content planning; lead-source tracking; performance metrics; reports; asset links; CRM connections. |
| Website Manager | **Manage website content, enquiries, performance, and maintenance from one place.** | Page/content updates; form leads; media; website analytics; health/status monitoring; domains/hosting visibility where available; update requests; user permissions. |

### Shared platform features

- One OrgTik account and consistent navigation across subscribed modules.
- Modular access: users see only the tools included in the company subscription.
- Role-based permissions and team invitations.
- Shared search, notifications, and recent activity where technically supported.
- Managed updates, backups, export options, and support.
- Responsive access for desktop, tablet, and mobile browsers.
- English, German, French, and Italian interface/content strategy where supported.

Do not promise single sign-on, integrations, storage limits, compliance certifications, real-time data sharing, or cross-module automation until engineering confirms them.

### Product FAQ topics

- Can I subscribe to only one module?
- Can I add or remove modules later?
- What is included in a bundle?
- How is pricing calculated?
- Can different employees access different modules?
- Can OrgTik migrate our existing data?
- Where is our data hosted and backed up?
- What support and onboarding are included?

### Responsive behavior

- Module comparison becomes a stacked comparison or selectable module view on mobile.
- Keep a sticky mobile CTA for **Choose your plan**, without covering content.
- Product navigation collapses into the same accessible drawer pattern as the main website.

---

## P14 — SaaS module detail

### Existing content instances

1. HR Dashboard.
2. CRM Dashboard.
3. File Management.
4. Task Management.
5. Marketing Dashboard.
6. Website Manager.

### Purpose

Explain one module in enough detail for a visitor to decide whether it solves their problem, then connect that module to a single-module plan, custom workspace, or relevant bundle.

### Unique content structure

1. Breadcrumb: Platform → Module.
2. Module hero with outcome, short description, and UI/product visual.
3. Audience/problem statement.
4. Six to eight feature blocks.
5. Three-step example workflow.
6. Roles and permission example.
7. “Works better together” links to complementary modules.
8. What is included in the subscription.
9. Module-specific FAQ.
10. CTA pair: **Choose this module** and **Add to a custom plan**, both preserving the selected module in P15.
11. Footer.

### Content fields (local data; future CMS mapping)

- Module name, icon, and outcome statement.
- Introductory copy and audience.
- Product screenshots or approved interface mockups.
- Feature collection.
- Example workflow.
- Supported roles/permissions.
- Complementary modules.
- Plan and bundle availability.
- FAQ and CTA destinations.

### Template rule

Design one reusable module-detail master and populate two representative examples in Figma—one operational module such as HR and one growth module such as CRM. The other four use the same layout and CMS model.

### Product-visual rule

Marketing screenshots may preview the product, but this project does **not** include designing the authenticated dashboards. Use approved existing product captures, neutral device frames, or simplified feature illustrations; do not create fictional dashboard functionality.

---

## P15 — Plans and subscription builder

### Purpose

Let a visitor compare subscription options, select one module, choose a ready-made bundle, or configure a tailored combination before continuing to account access.

### Page hero

- Eyebrow: **Plans that grow with your operation**.
- Heading: **Choose one system—or build the workspace you need.**
- Body: “Start focused, combine the modules your team uses, or bring every system together. Change your subscription as your business evolves.”
- Billing control: Monthly / Annual, only if both billing periods are supported.

### Subscription options

| Option | Best for | Included modules | Plan CTA |
|---|---|---|---|
| Single Module | A team solving one immediate operational need | Choose any one of the six modules; OrgTik account; core permissions; standard support; updates and backups. | **Choose a module** |
| Operations Bundle | Teams organizing people and day-to-day delivery | HR + Tasks + Files. | **Choose Operations** |
| Growth Bundle | Teams managing acquisition, sales, and their website | CRM + Marketing + Website Manager. | **Choose Growth** |
| Complete Suite | Businesses replacing disconnected tools | All six modules with one subscription and unified access. | **Choose Complete Suite** |
| Custom Workspace | Businesses that need another combination | Select any two to five modules, team size, storage/support requirements, and optional onboarding. | **Build your plan** |

Final bundle names, module combinations, limits, and prices require commercial approval. Do not invent CHF prices in the UI. Until approved, use **Contact for pricing** or clearly labelled placeholders in design files.

### Plan comparison dimensions

- Included modules.
- Number of users or pricing basis.
- Storage allowance.
- Roles and permission controls.
- Standard versus priority support.
- Onboarding and data migration.
- Reporting/export capabilities.
- Integrations.
- Backup/retention level.
- Monthly/annual billing and cancellation terms.

Only show a difference when the product or commercial policy actually supports it. Avoid a pricing table filled with artificial restrictions.

### Custom subscription flow

1. **Choose how to start** — single module, bundle, or custom.
2. **Select modules** — six selectable module cards with live selection summary.
3. **Configure the subscription** — team size, billing period, onboarding, storage/support options where available.
4. **Review** — selected modules, included features, estimated or approved price, billing terms, and what happens next.
5. **Discuss this plan** — carry the non-sensitive configuration to the Contact preview. Keep P16 available as a separate account-interface demonstration. A real sign-in/subscription handoff is a future integration decision, not part of this build.

### Required UI and system states

- Monthly/annual pricing state.
- One module selected.
- Bundle selected.
- Two to five custom modules selected.
- All modules selected, with a prompt to compare the Complete Suite.
- No selection and invalid/unsupported combination.
- Optional add-ons selected/unselected.
- Price calculating, unavailable, and contact-for-quote states.
- Non-sensitive module/option IDs preserved in validated URL/session state.
- Return from the contact or sign-in preview restores the plan without implying an account session.
- Loading, server failure, and retry.

### Conversion safeguards

- Show the full recurring charge, billing interval, setup fee, tax treatment, renewal, cancellation, and trial terms before commitment.
- Never label an estimate as a confirmed price.
- Do not preselect paid add-ons or hide cheaper options.
- Actual payment, invoicing, subscription administration, and dashboard access are outside this website-screen scope unless added later.

---

## P16 — Sign in and account access

### Purpose

Give existing customers a clear way to enter OrgTik’s product environment and preserve a selected subscription configuration when sign-in is part of the buying flow.

### Global navigation change

Use the single header defined under **Header architecture**, including a persistent **Sign in** action. This phase opens a clearly labelled account preview. “Sign in” remains visually distinct from the primary **Start a project** CTA; do not introduce a second navigation scheme here.

### Sign-in screen content

1. OrgTik logo linking back to the public site.
2. Heading: **Welcome back.**
3. Supporting copy: **Sign in to access your OrgTik workspace.**
4. Email address field.
5. Password field with show/hide control.
6. Remember me, only if security policy supports it.
7. **Forgot password?** link.
8. Primary CTA: **Sign in**.
9. New-customer path: **Need an account? Choose a plan** or the approved registration link.
10. Support link and privacy/terms links.
11. When arriving from P15, a non-editable summary: **Your selected plan is saved** with a return-to-plan link.

Do not add Google, Microsoft, Apple, passkey, or enterprise SSO buttons unless those authentication methods exist.

### Required states

- Default and field focus.
- Empty/invalid email.
- Incorrect credentials with safe, non-revealing copy.
- Password visible/hidden.
- Submitting and disabled duplicate submission.
- Successful authentication and redirect.
- Account locked/rate limited.
- Service unavailable and retry.
- Session expired.
- Forgot-password request, confirmation, expired link, new-password, and success states.
- Selected plan preserved/restored after authentication.

### Scope boundary

Design only the public sign-in and recovery interface. All credential, recovery, success, locked-account, and redirect states above are deterministic demo scenarios, never real account operations. Use synthetic demo values, do not invite real credentials, and do not send or persist passwords. The authenticated launcher, dashboard selector, individual dashboards, account settings, subscription management, and billing screens are excluded.

---

## P17 — Case-study detail

### Purpose

Turn OrgTik’s project work into credible decision evidence by showing the starting problem, the intervention, the delivered system, and the verified business outcome.

### Unique content structure

1. Breadcrumb and project category.
2. Hero: client/project name, one-sentence transformation, approved outcome, and primary visual.
3. Project snapshot: sector, location, engagement, services/modules, timeline, and launch date.
4. The challenge: previous state, constraints, and business impact.
5. The brief and success criteria.
6. OrgTik’s approach: strategy, design, technology, operations, and collaboration.
7. Solution walkthrough using real artifacts or approved product captures.
8. Results with context, baseline, period, and measurement source.
9. Client quotation and attribution, when approved.
10. Services/modules used with contextual links.
11. What happened next: ongoing support, iteration, or next phase.
12. Related case study.
13. Final CTA: **Start a similar project**.
14. Footer.

### Recommended opening content

- Eyebrow: sector + engagement type.
- Headline pattern: **How [client] moved from [problem] to [outcome].**
- Standfirst: two sentences explaining what OrgTik built and why it mattered.
- Proof label: **Verified result** only when the metric and approval are documented.
- CTA: **Start a similar project**; secondary **Explore the services used**.

### Visual direction

- Use one decisive full-bleed image, product crop, or before/after sequence in the hero—not a collage of tiny devices.
- Follow with a calm project-facts rail, then alternate narrative copy with large artifacts.
- Annotate design, workflow, or technical decisions directly on relevant imagery.
- Results should read as evidence: metric, context, source, and period together.
- Brand lighting and purple grading may frame the story, but must not recolor a client’s identity or falsify the delivered work.
- On mobile, preserve the story sequence: problem → work → result; do not move metrics ahead of their explanation.

### Required variants

- Service project versus SaaS implementation.
- With and without quantitative results.
- With and without client quotation.
- One discipline versus multi-service engagement.
- Public client versus anonymized/NDA story.
- Short launch story versus long transformation story.

### Local content and governance fields

- Client/project name and approval status.
- Sector, location, engagement type, services/modules, dates.
- Challenge, goals, constraints, approach, solution, results.
- Media with captions, alt text, rights, and crop focal points.
- Metrics with baseline, measurement period, source, and approval.
- Quote, speaker, role, and approval.
- Related content and CTA destination.

Do not publish fabricated results, implied endorsements, confidential interfaces, private customer data, or unapproved client marks. If proof is qualitative, describe it honestly instead of inventing a percentage.

---

## P18 — Work index

### Purpose

Help visitors find relevant evidence before opening a P17 case study or contacting OrgTik. This closes the missing destination behind the Work navigation item.

### Content and interaction

1. Shared header, concise title **Work that connects the whole business**, and a static approved project visual.
2. One featured project with challenge, delivered work, and an approved result or qualitative outcome.
3. Service/sector filters and a clear result count generated from local entries.
4. Editorial project listing with title, summary, image, and relevant service tags.
5. Empty results with **Clear filters**, then **Start a similar project**.
6. Shared footer.

Use `/work` and validated filter query parameters. Cards link to `/work/{slug}`. Reuse filter, pagination, and project-card components, while keeping the layout distinct from the Insights feed. On mobile, use a single-column reading order and accessible filter controls. Default, selected-filter, empty, reset, image-failure, keyboard, and Back/Forward states are required. A frontend fixture may demonstrate these states; unapproved client claims must not look like verified published work.

---

## Template content and visual enhancement matrix

This matrix is the senior-design layer above the detailed content inventory. It defines what each template must communicate, how it should feel distinct, and where it should lead.

| ID | Recommended opening content | Section/content improvement | Signature visual behavior | Primary CTA |
|---|---|---|---|---|
| P01 Home | **Build the business. Run it better.** | Establish the combined services/software proposition, then separate the two paths immediately. Use verified proof, outcome-led work, and a split final conversion. | Brand connection line travels from real-world footage into product systems. | **Explore the platform** |
| P02 Services overview | **Expert teams for the systems your customers depend on.** “Choose the outcome you need; we’ll connect the right strategy, design, technology, and support.” | Organize by four outcomes rather than four generic departments. Add “Not sure where to start?” guidance, engagement model, selected work, and proof before FAQ. | Four service paths begin separately and converge into one delivered business system. | **Find the right service** |
| P03 Service family | Dynamic headline: **One connected team for better [family outcome].** | Start with audience problems, then child services, how they combine, deliverables, relevant work, and family-specific FAQ. Remove generic family-level filler. | A visual pathway shows the two or three subservices combining into an outcome. | **Choose a service** |
| P04 Service detail | Dynamic headline: **[Service] built around the result—not the deliverable.** | Sequence: outcome → current problem → approach → deliverables → process → proof → engagement/pricing → FAQ → related solution. Add a decision point before the final CTA. | One large before/after, workflow, or annotated artifact replaces decorative benefit cards. | **Discuss this project** |
| P05 Insights index | **Ideas for better digital systems.** “Practical thinking on growth, technology, operations, and the work connecting them.” | Lead with one editorial feature, follow with filters and topic collections, then latest content. Avoid putting sidebar widgets before the main feed on mobile. | Oversized lead story plus an editorial rhythm of covers, quotes, and article cards. | **Read the featured insight** |
| P06 Article detail | Use the actual article title; add a concise standfirst explaining who it is for and what the reader will learn. | Add reading time, updated date, table of contents for long articles, key-takeaway callout, contextual solution, author/editorial ownership, and related reading. | Quiet reading canvas with a slim progress line derived from the brand connection motif. | **Explore the related solution** |
| P07 About | **We build what businesses depend on.** “OrgTik connects strategy, technology, and operations so companies can move with fewer gaps.” | Story → belief → operating principles → capabilities → company journey → mission → people/partners → CTA. Replace abstract value cards with evidence or working principles. | A documentary-style video portrait connected to the company timeline; alternate dark narrative and light evidence sections. | **See the journey** |
| P08 Contact | **Tell us what needs to work better.** “A website, a workflow, a system, or the tools behind the business—start with the problem.” | Let visitors choose Platform, Services, Support, Partnership, or Other before the form. Show response expectation, direct channels, office/hours, privacy, and success next steps. | Calm directional video or poster with a single illuminated connection point; form lives on a stable light surface. | **Send your enquiry** |
| P09 Legal | Use the legal page title and a clear updated date. | Add sticky or in-page contents, plain-language summary, downloadable/print option, contact route, and anchored headings. Legal text remains authoritative. | Restrained light reading surface with dark plum type and minimal brand rules; no video. | Contextual legal/contact link |
| P10 Sitemap | **Find anything on OrgTik.** | Reflect the real CMS hierarchy, include Platform and Sign in, group content semantically, and provide search if the site grows. | Typographic directory with visible hierarchy and connector rules; no card grid. | Direct destination link |
| P11 Error | **This page has moved—or the connection broke.** | Explain what happened simply, preserve global navigation, suggest Platform, Services, Insights, and Contact, and offer retry when relevant. | The brand connection line breaks and visibly reconnects toward the primary action; reduced-motion version remains static. | **Go to homepage** or **Try again** |
| P12 Timeline/Roadmap | **From first commit to what’s next.** | Open with shipped proof, make status/year navigation persistent, separate company milestones from community ideas, and explain how an idea changes state. | Scroll-driven timeline spine; current year has the highest visual emphasis, future work uses lower certainty styling. | **Explore the timeline** |
| P13 Platform overview | **One workspace. Six systems. Built to work together.** “Start with one module and expand when the business is ready.” | Demonstrate a real cross-module workflow before listing features. Follow with modules, shared platform layer, subscription options, security/support, comparison, FAQ, and plan CTA. | Six modules orbit or connect through one navigable workspace; selecting a module changes the working demonstration. | **Build your plan** |
| P14 Module detail | Use module-specific outcome copy: e.g. **Know your people. Simplify the work around them.** for HR, or **See every relationship and next step.** for CRM. | Audience/problem → workflow demonstration → features → roles → integrations/module connections → plan availability → FAQ. Avoid identical copy structures across modules even though layout is shared. | A three-step product sequence with approved UI crops, or a clearly labelled concept when captures are unavailable. | **Choose this module** |
| P15 Plans | **Choose one system—or build your own stack.** | Start with the three decision modes, not a wall of price cards. Show transparent comparison, custom builder, review summary, commercial terms, FAQ, and sales path. | Selected modules assemble into one visual system; the summary updates in place without moving the user around the page. | **Build your plan** |
| P16 Sign in | **Welcome back.** “Sign in to access your OrgTik workspace.” | Keep the task focused. Preserve plan context when arriving from Pricing; expose recovery and support without marketing distractions. | Static deep-plum field with subtle emblem light and a precise light authentication panel; no autoplay video. | **Sign in** |
| P17 Case study | Dynamic headline: **How [client] moved from [problem] to [outcome].** | Prove the starting problem, decisions, delivered work, and verified result. Link every story back to the relevant service or module. | Full-bleed project media followed by annotated artifacts and evidence-led result moments. | **Start a similar project** |
| P18 Work index | **Work that connects the whole business.** | Featured project, service/sector filters, relevant project stories, and a clear contact path. | Editorial project images at varied scale; static hero keeps attention on the work. | **View the project** |

### Service-family outcome labels

Use these outcome labels in navigation and overview copy while preserving the formal service names on detail pages:

| Family | Outcome label | Supporting message |
|---|---|---|
| Marketing Services | **Create demand and make performance visible.** | Strategy, search, social, and paid campaigns connected to measurable customer action. |
| IT Support | **Keep the systems behind the business reliable.** | Maintenance, monitoring, fixes, and responsive support without the handoff gap. |
| Development Services | **Turn operational needs into dependable software.** | Websites, applications, integrations, and technical foundations designed around real workflows. |
| Web & Brand Design | **Make the business clear, credible, and easy to use.** | Identity, visual communication, web experience, and application UI working as one system. |

### SaaS module content hierarchy

Every module page should explain the product in this order:

1. **Outcome:** what becomes easier or more visible.
2. **Daily workflow:** the three actions a real user repeats.
3. **Core objects:** employees, contacts, files, tasks, campaigns, or pages.
4. **Control:** roles, permissions, history, approvals, and reporting.
5. **Connections:** which other OrgTik modules improve the workflow.
6. **Subscription:** single module, bundle inclusion, and custom-plan availability.
7. **Onboarding:** migration, setup, training, and support—only when confirmed.

### Proof hierarchy

Use proof in this order of strength:

1. Verified business outcome with baseline, period, and client approval.
2. Named case study showing the problem, work, and result.
3. Approved client quotation tied to a real engagement.
4. Product demonstration showing a specific workflow.
5. Documented delivery/process detail.
6. Client logo.

Generic praise, unsupported counters, stock avatars, and anonymous superlatives should not ship.

### Visual asset plan

| Asset family | Needed material | Where it is used |
|---|---|---|
| Animated video placeholder — confirmed | Temporary 10–15 second branded desktop loop, mobile version, poster, reduced-motion poster; replaceable with final footage | Required on Home; other marketing hero slots reuse the media system |
| Company footage | Team/process/Swiss business environment, documentary rather than staged stock | Home, About, Contact |
| Product captures | Approved real UI at desktop and responsive sizes; sensitive data anonymized | Platform, modules, pricing, homepage SaaS section |
| Case-study media | Client photography, website/device views, brand assets, process artifacts | Home and service pages |
| Editorial art | Purpose-built covers or diagrams by topic | Insights index and articles |
| Technical diagrams | Infrastructure, workflow, system connection, timeline | Hosting band, Platform, Services, Roadmap |
| Brand texture | Approved dark texture and light technical-node pattern | Quiet atmospheric use across dark/light sections |

Do not let generated visuals imply customer work, product functionality, certifications, locations, or staff that do not exist. Synthetic concept imagery must be labelled internally and replaced or approved before launch.

---

## Shared video-hero direction

The homepage hero must contain an actual background video. The user selected an **animated video placeholder** for this phase. Build a branded loop from suitable PDF artwork, keep copy/CTAs in HTML, and expose one replaceable media configuration. The table below is a future art-direction menu for other pages; it does not require producing a separate final film for each template now. Video supports the message and must preserve readability.

### Page-by-page video concepts

| Template | Background-video direction |
|---|---|
| P01 Home | Current scope: an animated branded video placeholder using original artwork and controlled plum/indigo light. A final montage of real work may replace it later if approved footage is supplied. |
| P02 Services overview | A fast, modular sequence moving between strategy, design, development, hosting, and support. |
| P03 Service family | One reusable video slot populated with family-specific footage or motion: marketing, IT support, development, or design. |
| P04 Service detail | Service-specific close-ups, interface motion, or process footage; use one flexible crop-safe composition for all ten instances. |
| P05 Insights index | A restrained editorial motion loop; avoid visually busy footage behind category controls. |
| P07 About | Human/company footage that supports the OrgTik story and Swiss context. |
| P08 Contact | Quiet location/team footage with generous negative space behind the contact message. |
| P12 Timeline | An abstract line, node, commit, or system-evolution animation that visually establishes movement through time. |
| P13 SaaS platform | Connected product modules flowing into one workspace; use real approved product visuals where possible. |
| P14 SaaS module detail | Module-specific interface or workflow animation based on existing product captures, not invented dashboard features. |
| P15 Plans | A calmer modular assembly animation showing one module, a custom combination, and the complete suite. |
| P17 Case study | Optional short project film or a restrained moving before/after; use only approved client media and always provide a strong static poster. |

P06 Article detail, P09 Legal, P10 Sitemap, P11 Error, P16 Sign in, and P18 Work index default to static or poster-based heroes. They prioritize reading, recovery, account-interface clarity, or project evidence.

### Video behavior and accessibility

- Autoplay only when muted and inline; never autoplay audio.
- Use short seamless loops with no hard flash, rapid strobing, or critical text inside the video.
- Place all real headings, copy, and CTAs as accessible HTML above the media.
- Apply a page-specific contrast overlay or gradient and test every frame of the loop, not only the poster.
- Provide a visible **Pause animation** control and honor `prefers-reduced-motion` by showing the poster image.
- Pause when the hero is off-screen or the browser tab is inactive.
- Distinguish automatic pausing from an explicit user pause. Returning to the viewport/tab must never undo a user's choice to pause.
- Do not trap focus or make controls disappear over changing footage.
- Mobile may use a shorter, differently cropped video or the poster image when bandwidth, battery, or viewport conditions make video inappropriate.

### Performance and content requirements

- Supply desktop and mobile crops, a poster image, and descriptive context in the local asset manifest. The current placeholder is decorative and silent; any future meaningful video needs appropriate accessible equivalents for its visual/audio content.
- Keep loops compressed and load the poster first; defer the video until the critical page content is usable.
- Avoid embedding third-party players in heroes. Use optimized hosted assets with WebM/MP4 fallbacks.
- Define a focal-safe area so faces, interfaces, and key motion survive responsive cropping.
- Track play failure and fall back cleanly to the poster without showing a broken player.
- Each page's local hero configuration needs: video asset, mobile asset, poster, focal point, overlay strength, motion-safe poster, and editorial approval status.

In this implementation these are local content fields, not CMS work. See the project plan for the placeholder storyboard, media budgets, and acceptance checks. Do not mark the video requirement complete until the real loop plays in the normal browser state.

---

## Shared component inventory

These should be designed as reusable components rather than redrawn on each page:

### Navigation

- OrgTik primary lockup, compact emblem, and approved light/dark variants.
- Desktop header.
- Services dropdown/mega menu.
- Platform/modules dropdown.
- Pricing link.
- Sign-in action.
- Mobile header.
- Mobile navigation drawer.
- Language selector.
- Active-page states.

### Hero media

- Background-video hero shell.
- Desktop/mobile video sources.
- Poster and reduced-motion variant.
- Contrast overlay/gradient.
- Pause/play control.
- Media loading and failure fallback.

### Content and navigation

- Breadcrumbs.
- Section heading.
- Rich-text block.
- Article table of contents.
- Category filter.
- Pagination.
- FAQ accordion.
- Timeline year navigation.
- Status/theme filters and search.
- Timeline/list view switcher.
- Milestone card and progress indicator.

### Cards

- Service-family card.
- Service-detail card.
- Article card.
- Project/case-study card.
- Testimonial.
- Benefit/value item.
- Contact-information item.
- Roadmap idea card.
- Vote control and status badge.
- Comment item.
- SaaS module card.
- Plan/bundle card.
- Selected-module summary.

### Conversion

- Primary CTA.
- Secondary CTA.
- Contact form fields.
- WhatsApp action.
- Phone/email actions.
- Form success and error messages.
- Idea-submission form.
- Idea-detail drawer/modal.
- Plan comparison table.
- Module selector and subscription summary.
- Sign-in and password-recovery fields/states.

### Global

- Footer.
- Footer product group: Platform, HR, CRM, Files, Tasks, Marketing, Website Manager, and Plans.
- Footer account link: Sign in.
- Social links.
- Cookie/privacy control if required.
- Loading, empty, and error states.

## Optional Figma structure

This is a reference organization if a Figma handoff is requested later. The current deliverable is a frontend plan followed by an authorized local frontend implementation; creating a Figma file is not a prerequisite or an implied deliverable.

```text
00 — Strategy, IA & User Flows
01 — Brand Foundations
02 — Components & States
03 — Navigation & Footer
04 — P01 Home
05 — P02 Services Overview
06 — P03 Service Family
07 — P04 Service Detail
08 — P05 Insights Index & Results
09 — P06 Article Detail
10 — P07 About
11 — P08 Contact
12 — P09 Legal
13 — P10 Sitemap
14 — P11 Error States
15 — P12 Timeline & Roadmap
16 — P13 SaaS Platform Overview
17 — P14 SaaS Module Detail
18 — P15 Plans & Subscription Builder
19 — P16 Sign In & Recovery
20 — P17 Case Study Detail
21 — P18 Work Index
22 — Video Hero & Motion System
23 — Responsive Patterns
24 — Populated Content Examples
25 — Prototype Flows
```

The **00 — Strategy, IA & User Flows** page should contain the approved sitemap, primary audiences, CTA model, conversion paths, and scope boundary. The **01 — Brand Foundations** page should contain the OrgTik logo library and safe-zone reference, palette/gradient tokens, Montserrat/Arial type system, spacing and radius tokens, icon rules, surfaces/elevation, accessible color pairings, video-overlay recipes, motion principles, and approved background texture/pattern samples.

## Recommended design frames

### Page masters

Plan **18 desktop masters**, one for each template. If using Figma, these become frames; otherwise use the same checklist for selected visual references and browser verification.

### Priority mobile masters

Create mobile versions for:

1. Home.
2. Services overview.
3. Service-family landing.
4. Service detail.
5. Insights index/category results.
6. Article detail.
7. About.
8. Contact.
9. Timeline/roadmap.
10. SaaS platform overview.
11. SaaS module detail.
12. Plans/subscription builder.
13. Sign in/recovery.
14. Case-study detail.
15. Work index.

Legal, Sitemap, and Error can inherit the responsive editorial system, with targeted mobile checks instead of fully separate explorations.

### Recommended design sequence

| Phase | Frames | Why now |
|---|---|---|
| 1 — System | Strategy/IA, foundations, header/mega menus, mobile drawer, footer, CTA and form primitives | Establishes decisions reused everywhere. |
| 2 — Commercial core | Home, Platform overview, Module detail, Plans/builder, Sign in, Contact | Defines positioning and the main revenue journeys. |
| 3 — Services | Services overview, Service family, Service detail | Builds the agency/service conversion system from the approved core. |
| 4 — Trust and participation | About, Work index, Case-study detail, Timeline/Roadmap | Establishes company credibility and the clearly labelled participation preview. |
| 5 — Content and utility | Insights, Article, Legal, Sitemap, Error states | Completes acquisition, SEO, readability, and recovery. |
| 6 — Responsive and prototype | Priority mobile masters, edge cases, six flows, reduced-motion/video fallbacks | Validates the complete system rather than isolated screens. |

### Component/state frames

Create focused component frames for:

- Desktop services navigation open.
- Mobile drawer open.
- Language menu open.
- FAQ closed/open.
- Blog category selected and pagination.
- Contact validation, sending, success, and failure.
- Carousel behavior.
- 404 and server-error variants.
- Timeline filters, year navigation, and list view.
- Roadmap board and mobile grouped list.
- Idea-detail drawer, voting, commenting, and submission states.
- Video hero: desktop, mobile crop, poster, reduced motion, loading, paused, and failure fallback.
- Platform dropdown and Sign in navigation states.
- Plan cards, comparison, module selection, custom-plan review, and price-unavailable states.
- Sign in, credential error, recovery, locked account, and preserved-plan states.

## Core prototype flows

### Service-to-lead flow

```text
Home or navigation
  → Services overview
    → Service family
      → Service detail
        → Relevant case study
          → Contact form or WhatsApp
```

### Content-to-lead flow

```text
Insights index
  → Category filter
    → Article
      → Related service
        → Contact form or WhatsApp
```

### Mobile flow

```text
Hamburger
  → Navigation drawer
    → Platform / Pricing / Services / Work / Insights / Company / Contact / Sign in
      → Locale switch preserves the current page when reviewed translations exist
```

### Timeline-to-participation flow

```text
Timeline hero
  → Browse or filter milestones
    → Community roadmap
      → Open idea detail
        → Vote / comment
          → Submit a new idea or start a project
```

### SaaS discovery flow

```text
Home SaaS section or Platform navigation
  → SaaS platform overview
    → Module detail
      → Plans and comparison
```

### Plan-to-enquiry preview flow

```text
Plans
  → Choose one module / bundle / custom workspace
    → Configure team and options
      → Review selected plan
        → Contact preview with plan context
          → Validate and show explicit “No message was sent” feedback
```

P16 Sign in/recovery remains a separately testable interface preview. A real subscription-to-access journey requires future integration and is excluded from this phase.

## Business decisions before public release

These do not all block frontend design. Use the declared defaults and labelled local fixtures in the project plan; resolve each item before presenting the affected behavior or claim as live.

1. Confirm the final SaaS product name: OrgTik, OrgTik Business Suite, or another approved name.
2. Confirm which modules and features exist today, are in beta, or are roadmap-only.
3. Approve pricing logic: per user, per company, per module, storage, onboarding, support, taxes, and billing terms.
4. Define the subscription handoff after sign-in, even though dashboard and billing screens remain outside this website scope.
5. Confirm available authentication methods and password/security policy.
6. Approve the final service taxonomy and whether “Web & Brand Design” replaces “Web Design Services.”
7. Select three to five projects with client approval, usable media, and evidence for P17 case studies.
8. Replace generic testimonials with named, approved proof or remove the section.
9. Verify every hosting, performance, accessibility, customer, and roadmap claim.
10. Confirm final contact details, legal entity wording, data-hosting statements, and privacy/terms ownership.
11. Extract suitable logos/textures from the supplied PDF, confirm the web-font source, and obtain approved product/client media. The animated hero video placeholder is already authorized; final footage is a later replacement.
12. Confirm the localization workflow and whether all routes launch simultaneously in EN/DE/FR/IT.

## Final design count

For UX/UI planning, treat the website as:

- **18 unique page templates.**
- **15 priority mobile layouts**, plus mobile checks for Legal, Sitemap, and Error.
- **1 reusable component library.**
- **6 main prototype flows.**
- **A complete interaction-state matrix** covering navigation, video, filters, forms, roadmap participation, pricing configuration, authentication, loading, empty, success, and failure.

The inherited claim of 120 old-site routes is a content-inventory concern, not 120 separate design tasks; the route export was not provided in this review. The described timeline adds one page master and one drawer state. The SaaS expansion adds four public/account-interface templates while excluding the six authenticated dashboards. P18 completes the existing Work navigation. All backend-dependent states remain labelled frontend demonstrations under the current delivery contract.
