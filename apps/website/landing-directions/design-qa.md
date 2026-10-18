# Reference implementation QA

Date: 2026-09-28

Source: user-supplied `OrgTik Website3.html`.
Implementation: `http://127.0.0.1:4173/`.

## Result

Passed visual and interaction checks. All ten page groups are implemented as editable React components, with source imagery, typography, colors, section treatments, and interactions. No document-viewer runtime or external font/icon CDN is required.

## Browser coverage

- 26 views checked: all ten page groups plus product, service-family, and service-detail views, at 1440 × 1000 and 390 × 844.
- No JavaScript exceptions, console warnings, or horizontal document overflow in the final sweep.
- Desktop header/navigation and browser Back.
- Six-product software bundle, billing duration, plan comparison, product detail.
- Service bundle and contact handoff.
- Contact validation and local success state.
- Password-reset preview.
- Insights search, empty state, and article navigation.
- Reversible roadmap voting.
- Mobile navigation, focus containment, Escape, focus restoration, and scroll unlock.
- Legacy route mapping, product selection from query parameters, and disabled comparison for an empty workspace.

Results: `qa/browser-results.json`, `qa/interaction-results.json`.
Screenshots: `qa/reference-desktop.png`, `qa/desktop-home.png`, `qa/desktop-services.png`, `qa/desktop-software.png`, and matching mobile captures.

## Build checks

- Production build completed successfully (`dist/client`).
- Prettier check passed.
- Git whitespace check passed.
- The final production build was rerun for the pull request after removing the redundant accessibility attribute; it passed without compiler warnings.

## Corrections during verification

Corrected malformed navigation attributes inherited from the export, removed duplicate class helpers and duplicate data properties, resolved dynamic hover rules, used local root-relative assets, hid decorative icons from accessible button names, added mobile-menu keyboard handling, promoted index-page headings, and retained older route/selection links.

## Scope

Forms, account actions, votes, estimates, and plan choices remain clearly labelled local previews. Backend delivery, authentication, payments, production legal approval, deployment, and cross-browser certification were not part of this update. Verification used local Chromium/Edge because the in-app browser automation was unavailable.

## Hero scope and Software footer — 2026-09-28

- Full-screen heroes appear only on Home, Services overview, and Software overview. Other pages open with content; service, product, project, and article details retain compact headings. Sign-in opens directly to its form.
- Software footer now supplies explicit labels and destinations for all nine navigation links.
- Verified all 13 primary/detail routes at 1440px and 390px: no horizontal overflow, console warnings, or page errors. Checked hero presence on those routes, project/article details, and returning from service/product details to the mobile overview video.
- Visually reviewed desktop/mobile sign-in and Software footer captures. Production build passed.

## Tagged testimonials — 2026-09-28

- Added a shared section before each closing CTA: mixed/filterable entries on Home and About, scoped categories on Services and Software overviews, and project-specific entries on all five project details.
- Content remains explicitly labelled as placeholders awaiting approved feedback; no client endorsements or names were invented.
- Production build and git diff checks passed. Verified nine routes at 1440px and 390px, category filters, card counts, keyboard Home/End controls, disabled carousel boundaries, no document overflow, and no page errors.
- Reviewed screenshots: qa/testimonials-1440.png and qa/testimonials-390.png.

## Testimonial reference and restored heroes — 2026-09-28

Source visual: C:/Users/HP/AppData/Local/Temp/codex-clipboard-ce30635c-923b-46f4-b2aa-e697bc6b04b9.png (2255 × 960).
Implementation: qa/testimonials-reference-2255.png (2255 × 1101), qa/testimonials-reference-390.png, and qa/hero-{about,roadmap}-{2255,390}.png.
CSS viewports: 2255 × 1000 and 390 × 1000; device scale 1. Desktop element capture includes the full section. Source and implementation were opened together at the same pixel width; extra height accounts for retained filters/tags and newly requested stars. The source shows a middle carousel range; implementation shows the first range so its previous button is disabled.

Findings and comparison history:
- First pass: [P2] About and Roadmap eyebrow text clipped on mobile. Restored text wrapping and prevented the decorative dot shrinking. Final mobile hero captures show complete text.
- First pass: [P2] Quote text wrapped more densely than the reference. Reduced desktop quote size from 1.9vw to 1.7vw; recaptured and compared the first and third cards.
- Removed the duplicate About H1 introduced by restoring its hero; both restored pages have one H1.

Required fidelity surfaces:
- Typography: existing local Montserrat, large light quote text, lavender heading emphasis, smaller category/client metadata. Quote wrapping reviewed in the desktop comparison.
- Layout: three plum cards on desktop, one on mobile, quote/category row, client divider and avatar row, bottom count/arrows. Retained filters, category tags, and added star previews are intentional extensions.
- Colors: dark plum section, lighter plum cards, muted borders, lavender accents and text.
- Assets: existing Phosphor quote, user, arrow, and star icons; existing supplied hero video/poster. No new raster assets required.
- Content: placeholder stories and attribution remain labelled; stars are marked as rating previews, not verified client ratings. Existing category and project scope preserved.

Verification:
- Nine testimonial routes tested at both widths; category filters, counts, keyboard boundaries, five stars per card, and absence of horizontal page overflow passed.
- About and Roadmap heroes verified at both widths.
- No page errors. Production build and git diff --check passed.
- In-app browser timed out; existing headless Edge verification workflow supplied rendered captures. Fixed navigation visible in desktop capture is existing site UI, not part of the source section.
- Full-view and readable card-level comparison performed together; no additional focused crops needed. No remaining actionable P0/P1/P2 findings.

final result: passed

## Final card spacing and Contact introduction — 2026-09-28

- Removed the standalone Placeholder testimonial text. Rating previews and placeholder client attribution remain visible.
- Final card screenshots: qa/testimonials-spacing-1440.png and qa/testimonials-spacing-390.png. Browser measurements confirmed an 18px gap below each review and matching left edges for review, stars, and divider; removed excess minimum card heights.
- Contact now follows the Software plan-builder introduction: eyebrow/H1 on the left, subtitle on the right, stacked on mobile. Screenshots: qa/contact-intro-1440.png and qa/contact-intro-390.png.
- Verified Contact at both widths: one H1, correct two-column/stacked placement, no horizontal overflow, and empty-form validation. Production build passed after the final implementation.
- These screenshots supersede the earlier testimonial reference captures for final spacing and copy.

final result: passed

## Viewport layout review and service-related work — 2026-09-28

1. Reviewed 39 routes across all ten page groups, all service families and 11 individual services, six software products, five projects, and representative plan/article views. Baseline: 1440 × 900 and 390 × 844. Final checks: those viewports plus 1366 × 768 (117 route/view combinations). Measurements are in qa/viewport-before.json and qa/viewport-after.json.
2. Reduced oversized content-section padding, heading gaps, and media minimum heights. Retained full-screen heroes and natural content height. At 1440 × 900, Home selected work reduced from 1397px to 873px; About purpose from 1185px to 794px; Services families from 973px to 817px; Software workspace from 1177px to 927px.
3. Added related work to every individual service detail, using shared projects.js data. Project status labels distinguish owned work, concepts, and mock samples. Verified actual navigation to project detail for design, development, marketing, IT support, and hosting.
4. Final route checks: no page exceptions or horizontal document overflow. Existing interaction checks passed: navigation/Back, software bundle and billing/comparison, product detail, service/contact handoff, contact validation/success, password recovery preview, Insights search/article, roadmap voting, legacy routes, mobile navigation/Escape/focus.
5. Visually inspected Home, Software, About and the new service work cards. Desktop/mobile related-work captures: qa/service-work-desktop.png and qa/service-work-mobile.png. Full-page overview captures document overall rhythm; lazy offscreen images may not be loaded in those captures.
6. A further attempt to compress the Home work grid caused card scrollHeight to exceed clientHeight. Reverted it to the tested minimum-safe sizing; final card heights equal their content heights (418/198/198/216px at 1440 × 900). Section height 873px excludes the fixed navbar, so some scrolling remains.
7. Dense service lists, builders, capability grids, roadmap boards, articles, and mobile stacks intentionally remain taller than one viewport. No fixed-height clipping, hidden content, or reduced body font sizes were introduced to force a fit. The new service work section is approximately 661px high on desktop.

Build and git diff checks passed. This is a layout and interaction review, not a full accessibility certification. Remaining long sections are intentional content-driven exceptions.

final result: passed

## Heading hierarchy — 2026-09-28

- Secondary H2 titles now share a responsive 24–40px scale across page sections, testimonials, related service work, and closing sections. Compact page H1 titles use 34–62px to stay visually dominant.
- Built successfully with npm run build; git diff --check passed.
- Browser verification covered 39 routes at 1440px, 768px, and 390px (117 cases). Every visible main-content H2 was smaller than its page H1, with no horizontal overflow or JavaScript errors.
- Reviewed service-category and project-detail screenshots at desktop and mobile sizes. Measurements: qa/heading-hierarchy.json; screenshots: qa/heading-services-{1440,390}.png and qa/heading-project-{1440,390}.png.

## Two-card related work — 2026-09-28

- Service detail sections show two distinct existing project cards in one row on desktop and a single column on mobile. Each card preserves its own category and project status.
- Verified all 11 service detail pages at 1440px and 390px (22 route/viewport checks): card count, distinct destinations, column placement, and absence of horizontal overflow.
- Build and git diff --check passed. Final screenshots: qa/service-work-two-1440.png and qa/service-work-two-390.png.

## Closing mark and sign-up preview — 2026-09-28

- Resized and centered the full official closing mark on Home, Services, Software, Work, About, and Insights. At 1440px and 390px, the mark stayed fully within each section and no page had horizontal overflow.
- Added /sign-up, a Create account mode beside Sign in and Reset password, and a sitemap entry. The preview validates name, work email, password length (at least eight characters), and matching confirmation, then states that no account was created or data stored.
- Built successfully with npm run build. Browser checked empty, short, mismatched, and valid sign-up submissions at 1440px and 390px; checked tab changes, back navigation, sitemap entry, and mobile width. Existing Sign in and Reset password modes remained reachable.
- Screenshots: qa/closing-logo-{1440,390}.png, qa/sign-up-{1440,390}.png, and qa/sign-up-form-390.png.

## Restored closing mark and reset label — 2026-09-28

The large closing mark is restored on Home, Services, Software, Work, About, and Insights. The closing section has enough height to display the whole mark, with a smaller mobile section height. The Reset password mode label now stays on one line. Built successfully and checked all six closing sections at 1440px and 390px; the mark stayed inside each section and the label did not wrap. Final screenshots: qa/closing-logo-restored-1440.png and qa/closing-logo-restored-390.png.

## Closing mark rotation and headline — 2026-09-28

The closing mark stays large and centered but no longer rotates, which prevented the mark from being clipped during normal motion. The Home closing headline is now 48px at 1440px and 30px at 390px. Built successfully and checked all six closing sections at both widths with normal motion enabled: the full mark remained inside the section. Final screenshots: qa/closing-logo-centered-1440.png and qa/closing-logo-centered-390.png.

## Service detail section order — 2026-09-28

On all 11 service detail pages, Related work now appears as section (04), followed by the same-family recommendations (for example, More in Design) as section (05). The two related project cards and recommendation links remain intact. Built successfully and checked 22 route/viewport cases at 1440px and 390px for DOM order, visible numbering, and horizontal overflow. Screenshots: qa/service-section-order-1440.png and qa/service-section-order-390.png.

## Large Home closing CTA and testimonials without filters — 2026-09-28

- Compared the supplied 2005 × 960 closing-section reference with `qa/closing-reference-viewport.png` at the same viewport. The Home section uses the reference's dominant two-line headline, centered faint official mark, and dark-violet composition. Its current single “Talk to us” button is intentionally preserved, as requested, instead of adding the reference's second button.
- At 2048 × 960, the Home section and logo measured 960px and 860px high respectively, leaving about 45px above and below the mark. At 390 × 960, they measured 560px and 351px, leaving about 102px above and below. Neither viewport had horizontal overflow. Screenshots: `qa/closing-large-2048.png` and `qa/closing-large-390.png`.
- Removed All/Services/Software filter tabs from the shared testimonial component. Checked Home, About, Services, Software, and all five project detail routes at 1440px and 390px (18 route/viewport cases). Category tags, project-specific content, and carousel navigation remain; the mobile next arrow advances the track. No horizontal overflow or JavaScript errors were observed. Screenshots: `qa/testimonials-no-tabs-1440.png` and `qa/testimonials-no-tabs-390.png`.
- `npm run build` passed. No P0, P1, or P2 visual mismatches remain in this scope.

final result: passed

## Closing CTA consistency across page groups — 2026-09-28

- Home, Services, Software, Work, About, and Insights now share responsive closing-section dimensions, headline scale and line height, and centered official background-mark sizing. Contextual copy and existing CTA labels/destinations remain in place.
- Browser-checked all 35 routes that render the closing CTA at 390px, 768px, 1024px, 1440px, and 2048px with a 960px viewport height, plus 1366 × 600px (210 route/viewport checks). The mark remains wholly inside the section; headings and content do not clip or overflow horizontally; the existing one-button Home and two-button other-page arrangements remain intact. Two longer Software variants expand the section naturally at 2048px.
- Visually compared Home and the five other overview sections at 1440px and 390px. Captures: `qa/closing-consistency-{home,services,software,work,about,insights}-{1440,390}.png`.
- `npm run build`, Prettier formatting, and `git diff --check` passed. No P0, P1, or P2 visual mismatches remain in this scope.

final result: passed

## Home selected-work card spacing — 2026-09-29

- Increased grid gaps from 22px to 40px at desktop width and from 16px to 28px on mobile. Card padding grew from 28px to 38px on desktop and from 20px to 26px on mobile; eyebrow-to-title and title-to-summary gaps grew from 12px/10px to 20px/18px.
- Increased the space from the section introduction to the card grid to 48–64px, the section eyebrow-to-heading gap to 28px, and the introduction copy-to-link gap to 30px. The two heading lines have a slightly more open line height.
- Increased the short desktop card rows from about 211px to 250px at a 960px viewport height, and mobile cards from 330px to 360px, so the larger spacing does not crowd or clip content. The large lead card and final wide card expand consistently.
- `npm run build`, Prettier, and `git diff --check` passed. Browser-checked the four cards at 2048px, 1440px, and 390px: the summaries stay inside their cards and there is no horizontal page overflow. Final section captures for review: `qa/home-work-spacing-1440.png` and `qa/home-work-spacing-390.png` (fixed navigation hidden in the captures so it does not cover the mobile cards).

final result: passed

## Navigation language dropdown preview — 2026-09-29

- Added a shared English/Arabic/German selector to the desktop navigation and compact mobile header on Home, Services, Software, Work, About, Insights, Contact, Roadmap, Legal, and Sign in. The dropdown shows selected state and closes on outside click or Escape. Content, document language, direction, routing, and translations are unchanged.
- Browser-checked all ten page templates at 1440px, 1180px, 390px, and 320px (40 cases) for header fit. Verified option selection, Escape dismissal, and dropdown viewport bounds on Home. No header collisions or out-of-bounds controls remained.
- Review captures: `qa/language-menu-1440.png` and `qa/language-menu-390.png`. `npm run build`, Prettier, and `git diff --check` passed.

final result: passed
