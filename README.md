# OrgTik Website + Website Manager (standalone)

The public website and its Website Manager dashboard, copied out of the `orgtik-suite` monorepo
(`C:\Users\yosse\Projects\New sass\orgtik-suite`, `main` at `6432ef26` plus its uncommitted changes, 2026-10-18)
so they can be worked on apart from the SaaS product.

| Folder | What it is | Local URL |
| --- | --- | --- |
| `apps/wm` | Website Manager dashboard (Next 16) | http://localhost:3007 |
| `apps/website/landing-directions` | Public website (Vite + React) | http://localhost:4173 |
| `packages/ui` | `@orgtik/ui`, the design system the dashboard uses | built into `dist/` |
| `mock` | Persistent mock backend: identity (`:4000`), WM API (`:4007`), admin (`:4008`) | |
| `program/cms/sections.json` | Section definitions shared by the website and the WM API | |

## Run it

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds `@orgtik/ui`, then starts the mock backend (`node server.js --only wm`), the dashboard and the website.
Open http://localhost:3007, choose **Sign in**, and pick one of the mock accounts (one per role: super admin, approver,
editor, marketing, SEO, viewer). Content the dashboard publishes appears on the website at http://localhost:4173.

Separate pieces: `pnpm dev:api`, `pnpm dev:wm`, `pnpm dev:website`.

Mock data persists in `mock/journal/demo-workspace.json`.

## How it differs from the suite

- **Sign-in:** the suite signs people in through the SOS app and its launcher. This copy has its own page,
  `apps/wm/app/[locale]/sign-in`, which signs in against the mock identity API. The settings for it are in
  `apps/wm/.env.development`. "Home", "Back" and sign-out return to the dashboard.
- **Backend:** the mock still runs its admin module, because sign-in and permissions depend on it. It no longer
  starts the other tools' APIs.
- **Website and the SaaS:** pricing, checkout and "sign in to OrgTik" still call the mock's suite API on `:4000`
  (`VITE_SUITE_API`). Links that hand off into the SaaS apps (SOS, CRM portal) have nothing to open locally.
- **Removed:** the Vercel and CI tooling, the whole-suite launcher, the demo runtime, and the QA audit scripts that
  needed other suite apps.
- **Lockfile:** resolved fresh for these four packages. `pnpm-workspace.yaml` pins the tiptap menu extensions
  to the suite's 3.31.4.
