import { type ReactNode } from "react";
import type { Tone } from "../components/Badge.js";
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
export type BoardItem = {
    id: string;
    columnId: string;
    title: string;
};
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
    noResults?: {
        onClear: () => void;
    };
    /** Overrides for the library's words. moveTo is the Move to menu's name, with {title}. */
    labels?: {
        moveTo?: string;
    };
    className?: string;
};
export declare function Board<T extends BoardItem>({ label, columns, items, renderCard, onOpen, onMove, canDrag, canDrop, readOnly, columnActions, onAdd, addLabel, countLabel, status, onRetry, emptyAction, noResults, labels, className, }: BoardProps<T>): import("react").JSX.Element;
//# sourceMappingURL=Board.d.ts.map