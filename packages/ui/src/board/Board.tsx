"use client";
// Board: columns of cards you can reorder and move between columns (Tasks' project board; later
// HR and CRM pipelines). Built on dnd-kit, with three ways to move a card that all end in the
// same onMove: drag with a pointer or a long press, the keyboard on the card's move handle, and
// the card's "Move to" menu (WCAG 2.5.7: dragging is never the only way).
//
// The board is controlled: `items` (in their order) say where every card is. A move shows at
// once; the board keeps it as "pending" until onMove settles and puts the card back by itself if
// the promise rejects (the app shows the toast).
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DraggableAttributes,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS as DndCSS, getEventCoordinates } from "@dnd-kit/utilities";
import { ArrowLineDown, ArrowLineUp, ArrowsLeftRight, DotsSixVertical, DotsThree, LockSimple, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useFormatter, useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import type { Tone } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { Skeleton } from "../components/Display.js";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuSeparator, MenuTrigger } from "../components/Menu.js";
import { EmptyState, ErrorState, NoPermissionState } from "../components/States.js";

// Types ----------------------------------------------------------------------------------------

export type BoardColumn = {
  id: string;
  title: string;
  /** The dot before the title: a tone, or any CSS colour (a pipeline stage's own colour). */
  color?: Tone | (string & {});
  /** The number in the header. Defaults to the cards shown; pass the real total when filtered. */
  count?: number;
  /** No card can be moved into or out of a locked column (a closed stage). */
  locked?: boolean;
};

/** A card. Its position is its place in `items` among the items of the same column. */
export type BoardItem = { id: string; columnId: string; title: string };

/**
 * What onMove receives. `toIndex`, `afterId` and `beforeId` are about the items the board was
 * given (in a filtered view, the filtered list): afterId is the card now just above the moved
 * one, beforeId the card just below (null at the top or bottom). An app that passes a filtered
 * list maps these neighbours to absolute positions itself.
 */
export type BoardMove = {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  toIndex: number;
  beforeId: string | null;
  afterId: string | null;
};

export type BoardCardState = {
  /** The card is the one being moved (shown as a placeholder or as lifted). */
  isDragging: boolean;
  /** This render is the copy that follows the pointer. */
  isOverlay: boolean;
};

export type BoardStatus = "loading" | "error" | "empty" | "ready" | "no-permission";

export type BoardProps<T extends BoardItem> = {
  /** The board's accessible name, e.g. "Website relaunch board". */
  label: string;
  columns: BoardColumn[];
  /** Every card, in order. Items whose columnId matches no column are not shown. */
  items: T[];
  /**
   * The card's body under its title: meta, badges, avatars. Not interactive: the board renders
   * the card's one open button (over the whole card), its move handle and its Move to menu.
   */
  renderCard?: (item: T, state: BoardCardState) => ReactNode;
  /** The card's primary action, a real button named "Open {title}". */
  onOpen: (item: T) => void;
  /**
   * Save a move. The board shows it at once; if the promise rejects it puts the card back and
   * does nothing else, so the app shows the error (a toast).
   */
  onMove: (move: BoardMove) => Promise<void> | void;
  canDrag?: (item: T) => boolean;
  canDrop?: (item: T, column: BoardColumn) => boolean;
  /** No handles, no Move to menus, no add buttons; a lock in each column header. */
  readOnly?: boolean;
  /** Menu items for a column (MenuItem…); the board renders the labelled trigger. */
  columnActions?: (column: BoardColumn) => ReactNode;
  /** Adds a labelled + button to each column header (and to an empty column). */
  onAdd?: (column: BoardColumn) => void;
  /** The add button's name. Default "Add to {column}"; Tasks passes "Add task to {column}". */
  addLabel?: (column: BoardColumn) => string;
  /** The count's words for screen readers. Default "{count} items"; Tasks passes "{count} tasks". */
  countLabel?: (count: number) => string;
  status?: BoardStatus;
  onRetry?: () => void;
  /** The way forward on an empty board ("Add the first task"). */
  emptyAction?: ReactNode;
  /** Filters are on and nothing matches: shows "Nothing matches these filters" and a Clear button. */
  noResults?: { onClear: () => void };
  /** Overrides for the library's words. moveTo is the Move to menu's name, with {title}. */
  labels?: { moveTo?: string };
  className?: string;
};

// Layout helpers (pure) -------------------------------------------------------------------------

type Layout = Map<string, string[]>;
type Slot = { columnId: string; index: number; afterId: string | null; beforeId: string | null };

function layoutOf(columns: BoardColumn[], items: BoardItem[]): Layout {
  const layout: Layout = new Map(columns.map((c) => [c.id, []]));
  for (const item of items) layout.get(item.columnId)?.push(item.id);
  return layout;
}

function slotOf(layout: Layout, id: string): Slot | null {
  for (const [columnId, ids] of layout) {
    const index = ids.indexOf(id);
    if (index >= 0) return { columnId, index, afterId: ids[index - 1] ?? null, beforeId: ids[index + 1] ?? null };
  }
  return null;
}

/** A slot in `list` (the target column without the moving card). */
const slotAt = (columnId: string, list: string[], index: number): Slot => ({ columnId, index, afterId: list[index - 1] ?? null, beforeId: list[index] ?? null });

/**
 * Puts a card in a slot. The neighbours win over the index, so a slot taken before a realtime
 * update still lands next to the same cards afterwards.
 */
function place(layout: Layout, id: string, slot: Slot): Layout {
  if (!slotOf(layout, id) || !layout.has(slot.columnId)) return layout;
  const next: Layout = new Map();
  for (const [columnId, ids] of layout) next.set(columnId, ids.filter((x) => x !== id));
  const list = next.get(slot.columnId)!;
  let at: number;
  if (slot.afterId !== null && list.includes(slot.afterId)) at = list.indexOf(slot.afterId) + 1;
  else if (slot.beforeId !== null && list.includes(slot.beforeId)) at = list.indexOf(slot.beforeId);
  else at = Math.max(0, Math.min(slot.index, list.length));
  list.splice(at, 0, id);
  return next;
}

const sameSlot = (a: Slot | null, b: Slot | null) => !!a && !!b && a.columnId === b.columnId && a.index === b.index;

// dnd-kit ids: columns get a prefix so a column and a card can share an id.
const COLUMN = "\u0000column:";
const columnKey = (id: string) => COLUMN + id;

/** Cards don't shift under the pointer: the board moves the card itself, in its own state. */
const noShift: SortingStrategy = () => null;

// Pointer sensors ignore presses on the Move to menu (and on anything in its portal).
const ignorePress = (event: ReactMouseEvent | ReactTouchEvent) => {
  const target = event.nativeEvent.target;
  if (!(target instanceof Element) || !(event.currentTarget as Element).contains(target)) return true;
  return !!target.closest("[data-board-nodrag]");
};
class BoardMouseSensor extends MouseSensor {
  static activators = [
    { eventName: "onMouseDown" as const, handler: (event: ReactMouseEvent, options: Parameters<(typeof MouseSensor.activators)[0]["handler"]>[1]) => !ignorePress(event) && MouseSensor.activators[0]!.handler(event, options) },
  ];
}
class BoardTouchSensor extends TouchSensor {
  static activators = [
    { eventName: "onTouchStart" as const, handler: (event: ReactTouchEvent, options: Parameters<(typeof TouchSensor.activators)[0]["handler"]>[1]) => !ignorePress(event) && TouchSensor.activators[0]!.handler(event, options) },
  ];
}

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  brand: "bg-action-brand",
  info: "bg-info-solid",
  success: "bg-success-solid",
  warning: "bg-warning-solid",
  danger: "bg-danger-solid",
};

// Card -----------------------------------------------------------------------------------------

/** What cards need from the board; stable for the board's lifetime, so cards don't re-render. */
type CardApi = {
  open: (id: string) => void;
  moveVia: (id: string, where: "top" | "bottom" | { columnId: string }) => void;
  slot: (id: string) => Slot | null;
  columnSize: (columnId: string) => number;
  columns: () => BoardColumn[];
  canDropInto: (id: string, columnId: string) => boolean;
  moveToLabel: (title: string) => string;
};
const CardApiContext = createContext<CardApi | null>(null);

type CardBodyProps = {
  item: BoardItem;
  body: ReactNode;
  movable: boolean;
  overlay: boolean;
  handleRef?: (el: HTMLElement | null) => void;
  handleAttributes?: DraggableAttributes;
};

/** The inside of a card. Memoized: a drag re-renders only the cards whose props changed. */
const CardBody = memo(function CardBody({ item, body, movable, overlay, handleRef, handleAttributes }: CardBodyProps) {
  const t = useStrings();
  const api = useContext(CardApiContext)!;
  const handleClass = "relative z-10 mt-px grid size-7 shrink-0 place-items-center rounded-field text-fg-subtle";
  return (
    <div className="flex items-start gap-1 p-2.5 ps-1.5">
      {movable ? (
        overlay ? (
          <span aria-hidden="true" className={handleClass}>
            <DotsSixVertical weight="bold" className="size-4" />
          </span>
        ) : (
          <button
            ref={handleRef}
            type="button"
            {...handleAttributes}
            aria-roledescription={undefined}
            aria-label={t("boardMove", { title: item.title })}
            title={t("boardMove", { title: item.title })}
            data-board-part="handle"
            className={cn(
              handleClass,
              "cursor-grab touch-none hover:bg-hover hover:text-fg active:cursor-grabbing",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
            )}
          >
            <DotsSixVertical aria-hidden="true" weight="bold" className="size-4" />
          </button>
        )
      ) : null}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 py-0.5", !movable && "ps-1.5")}>
        {overlay ? (
          <span className="text-start text-body-sm font-semibold text-fg" dir="auto">{item.title}</span>
        ) : (
          <button
            type="button"
            onClick={() => api.open(item.id)}
            aria-label={t("boardOpen", { title: item.title })}
            data-board-part="open"
            className={cn(
              "text-start text-body-sm font-semibold text-fg focus-visible:outline-0",
              // The button covers the card, so the whole card opens it; the handle and the menu sit above it.
              "after:absolute after:inset-0 after:rounded-card after:content-['']",
              "focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus",
            )}
          >
            <span dir="auto">{item.title}</span>
          </button>
        )}
        {body ? <div className="flex min-w-0 flex-col gap-2 text-body-sm text-fg-muted">{body}</div> : null}
      </div>
      {movable ? (
        overlay ? (
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center text-fg-subtle">
            <DotsThree weight="bold" className="size-4" />
          </span>
        ) : (
          <div className="relative z-10 shrink-0" data-board-nodrag="">
            <MoveMenu item={item} label={api.moveToLabel(item.title)} />
          </div>
        )
      ) : null}
    </div>
  );
});

function MoveMenu({ item, label }: { item: BoardItem; label: string }) {
  return (
    <Menu>
      <MenuTrigger render={<IconButton size="sm" label={label} icon={<DotsThree weight="bold" />} data-board-part="menu" className="size-7" />} />
      <MenuContent align="end">
        <MoveMenuItems item={item} />
      </MenuContent>
    </Menu>
  );
}

/** Rendered only while the menu is open, so it reads the card's place at that moment. */
function MoveMenuItems({ item }: { item: BoardItem }) {
  const t = useStrings();
  const api = useContext(CardApiContext)!;
  const slot = api.slot(item.id);
  if (!slot) return null;
  const last = api.columnSize(slot.columnId) - 1;
  return (
    <>
      <MenuGroup>
        <MenuItem icon={<ArrowLineUp />} disabled={slot.index === 0} onClick={() => api.moveVia(item.id, "top")}>
          {t("boardToTop")}
        </MenuItem>
        <MenuItem icon={<ArrowLineDown />} disabled={slot.index >= last} onClick={() => api.moveVia(item.id, "bottom")}>
          {t("boardToBottom")}
        </MenuItem>
      </MenuGroup>
      <MenuSeparator />
      <MenuGroup label={t("boardToColumn")}>
        {api.columns().map((column) => (
          <MenuItem
            key={column.id}
            icon={<ArrowsLeftRight />}
            disabled={column.id === slot.columnId || !api.canDropInto(item.id, column.id)}
            onClick={() => api.moveVia(item.id, { columnId: column.id })}
          >
            {column.title}
          </MenuItem>
        ))}
      </MenuGroup>
    </>
  );
}

type SortableCardProps = {
  item: BoardItem;
  columnId: string;
  draggable: boolean;
  /** pointer: this card is the placeholder under the overlay; keyboard: it is the lifted card. */
  lifted: "pointer" | "keyboard" | null;
  movable: boolean;
  renderCard?: (item: any, state: BoardCardState) => ReactNode;
};

function SortableCard({ item, columnId, draggable, lifted, movable, renderCard }: SortableCardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: item.id,
    data: { type: "item", columnId },
    disabled: { draggable: !draggable, droppable: false },
  });
  const isDragging = lifted !== null;
  // The body is computed here but only re-rendered by CardBody when its inputs change.
  const body = useMemo(() => renderCard?.(item, { isDragging, isOverlay: false }), [renderCard, item, isDragging]);
  const style: CSSProperties = isDragging ? {} : { transform: DndCSS.Translate.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(draggable ? listeners : {})}
      data-board-item={item.id}
      className={cn(
        "relative rounded-card border border-line bg-raised text-fg",
        "has-[[data-board-part=open]:hover]:border-line-strong",
        lifted === "pointer" && "border-dashed border-line-strong bg-transparent [&>*]:invisible",
        lifted === "keyboard" && "shadow-raised outline-2 outline-offset-2 outline-focus",
      )}
    >
      <CardBody item={item} body={body} movable={movable} overlay={false} handleRef={draggable ? setActivatorNodeRef : undefined} handleAttributes={draggable ? attributes : undefined} />
    </li>
  );
}

// Column ---------------------------------------------------------------------------------------

type ColumnProps = {
  column: BoardColumn;
  ids: string[];
  itemsById: Map<string, BoardItem>;
  drag: DragState | null;
  readOnly: boolean;
  isDraggable: (item: BoardItem) => boolean;
  renderCard?: (item: any, state: BoardCardState) => ReactNode;
  columnActions?: (column: BoardColumn) => ReactNode;
  onAdd?: (column: BoardColumn) => void;
  addLabel: (column: BoardColumn) => string;
  countLabel: (count: number) => string;
};

function Column({ column, ids, itemsById, drag, readOnly, isDraggable, renderCard, columnActions, onAdd, addLabel, countLabel }: ColumnProps) {
  const t = useStrings();
  const f = useFormatter();
  const headingId = useId();
  const { setNodeRef } = useDroppable({ id: columnKey(column.id), data: { type: "column", columnId: column.id } });
  const count = column.count ?? ids.length;
  const tone = column.color && column.color in TONE_DOT ? TONE_DOT[column.color as Tone] : undefined;
  const actions = columnActions?.(column);
  const canAdd = !!onAdd && !readOnly && !column.locked;
  const lockText = readOnly ? t("boardReadOnly") : column.locked ? t("boardLocked") : null;
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-labelledby={headingId}
      data-board-column={column.id}
      className="flex w-72 shrink-0 snap-start flex-col rounded-panel bg-sunken"
    >
      <div className="flex min-h-12 items-center gap-2 ps-3 pe-1.5 pt-1.5">
        <span
          aria-hidden="true"
          className={cn("size-2.5 shrink-0 rounded-pill", tone ?? (column.color ? "" : "bg-fg-subtle"))}
          style={column.color && !tone ? { backgroundColor: column.color } : undefined}
        />
        <h3 id={headingId} className="min-w-0 truncate text-label font-semibold text-fg" dir="auto">
          {column.title}
        </h3>
        <span aria-hidden="true" className="text-caption text-fg-muted tabular-nums">{f.number(count)}</span>
        <span className="sr-only">{countLabel(count)}</span>
        {lockText ? (
          <span role="img" aria-label={lockText} title={lockText} className="grid size-5 shrink-0 place-items-center text-fg-subtle">
            <LockSimple aria-hidden="true" className="size-3.5" />
          </span>
        ) : null}
        <div className="ms-auto flex shrink-0 items-center">
          {actions ? (
            <Menu>
              <MenuTrigger render={<IconButton size="sm" label={t("boardColumnActions", { column: column.title })} icon={<DotsThree weight="bold" />} />} />
              <MenuContent align="end">{actions}</MenuContent>
            </Menu>
          ) : null}
          {canAdd ? <IconButton size="sm" label={addLabel(column)} icon={<Plus />} onClick={() => onAdd!(column)} /> : null}
        </div>
      </div>
      <SortableContext id={column.id} items={ids} strategy={noShift}>
        <ul className={cn("flex flex-col gap-2 px-2 pb-2", ids.length ? "pt-1" : "")}>
          {ids.map((id) => {
            const item = itemsById.get(id)!;
            const lifted = drag && drag.id === id ? drag.mode : null;
            return (
              <SortableCard
                key={id}
                item={item}
                columnId={column.id}
                draggable={!readOnly && isDraggable(item)}
                movable={!readOnly && isDraggable(item)}
                lifted={lifted}
                renderCard={renderCard}
              />
            );
          })}
        </ul>
      </SortableContext>
      {ids.length === 0 ? (
        <div className="mx-2 mb-2 flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-3 py-4 text-center">
          <p className="text-body-sm text-fg-muted">{t("boardEmptyColumn")}</p>
          {canAdd ? (
            <Button size="sm" variant="ghost" startIcon={<Plus />} onClick={() => onAdd!(column)}>
              {addLabel(column)}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BoardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex gap-4 overflow-hidden">
      {[3, 2, 1].map((cards, i) => (
        <div key={i} className="flex w-72 shrink-0 flex-col gap-2 rounded-panel bg-sunken p-2">
          <div className="flex h-10 items-center gap-2 px-1">
            <Skeleton className="size-2.5 rounded-pill bg-line" />
            <Skeleton className="h-3 w-24 bg-line" />
          </div>
          {Array.from({ length: cards }, (_, j) => (
            <div key={j} className="flex flex-col gap-2 rounded-card border border-line bg-raised p-3">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Board ----------------------------------------------------------------------------------------

type DragState = { id: string; mode: "pointer" | "keyboard"; origin: Slot; target: Slot };
type Pending = { key: number; itemId: string; slot: Slot; settled: boolean };

const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function Board<T extends BoardItem>({
  label,
  columns,
  items,
  renderCard,
  onOpen,
  onMove,
  canDrag,
  canDrop,
  readOnly = false,
  columnActions,
  onAdd,
  addLabel,
  countLabel,
  status = "ready",
  onRetry,
  emptyAction,
  noResults,
  labels,
  className,
}: BoardProps<T>) {
  const t = useStrings();
  const { dir } = useOrgtik();

  // Where cards are: the props, then the moves still being saved, then the drag preview.
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDragState] = useState<DragState | null>(null);
  const base = useMemo(() => layoutOf(columns, items), [columns, items]);
  const settled = useMemo(() => pending.reduce((layout, p) => place(layout, p.itemId, p.slot), base), [base, pending]);
  const display = useMemo(() => (drag ? place(settled, drag.id, drag.target) : settled), [settled, drag]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i as BoardItem])), [items]);
  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  // A move that was saved stays applied until the app's next `items` (which then has it).
  useEffect(() => {
    setPending((list) => (list.some((p) => p.settled) ? list.filter((p) => !p.settled) : list));
  }, [items]);

  // The sensors, the announcements and the cards read the latest values through refs, so their
  // callbacks stay stable and a drag never re-renders every card.
  const latest = useRef({ settled, display, itemsById, columnsById, columns, dir, drag, readOnly, canDrag, canDrop, onMove, onOpen, t, labels });
  latest.current = { settled, display, itemsById, columnsById, columns, dir, drag, readOnly, canDrag, canDrop, onMove, onOpen, t, labels };
  const dragRef = useRef<DragState | null>(null);
  const setDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [a11yContainer, setA11yContainer] = useState<HTMLElement | null>(null);
  const [live, setLive] = useState("");
  const focusAfter = useRef<{ id: string; part: "handle" | "menu" } | null>(null);
  const announced = useRef<string>("");
  const endText = useRef<string | undefined>(undefined);
  const flip = useRef(false);
  const seq = useRef(0);

  const isDraggable = useCallback(
    (item: BoardItem) => {
      const { readOnly, canDrag, columnsById } = latest.current;
      return !readOnly && !columnsById.get(item.columnId)?.locked && (canDrag ? canDrag(item as T) : true);
    },
    [],
  );
  const canDropInto = useCallback((id: string, columnId: string) => {
    const { readOnly, canDrop, columnsById, itemsById } = latest.current;
    const column = columnsById.get(columnId);
    const item = itemsById.get(id);
    if (readOnly || !column || !item || column.locked) return false;
    return canDrop ? canDrop(item as T, column) : true;
  }, []);

  const describe = useCallback((key: "boardPickedUp" | "boardMovedTo" | "boardDropped" | "boardCancelled", id: string, layout: Layout) => {
    const { itemsById, columnsById, t } = latest.current;
    const slot = slotOf(layout, id);
    const item = itemsById.get(id);
    const column = slot ? columnsById.get(slot.columnId) : undefined;
    if (!slot || !item || !column) return undefined;
    return t(key, { title: item.title, column: column.title, position: slot.index + 1, total: layout.get(slot.columnId)!.length });
  }, []);

  /** Saves a move: applies it now, calls onMove, and takes it back if onMove rejects. */
  const commit = useCallback((id: string, slot: Slot, origin: Slot): Layout | null => {
    const final = place(latest.current.settled, id, slot);
    const s = slotOf(final, id);
    if (!s || sameSlot(s, origin)) return null;
    const move: BoardMove = { itemId: id, fromColumnId: origin.columnId, toColumnId: s.columnId, toIndex: s.index, beforeId: s.beforeId, afterId: s.afterId };
    const key = ++seq.current;
    setPending((list) => [...list, { key, itemId: id, slot: s, settled: false }]);
    let saving: Promise<void>;
    try {
      saving = Promise.resolve(latest.current.onMove(move));
    } catch (error) {
      saving = Promise.reject(error);
    }
    saving.then(
      () => setPending((list) => list.map((p) => (p.key === key ? { ...p, settled: true } : p))),
      () => setPending((list) => list.filter((p) => p.key !== key)),
    );
    return final;
  }, []);

  const api = useMemo<CardApi>(
    () => ({
      open: (id) => {
        const item = latest.current.itemsById.get(id);
        if (item) latest.current.onOpen(item as T);
      },
      slot: (id) => slotOf(latest.current.settled, id),
      columnSize: (columnId) => latest.current.settled.get(columnId)?.length ?? 0,
      columns: () => latest.current.columns,
      canDropInto,
      moveToLabel: (title) => {
        const template = latest.current.labels?.moveTo;
        return template ? template.replace("{title}", title) : latest.current.t("boardMoveTo", { title });
      },
      moveVia: (id, where) => {
        const layout = latest.current.settled;
        const origin = slotOf(layout, id);
        if (!origin) return;
        const columnId = typeof where === "string" ? origin.columnId : where.columnId;
        if (columnId !== origin.columnId && !canDropInto(id, columnId)) return;
        const list = (layout.get(columnId) ?? []).filter((x) => x !== id);
        const index = where === "top" ? 0 : list.length;
        const final = commit(id, slotAt(columnId, list, index), origin);
        if (!final) return;
        focusAfter.current = { id, part: "menu" };
        const text = describe("boardMovedTo", id, final) ?? "";
        setLive((prev) => (prev === text ? text + "​" : text));
      },
    }),
    [canDropInto, commit, describe],
  );

  // Focus follows a card that moved (a card that changes column is a new element).
  useEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    const frame = requestAnimationFrame(() => {
      focusAfter.current = null;
      const card = rootRef.current?.querySelector<HTMLElement>(`[data-board-item="${globalThis.CSS.escape(want.id)}"]`);
      card?.querySelector<HTMLElement>(`[data-board-part="${want.part}"]`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  });

  // Keyboard: arrows move the card by the board's own model, not by geometry, so the result is
  // the same at any width and in both directions. ArrowLeft/ArrowRight go to the column before or
  // after in reading order: in RTL, ArrowLeft is the next column.
  const keyboardCoordinates = useCallback<KeyboardCoordinateGetter>((event, { currentCoordinates }) => {
    const d = dragRef.current;
    if (!d || !ARROWS.includes(event.code)) return undefined;
    event.preventDefault();
    const { display, settled, columns, dir } = latest.current;
    const current = slotOf(display, d.id);
    if (!current) return undefined;
    let next: { columnId: string; index: number } | null = null;
    if (event.code === "ArrowUp") {
      if (current.index > 0) next = { columnId: current.columnId, index: current.index - 1 };
    } else if (event.code === "ArrowDown") {
      if (current.index < display.get(current.columnId)!.length - 1) next = { columnId: current.columnId, index: current.index + 1 };
    } else {
      const forward = (event.code === "ArrowRight") === (dir === "ltr");
      const step = forward ? 1 : -1;
      for (let i = columns.findIndex((c) => c.id === current.columnId) + step; i >= 0 && i < columns.length; i += step) {
        const column = columns[i]!;
        if (!canDropInto(d.id, column.id)) continue;
        const size = (settled.get(column.id) ?? []).filter((x) => x !== d.id).length;
        next = { columnId: column.id, index: Math.min(current.index, size) };
        break;
      }
    }
    if (!next) return undefined;
    const list = (settled.get(next.columnId) ?? []).filter((x) => x !== d.id);
    setDrag({ ...d, target: slotAt(next.columnId, list, next.index) });
    focusAfter.current = { id: d.id, part: "handle" };
    // The returned point only has to change (that is what makes dnd-kit announce the move). It is
    // kept at the centre of the scroll containers so dnd-kit's own keyboard scrolling, which reads
    // RTL scroll positions wrongly, never starts; the board scrolls the card into view itself.
    flip.current = !flip.current;
    const box = scrollerRef.current?.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 : currentCoordinates.x;
    const y = window.innerHeight / 2;
    return event.code === "ArrowUp" || event.code === "ArrowDown" ? { x: x + (flip.current ? 1 : 0), y } : { x, y: y + (flip.current ? 1 : 0) };
  }, [canDropInto, setDrag]);

  const sensors = useSensors(
    useSensor(BoardMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(BoardTouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  // Pointer: the column under the pointer, then the closest card in it.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const d = dragRef.current;
      if (!d) return [];
      if (d.mode === "keyboard") return [{ id: columnKey(d.target.columnId) }];
      const columnTargets = args.droppableContainers.filter((c) => c.data.current?.type === "column" && canDropInto(d.id, c.data.current.columnId));
      let hits = pointerWithin({ ...args, droppableContainers: columnTargets });
      if (!hits.length) hits = rectIntersection({ ...args, droppableContainers: columnTargets });
      const hit = hits[0] && columnTargets.find((c) => c.id === hits[0]!.id);
      if (!hit) return [];
      const columnId = hit.data.current!.columnId as string;
      const cards = args.droppableContainers.filter((c) => c.data.current?.type === "item" && c.data.current.columnId === columnId && c.id !== d.id);
      return cards.length ? closestCenter({ ...args, droppableContainers: cards }) : [{ id: hit.id }];
    },
    [canDropInto],
  );

  // RTL: dnd-kit's auto-scroll can't scroll a mirrored container toward its end, so near the
  // board's edges the board scrolls itself.
  const edge = useRef<{ dir: number; timer: number | null }>({ dir: 0, timer: null });
  const edgeScroll = useCallback((clientX: number | null) => {
    const el = scrollerRef.current;
    let want = 0;
    if (el && clientX !== null) {
      const box = el.getBoundingClientRect();
      const zone = Math.min(64, box.width / 6);
      want = clientX < box.left + zone ? -1 : clientX > box.right - zone ? 1 : 0;
    }
    if (want === edge.current.dir) return;
    if (edge.current.timer !== null) window.clearInterval(edge.current.timer);
    edge.current = { dir: want, timer: want && el ? window.setInterval(() => el.scrollBy({ left: want * 14 }), 16) : null };
  }, []);
  useEffect(() => () => edgeScroll(null), [edgeScroll]);

  const onDragStart = useCallback(({ active, activatorEvent }: DragStartEvent) => {
    const id = String(active.id);
    const origin = slotOf(latest.current.settled, id);
    if (!origin) return;
    const mode = typeof KeyboardEvent !== "undefined" && activatorEvent instanceof KeyboardEvent ? "keyboard" : "pointer";
    announced.current = `${origin.columnId}:${origin.index}`;
    endText.current = undefined;
    setDrag({ id, mode, origin, target: origin });
  }, [setDrag]);

  const onDragMove = useCallback(({ active, over, activatorEvent, delta }: DragMoveEvent) => {
    const d = dragRef.current;
    if (!d || d.mode === "keyboard") return;
    if (latest.current.dir === "rtl") {
      const start = getEventCoordinates(activatorEvent);
      edgeScroll(start ? start.x + delta.x : null);
    }
    if (!over) return;
    const data = over.data.current as { type: "item" | "column"; columnId: string } | undefined;
    if (!data || !canDropInto(d.id, data.columnId)) return;
    const list = (latest.current.settled.get(data.columnId) ?? []).filter((x) => x !== d.id);
    let index = list.length;
    if (data.type === "item") {
      const overIndex = list.indexOf(String(over.id));
      if (overIndex < 0) return;
      const r = active.rect.current.translated;
      const below = r ? r.top + r.height / 2 > over.rect.top + over.rect.height / 2 : false;
      index = overIndex + (below ? 1 : 0);
    }
    const target = slotAt(data.columnId, list, index);
    if (!sameSlot(target, slotOf(latest.current.display, d.id))) setDrag({ ...d, target });
  }, [canDropInto, edgeScroll, setDrag]);

  const onDragEnd = useCallback(({ over }: DragEndEvent) => {
    edgeScroll(null);
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (d.mode === "pointer" && !over) {
      endText.current = describe("boardCancelled", d.id, latest.current.settled);
      return;
    }
    const final = commit(d.id, d.target, d.origin);
    endText.current = describe("boardDropped", d.id, final ?? latest.current.settled);
    if (d.mode === "keyboard") focusAfter.current = { id: d.id, part: "handle" };
  }, [commit, describe, edgeScroll, setDrag]);

  const onDragCancel = useCallback(() => {
    edgeScroll(null);
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    endText.current = describe("boardCancelled", d.id, latest.current.settled);
    if (d.mode === "keyboard") focusAfter.current = { id: d.id, part: "handle" };
  }, [describe, edgeScroll, setDrag]);

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => describe("boardPickedUp", String(active.id), latest.current.settled),
      onDragMove: () => {
        const d = dragRef.current;
        if (!d) return undefined;
        const layout = place(latest.current.settled, d.id, d.target);
        const slot = slotOf(layout, d.id);
        const key = slot ? `${slot.columnId}:${slot.index}` : "";
        if (!slot || key === announced.current) return undefined;
        announced.current = key;
        return describe("boardMovedTo", d.id, layout);
      },
      onDragOver: () => undefined,
      onDragEnd: () => endText.current,
      onDragCancel: () => endText.current,
    }),
    [describe],
  );
  const screenReaderInstructions = useMemo(() => ({ draggable: t("boardInstructions") }), [t]);
  const addName = useCallback((column: BoardColumn) => (addLabel ? addLabel(column) : t("boardAddTo", { column: column.title })), [addLabel, t]);
  const countName = useCallback((count: number) => (countLabel ? countLabel(count) : t("boardItems", { count })), [countLabel, t]);

  if (status === "loading") return <div className={className}><BoardSkeleton label={t("loading")} /></div>;
  if (status === "error") return <ErrorState className={className} onRetry={onRetry} />;
  if (status === "no-permission") return <NoPermissionState className={className} />;
  if (status === "empty") return <EmptyState className={className} action={emptyAction} />;
  if (noResults && items.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={<MagnifyingGlass />}
        title={t("boardNoResults")}
        action={<Button variant="secondary" onClick={noResults.onClear}>{t("boardClearFilters")}</Button>}
      />
    );
  }

  const activeItem = drag ? itemsById.get(drag.id) : undefined;
  return (
    <div ref={rootRef} className={cn("min-w-0", className)}>
      <CardApiContext.Provider value={api}>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          autoScroll={{ canScroll: (el) => !(latest.current.dir === "rtl" && el === scrollerRef.current) }}
          accessibility={{ announcements, screenReaderInstructions, container: a11yContainer ?? undefined }}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div
            ref={scrollerRef}
            role="region"
            aria-label={label}
            data-dragging={drag ? "" : undefined}
            className="relative flex items-start gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-proximity data-[dragging]:snap-none"
          >
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                ids={display.get(column.id) ?? []}
                itemsById={itemsById}
                drag={drag}
                readOnly={readOnly}
                isDraggable={isDraggable}
                renderCard={renderCard as SortableCardProps["renderCard"]}
                columnActions={columnActions}
                onAdd={onAdd}
                addLabel={addName}
                countLabel={countName}
              />
            ))}
          </div>
          <DragOverlay>
            {drag?.mode === "pointer" && activeItem ? (
              <div aria-hidden="true" className="relative cursor-grabbing rounded-card border border-line bg-raised text-fg shadow-overlay">
                <CardBody item={activeItem} body={renderCard?.(activeItem as T, { isDragging: true, isOverlay: true })} movable overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardApiContext.Provider>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{live}</div>
      <div ref={setA11yContainer} />
    </div>
  );
}
