# @orgtik/ui

OrgTik's design system: tokens, light and dark themes, five languages with full RTL, and the components every suite dashboard shares. The identity comes from the new website (plum and indigo, Montserrat, Phosphor icons, the pill).

Status: 0.x, P1a (the VS-1 slice). Checked on Next 16.3 and Next 15.5 with Tailwind 4.3 and 4.1 (`apps/next-smoke-*`).

## Set up an app

1. Install the package and its peers:

   ```bash
   npm i @orgtik/ui @phosphor-icons/react
   ```

   Two peers are optional:
   - `react-hook-form`, for `@orgtik/ui/rhf`
   - `@tanstack/react-table`, for `@orgtik/ui/table`

2. Add one line to the app's CSS, after `@import "tailwindcss";`:

   ```css
   @import "@orgtik/ui/tailwind.css";
   ```

   It brings the fonts, the `--ot-*` tokens, and the Tailwind theme (`bg-raised`, `text-fg-muted`, `rounded-pill`, `text-body`, and so on). It also registers the library's classes with Tailwind, so nothing goes in `@source`.

3. Set up the root layout. `lang` and `dir` are set on the server. The theme is applied before first paint, from the `ot-theme` cookie, which is shared across the suite. The provider goes inside `<body>`:

   ```jsx
   import { cookies } from "next/headers";
   import { THEME_COOKIE, ThemeScript, directionOf, themeAttributes } from "@orgtik/ui";
   import { OrgtikNextProvider } from "@orgtik/ui/next";

   <html lang={locale} dir={directionOf(locale)} {...themeAttributes((await cookies()).get(THEME_COOKIE)?.value)} suppressHydrationWarning>
     <head><ThemeScript /></head>
     <body><OrgtikNextProvider locale={locale} digits={person.digits}>{children}</OrgtikNextProvider></body>
   </html>
   ```

   - Set the theme on `<html>` from the server as well as with `ThemeScript`: Next renders a 404 or an error in its own shell and then replaces `<html>` on the client, which drops what the script set (a dark-theme reader got a light 404). `themeAttributes` gives `data-theme` and `color-scheme` from the cookie.
   - Use `OrgtikProvider` from the main entry outside Next.
   - `digits` is the person's Arabic digit setting (D-016), and defaults to Latin.
   - `strings` overrides any of the library's own words.

## Entries

| Import | What |
|---|---|
| `@orgtik/ui` | Tokens, theme, provider, and every component, including `Board` (Kanban on dnd-kit; see BOARD-CALENDAR.md) |
| `@orgtik/ui/next` | `OrgtikNextProvider`, which renders library links with `next/link` |
| `@orgtik/ui/rhf` | `RHFField` and `createRHFField(Input)` / `(Switch, "checked")` / `(Select, "select")` |
| `@orgtik/ui/table` | `DataTable`: client or server mode, sort, selection with bulk actions, all states |
| `@orgtik/ui/dates` | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` (React Aria's calendar in a Base UI popover; ISO date strings), `DateTimePicker`, and `CalendarGrid` (a month or week of events; see BOARD-CALENDAR.md). Peers: `react-aria-components`, `@internationalized/date` |
| `@orgtik/ui/tailwind.css` | The CSS entry above |
| `@orgtik/ui/tokens.css` | Tokens only, for hosts without Tailwind |
| `@orgtik/ui/tokens` | The same values for code (charts, canvas) |

## Components (P1a + P1b)

- **Actions:** Button (primary, secondary, ghost, danger, link, and brand: the pill with the arrow chip), IconButton (a `label` is required).
- **Form:** Field, Input, PasswordInput, Textarea, Checkbox, Switch, Select, RadioGroup, Combobox, MultiSelect, NumberField, MoneyField (ISO minor units), PercentField, LocalizedField (D-014, proposed), FileField, and the date pickers.
- **Overlays:** Dialog, Sheet, ConfirmDialog (it requires `impact`), Menu (with submenus), Popover, Tooltip.
- **Display:** Badge, StatusBadge (from the status matrix, labels per viewer), Tag, Avatar, Card, Skeleton, Spinner, Progress, Meter, LimitMeter (OK / near / full / over), Toast (`toast.success()`).
- **Navigation:** Tabs, SegmentedControl, FilterChips, Pagination, Breadcrumb, PageHeader, Accordion, Collapsible, ScrollArea, Separator.
- **States:** EmptyState, ErrorState, NoPermissionState, LoadingState, ListStates.
- **Shell:** SuiteShell, AppRail, Sidebar, TopBar, UserMenu (theme and language), BannerRegion (one banner, by priority), Logo.

## Rules the components carry

- **Logical sides only.** Icons that point somewhere mirror in RTL. Logos never mirror.
- **Bidi-safe fields.** Email, URL, phone and number inputs stay LTR inside RTL pages.
- **Status is never colour alone.** A tone always comes with words, and a status also gets an icon.
- **No dead ends.** Every empty state takes an `action`. ErrorState offers a retry.
- **Honest confirmations.** A destructive confirm says what else is affected (`impact`) and uses a verb-object label ("Delete folder", never "OK").
- **Toasts follow the server.** A success toast is shown only after the server answered 2xx.
- **Tooltips add, never hold.** A tooltip is never the only way to act or learn something.

## Develop

```bash
pnpm --filter @orgtik/ui build            # tokens, fonts, then tsc
pnpm --filter @orgtik/ui status           # regenerate the status table from orgtik-program/status-matrix
pnpm --filter @orgtik/ui logo             # regenerate the logo paths from the website's files
pnpm --filter next-smoke-16 dev           # the smoke pages on :3210 (next-smoke-15 on :3215)
pnpm --filter docs storybook              # Storybook on :6006: Theme, Language and Layout (Single / Matrix 2×2) toolbars
pnpm --filter docs build && pnpm --filter docs check   # every story × 6 combinations: pixel baselines + axe (check:update accepts a change)
```

The smoke apps have one page per component group: `/en`, `/ar`, `/…/forms`, `/…/overlays`, `/…/display` and `/…/shell`. `node shots.mjs <page>` screenshots each one in EN and AR, light and dark.

Generated files are committed, so consumers need neither the CSV nor the website:
- `src/tokens.ts`
- `src/status/*`
- `src/brand/logo-data.ts`

Fonts: IBM Plex Sans Arabic and Montserrat, both OFL-1.1. Their licences are in `fonts/`.
