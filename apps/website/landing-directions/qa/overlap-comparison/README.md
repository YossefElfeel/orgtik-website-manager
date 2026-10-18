# Overlap comparison — 2026-10-04

The popup now distinguishes the plans already in the cart from the plan being added. Each comparison panel names its plan and shared items, shows individual durations and renewal settings, and contains the action that keeps that version. Non-overlapping incoming items appear separately as Included with either choice. Matching terms are explained instead of implying a change.

Verified in the local browser:

- Digital Experience already in the cart versus Complete Design being added, both with one-month manual renewal. The plans were clearly named and the identical terms explained; Branding appeared as included with either choice.
- Keep cart version retained Digital Experience and added only Branding. Undo restored the two original cart groups.
- Existing mixed terms (Graphic design: three months, automatic renewal; Web & app design: one month, manual renewal) versus a six-month Complete Design with manual renewal. Both sets appeared accurately and the identical-terms message was absent.
- Use new version moved the shared items into Complete Design, with all three items at six months and no duplicated service. Undo restored the original mixed durations and renewal preferences.
- Escape closed without changing the cart and returned focus to Add Complete Design to cart. Forward Tab from Cancel returned to Close dialog; reverse Tab from Close dialog returned to Cancel.
- At 320/390px, the panels stacked without horizontal overflow. Both choice buttons were visible at 320 × 920; the dialog scrolled for supporting information. At 768/1440px, the panels appeared side by side without overflow.

Validation: all 36 purchasing tests, formatting, production build, and `git diff --check` passed.

All temporary service selections were removed. The original Team Workspace cart remains with HR, Tasks, and Files at three months, manual renewal, CHF 261.90 due today.

Evidence: [desktop](desktop-1440.png), [320px](mobile-320.png), [390px](mobile-390.png), [768px](tablet-768.png), [different durations and renewal](different-terms.png).
