# Collapsed customization — 2026-10-04

Make it yours now starts collapsed in the shared ConfigurationEditor. Its full heading is a native summary, with a visible chevron and desktop Show options / Hide options label. Shared duration, selected-package summary, and current pricing remain visible. Opening and closing never changes the configuration; starting a different configuration resets the disclosure to closed.

## Browser verification

- Services: Graphic design at three months started collapsed. Enter expanded the section; changing its duration to six months and enabling automatic renewal updated the amount to CHF 4'860. Space collapsed it, hiding the individual controls. Reopening retained six months and renewal enabled, with the matching price still visible in the summary.
- Software: HR and Tasks at six months started collapsed and expanded with the keyboard. Changing from an expanded configuration to Sales & Marketing started the new configuration collapsed.
- Cart: Team Workspace content editing started collapsed. HR six months plus automatic renewal remained in the draft after closing and reopening, with a CHF 394.20 draft total. Cancel restored the original three-month, manual-renewal plan and CHF 261.90 cart total.
- Responsive checks: 320, 390, 768, and 1440px. The disclosure stays inside the layout, has a full-row click target, and shows a compact chevron at narrow sizes. No horizontal page overflow observed.
- No browser console errors during verification.

Proof: `desktop.png` and `mobile-320.png` show the collapsed section with shared duration and price summary visible.

## Checks

- `npm run test:cart`: 36 passed.
- `npm run format:check`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
