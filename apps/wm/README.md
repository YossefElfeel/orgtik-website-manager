# Website Manager

The internal CMS for orgtik.ch (plan Phase 2; D-002, D-034). It runs on `@orgtik/ui` from its first line: no token bridge and no local palette.

## Run it locally

1. Start the local-dev mock: `node local-dev/server.js`. It serves the Website Manager API on :4007 and SOS identity on :4000.
2. `npm install`, then `npx yalc add @orgtik/ui`. The library is linked with yalc while it's 1.0.0-rc.
3. `npm run dev`. The app runs on http://localhost:3007.
4. Sign in on SOS (http://localhost:3013/auth/login) and open **Website** in the launcher.

`.env.local` holds `NEXT_PUBLIC_WM_API_URL`, `NEXT_PUBLIC_SOS_API_URL`, `NEXT_PUBLIC_SOS_URL` and `NEXT_PUBLIC_WEBSITE_URL`. The defaults are the local ports.

## How it's put together

- **Languages:** all five, in the path (`/ar/...`), with next-intl. `messages/*.json` have exact key parity.
- **Sign-in:** the launcher hands off to `/<locale>/auth?token=...`.
  - The page checks the token against `/v2/admin/me`, keeps it in a cookie, and replaces the address, so the token doesn't stay in the URL or the history.
  - A 401 says the link expired. A 403 shows the no-access page.
- **Permissions:** `/v2/admin/me` returns the person's roles and permissions.
  - The navigation hides what a role can't view.
  - A page opened by direct link says which permission it needs (`RequirePermission`).
  - The API enforces every permission again.
- **API:** `store/api.ts` (RTK Query) unwraps the v2 envelope (`{data, meta}` / `{error: {code, message, required?}}`). Every failure becomes an `ApiError` the screen handles where it happened, never with a global toast.

## Roles

The local mock's roles (D-034):

| Person | Role |
|---|---|
| Mona | Admin |
| Karim | Approver |
| Hoda | Editor |
| Dina | Marketing |
| Laila | SEO |
| Salma | Viewer |

## Slices

- **S0 (done):** the shell in 5 languages × 2 themes, SSO from the launcher, RBAC and 403.
- **S1 (next):** the content model v2, seeded from the website at `d76ee3b`. It includes the department case studies (D-032).

## Checks

These live in `orgtik-program/tools/audit-kit`:
- `vs1.mjs --app wm --route /`: 5 languages × 2 themes × 2 widths.
- `flows/wm-s0.mjs`: the S0 exit, walked in the browser.
