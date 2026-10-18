# Board and CalendarGrid

Two components for the Tasks app. HR and CRM pipelines can use the board later.

- `Board` is exported from `@orgtik/ui`. It is built on dnd-kit: `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities` are dependencies of the library.
- `CalendarGrid` is exported from `@orgtik/ui/dates`. It is built on `@internationalized/date` (D-009).

Stories: `Data/Board` and `Data/CalendarGrid` in apps/docs. Behaviour checks: `apps/docs/tests/interactions.mjs`, which `pnpm --filter docs check` runs after the visual check.

## Board

```ts
type BoardColumn = { id: string; title: string; color?: Tone | string; count?: number; locked?: boolean };
type BoardItem = { id: string; columnId: string; title: string }; // a card's order is its order in `items`
type BoardMove = { itemId: string; fromColumnId: string; toColumnId: string; toIndex: number; beforeId: string | null; afterId: string | null };

<Board<T extends BoardItem>
  label: string                                   // the board region's accessible name (required)
  columns: BoardColumn[]
  items: T[]
  renderCard?: (item: T, state: { isDragging: boolean; isOverlay: boolean }) => ReactNode
  onOpen: (item: T) => void                       // the card's one primary action
  onMove: (move: BoardMove) => Promise<void> | void
  canDrag?: (item: T) => boolean
  canDrop?: (item: T, column: BoardColumn) => boolean
  readOnly?: boolean
  columnActions?: (column: BoardColumn) => ReactNode   // MenuItem…; the board renders the labelled trigger
  onAdd?: (column: BoardColumn) => void
  addLabel?: (column: BoardColumn) => string           // default "Add to {column}"
  countLabel?: (count: number) => string               // default "{count} items" (plural forms)
  status?: "loading" | "error" | "empty" | "ready" | "no-permission"
  onRetry?: () => void
  emptyAction?: ReactNode
  noResults?: { onClear: () => void }                  // shown when set and `items` is empty
  labels?: { moveTo?: string }                         // the Move to menu's name, with {title}
  className?: string
/>
```

What the board renders for each card:

- An open button named "Open {title}". It covers the whole card, so a click anywhere on the card opens it.
- A move handle named "Move {title}". It is the only element that starts a keyboard drag.
- A "Move {title} to…" menu: To the top, To the bottom, and a list of the columns.

`renderCard` returns only the card's body, which must not be interactive (badges, dates, avatars). The card never nests interactive elements.

### What the app must do

- **Show the error when a move fails.** If `onMove` rejects (or throws), the board puts the card back and does nothing else. The app shows the toast.
- **Apply the move when it succeeds.** When `onMove` resolves, update `items` (with the change from the server, or locally). The board keeps the move applied until the next `items` arrives, so the card never jumps back in between.
- **Map neighbours in a filtered view.** `toIndex`, `afterId` (the card now just above) and `beforeId` (the card just below) are about the items you passed. When you pass a filtered list, those are filtered neighbours. Map them to absolute positions yourself, for example by inserting after `afterId` in the full list.
- **Pass the real total when you filter.** Give `column.count` the unfiltered number; by default the header counts the cards shown.

Realtime updates can arrive at any time. New `items` during a drag keep the drag: the lifted card keeps its neighbours, and the drop counts the new cards. Items whose `columnId` matches no column are not shown.

### Keyboard map (on a card's move handle)

| Key | Action |
|---|---|
| Space / Enter | Pick up. Pressed again: drop |
| ArrowUp / ArrowDown | One place up or down in the column |
| ArrowRight / ArrowLeft | To the next or previous column, at the same position or the end. In RTL, ArrowLeft goes to the next column. Columns the card can't enter are skipped |
| Escape | Cancel: the card goes back where it was |
| Tab | Drop (dnd-kit default) |

Arrow moves follow the board's own model, not the cards' geometry, so they give the same result at any width and in both directions. dnd-kit's `KeyboardSensor` drives them, through a custom coordinate getter. It replaces `sortableKeyboardCoordinates` (see Deviations).

With a pointer, drag from anywhere on the card after 5 px. With touch, long-press about 250 ms. Dropping outside every column cancels the move.

### Accessibility notes

- dnd-kit announces every step in the current language, with names, never ids:
  - picked up: "Picked up {title}. Column {column}, position {n} of {total}."
  - each move, then the drop or the cancel
- The instructions (strings.ts `boardInstructions`) are the handle's description.
- A move from the menu is announced in the board's own polite live region. Focus then returns to the card's menu button, even after the card changed column.
- After a keyboard drop or a cancel, focus is on the card's handle.
- Each column is a `role="group"` named by its heading. The header count shows a number, and screen readers hear `countLabel` instead.
- A read-only board, or a locked column, shows a lock with a text alternative and a tooltip ("Read-only", "Locked: cards can't be moved in or out").
- States come from EmptyState, ErrorState and NoPermissionState. Loading shows skeleton columns, marked busy.
- In RTL the columns follow the reading direction and the scroller is mirrored. dnd-kit's auto-scroll can't scroll a mirrored container, so the board scrolls itself near its edges.
- Performance: a drag re-renders the columns, but a card's body is memoized. Four keyboard moves re-render at most the moved card's body (checked by the tests).

## CalendarGrid

```ts
type CalendarEvent = { id: string; title: string; start: string /* "YYYY-MM-DD" */; end?: string /* inclusive */; tone?: Tone };

<CalendarGrid<E extends CalendarEvent>
  view?: "month" | "week"            // default month
  month: CalendarDate                // month view: any day of the month; week view: any day of the week
  onMonthChange: (date: CalendarDate) => void   // month view: the new month's first day
  events: E[]
  timeZone: string                   // only decides which day is today
  today?: CalendarDate               // fixed "today" for tests and stories
  onSelectDay?: (date: CalendarDate) => void
  onOpenEvent: (event: E) => void
  renderEvent?: (event: E) => ReactNode
  status?: "loading" | "error" | "ready"
  onRetry?: () => void
  maxPerDay?: number                 // default 3, month view only
  className?: string
/>
```

**Dates and weeks.** Events are date-only and parsed with `parseDate`, so a day never shifts with the time zone. The first day of the week comes from the language's Intl week info, the way React Aria reads it:

- en is en-GB in this library, so its week starts on Monday
- de-CH, fr-CH and it-CH start on Monday
- ar starts on Saturday

**Events.** An event over several days keeps one lane across a week row, so it reads as a bar. Arrows at a row's edge show that it continues into the previous or next week. Every chip is a button named "{title}, {date or range}".

**Busy days.** In month view a day shows `maxPerDay` lanes. Any more events go behind "+N more", a popover that lists every event of the day.

**Narrow widths.** Under 40rem of container width the grid becomes an agenda: days that have events, each event listed once under its first day. It works at 360 px.

### Keyboard map (one tab stop: the focused day)

| Key | Action |
|---|---|
| ArrowRight / ArrowLeft | Next or previous day (mirrored in RTL) |
| ArrowDown / ArrowUp | Same day, next or previous week |
| Home / End | First or last day of the week |
| PageDown / PageUp | Same day, next or previous month |
| Shift+PageDown / Shift+PageUp | Same day, next or previous year |
| Enter / Space | Choose the day (`onSelectDay`) |
| Tab | Into the focused day's events, then out of the grid |

Moving focus outside the shown month calls `onMonthChange`. The grid is `role="grid"` with rows and gridcells. Each day cell is named by its full date, and today has `aria-current="date"`. The title (month, or the week's range) is a polite live region, so the new month is announced. The previous and next buttons are IconButtons with labels.

## Deviations from the brief

1. **Board needs `label`.** The board is a horizontal scroll region, and a region needs a name.
2. **renderCard has no `handleProps`.** The board owns the handle, the open button and the menu, so a card can't lose the handle's label.
3. **Arrow keys don't use `sortableKeyboardCoordinates`.** That getter is geometric, so a cross-column move would depend on the card heights. The board uses a model-based getter instead, still on dnd-kit's `KeyboardSensor`. dnd-kit's own scroll-on-move is kept dormant because it reads RTL scroll positions wrongly; the board scrolls the card into view itself.
4. **Plurals use the library's plural-form objects.** strings.ts already uses objects with zero/one/two/few/many/other forms, so the count does too, not ICU message syntax.
5. **CalendarGrid has a `today` prop.** It keeps baselines stable.
6. **en weeks start on Monday, not Sunday.** The library's en is en-GB.
7. **In week view, `month` is any day of the week and every event shows.** `maxPerDay` applies to month view only.
8. **Both get their RTL and dark variants from the gate.** It renders every story in en/ar × light/dark, plus de and fr, so there are no separate RTL or dark stories.
