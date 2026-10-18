import { type ReactNode } from "react";
import { type CalendarDate } from "@internationalized/date";
import type { Tone } from "../components/Badge.js";
export type CalendarEvent = {
    id: string;
    title: string;
    /** The first day, "YYYY-MM-DD" (date-only: no time, no time zone). */
    start: string;
    /** The last day, inclusive, for an event over several days. */
    end?: string;
    tone?: Tone;
};
export type CalendarGridProps<E extends CalendarEvent> = {
    /** month: the weeks of `month`; week: the week that contains `month`. */
    view?: "month" | "week";
    /** The month shown (any day in it), or in week view any day of the week shown. */
    month: CalendarDate;
    /** Called with the new month's first day (week view: a day of the new week). */
    onMonthChange: (date: CalendarDate) => void;
    events: E[];
    /** The person's time zone (IANA, e.g. "Africa/Cairo"); decides which day is today. */
    timeZone: string;
    /** Today, for tests and stories that need a fixed date. Default: today in `timeZone`. */
    today?: CalendarDate;
    /** Enter, Space or a click on a day. */
    onSelectDay?: (date: CalendarDate) => void;
    onOpenEvent: (event: E) => void;
    /** The chip's content (default: the title). The chip itself stays a button named "{title}, {date}". */
    renderEvent?: (event: E) => ReactNode;
    status?: "loading" | "error" | "ready";
    onRetry?: () => void;
    /** Chips per day in month view; the rest go behind "+N more". Week view shows every event. */
    maxPerDay?: number;
    className?: string;
};
export declare function CalendarGrid<E extends CalendarEvent>({ view, month, onMonthChange, events, timeZone, today: todayProp, onSelectDay, onOpenEvent, renderEvent, status, onRetry, maxPerDay, className, }: CalendarGridProps<E>): import("react").JSX.Element;
//# sourceMappingURL=CalendarGrid.d.ts.map