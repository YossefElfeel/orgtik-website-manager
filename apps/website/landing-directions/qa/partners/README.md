# Partners: homepage strip and Legal directory

Six explicitly labelled mock partners share one Website Manager record (`pg_partners`). Their original SVG logos appear immediately after Home's Two sides section, with profiles at `/legal/partners`.

The strip follows the site's plum palette, typography, grid and circular-arrow pill CTA. Compact controls sit in its heading. Logos loop horizontally at 36px/second, with soft edge fades and no visible native scrollbar. Swipe and keyboard scrolling remain available. Manual interaction pauses autoplay for two seconds; explicit Pause stays paused. Logo hover, keyboard focus, reduced motion, offscreen state and background visibility stop motion as appropriate.

Legal profiles show only configured website and named social links. Current mocks use clearly labelled example.com destinations; names and URLs are editable in the CMS. Examples cover website-only, social-only, combined and no-link profiles. Outbound links have accessible new-tab hints and `noopener noreferrer`; invalid schemes and credential-bearing URLs are excluded.

Browser verification at 320, 390, 768 and 1440px found no page overflow, zero scrollbar space and 44px control targets. Autoplay, Pause/Resume, arrow navigation, keyboard scrolling, profile navigation and optional-link rendering were checked. Authentication handoffs are verified separately with request fixtures; no real account or charge was created during browser QA.

Final screenshots:

- `refined-desktop.jpg`, `refined-390.jpg`: homepage strip.
- `links-desktop.jpg`, `links-390.jpg`: Legal profiles and optional destinations.
