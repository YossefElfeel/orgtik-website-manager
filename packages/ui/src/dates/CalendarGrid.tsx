"use client";
// CalendarGrid: a month or a week of days with events in them (Tasks' calendar view, HR leave,
// Marketing's schedule). Dates come from @internationalized/date (D-009): the first day of the
// week follows the language (en-GB, de-CH, fr-CH, it-CH: Monday; ar: Saturday), and events are
// date-only, so a day never shifts with the time zone. `timeZone` only decides which day is today.
//
// It is an ARIA grid with one tab stop: arrows move a day or a week (mirrored in RTL), Home/End go
// to the week's start and end, PageUp/PageDown change the month (with Shift, the year), and
// Enter or Space chooses the day. Under 40rem of width it becomes an agenda (a list by day).
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  endOfMonth,
  endOfWeek,
  getWeeksInMonth,
  isSameMonth,
  parseDate,
  startOfMonth,
  startOfWeek,
  today as todayIn,
  type CalendarDate,
} from "@internationalized/date";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { formatLocale } from "../locale.js";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import type { Tone } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { Skeleton } from "../components/Display.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/Popover.js";
import { ErrorState } from "../components/States.js";

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

const CHIP: Record<Tone, string> = {
  neutral: "bg-sunken text-fg-muted ring-1 ring-line ring-inset",
  brand: "bg-brand-subtle text-fg-brand",
  info: "bg-info-subtle text-info",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};

type Parsed<E> = { event: E; start: CalendarDate; end: CalendarDate };
/** One event's piece in one week row, in a lane (a line) that it keeps across the row. */
type Segment<E> = Parsed<E> & { first: number; last: number; lane: number };

const iso = (d: CalendarDate) => d.toString();
const same = (a: CalendarDate, b: CalendarDate) => a.compare(b) === 0;

function parse<E extends CalendarEvent>(events: E[]): Parsed<E>[] {
  const out: Parsed<E>[] = [];
  for (const event of events) {
    try {
      const start = parseDate(event.start);
      let end = event.end ? parseDate(event.end) : start;
      if (end.compare(start) < 0) end = start;
      out.push({ event, start, end });
    } catch {
      // A malformed date is skipped rather than breaking the month.
    }
  }
  return out.sort((a, b) => a.start.compare(b.start) || b.end.compare(a.end) || a.event.title.localeCompare(b.event.title));
}

/** Lays one week row out: each event that touches it gets the first lane free on all its days. */
function layoutWeek<E>(events: Parsed<E>[], rowStart: CalendarDate): Segment<E>[] {
  const rowEnd = rowStart.add({ days: 6 });
  const laneEnds: number[] = [];
  const segments: Segment<E>[] = [];
  for (const p of events) {
    if (p.start.compare(rowEnd) > 0 || p.end.compare(rowStart) < 0) continue;
    const first = Math.max(0, p.start.compare(rowStart));
    const last = Math.min(6, p.end.compare(rowStart));
    let lane = laneEnds.findIndex((end) => end < first);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = last;
    segments.push({ ...p, first, last, lane });
  }
  return segments;
}

/** Date formatting in the person's language and digits, on the Gregorian calendar, date-only. */
function useDateText() {
  const { locale, digits } = useOrgtik();
  return useMemo(() => {
    const tag = formatLocale(locale, digits);
    const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { ...options, calendar: "gregory", timeZone: "UTC" });
    const day = make({ day: "numeric" });
    const weekdayShort = make({ weekday: "short" });
    const weekdayLong = make({ weekday: "long" });
    const full = make({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const monthYear = make({ month: "long", year: "numeric" });
    const short = make({ day: "numeric", month: "short", year: "numeric" });
    const at = (d: CalendarDate) => d.toDate("UTC");
    return {
      /** The locale @internationalized/date reads the first day of the week from. */
      weekLocale: tag,
      day: (d: CalendarDate) => day.format(at(d)),
      weekdayShort: (d: CalendarDate) => weekdayShort.format(at(d)),
      weekdayLong: (d: CalendarDate) => weekdayLong.format(at(d)),
      full: (d: CalendarDate) => full.format(at(d)),
      monthYear: (d: CalendarDate) => monthYear.format(at(d)),
      range: (a: CalendarDate, b: CalendarDate) => (same(a, b) ? short.format(at(a)) : short.formatRange(at(a), at(b))),
    };
  }, [locale, digits]);
}

type ChipProps<E extends CalendarEvent> = {
  segment: Parsed<E>;
  label: string;
  tabbable: boolean;
  /** The chip starts this event's piece in the row (it shows the title there). */
  showTitle?: boolean;
  /** The event goes on before this day / after this day (the chip runs into the next cell). */
  before?: boolean;
  after?: boolean;
  /** At a row's start or end: the event continues in the previous or next week. */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  renderEvent?: (event: E) => ReactNode;
  onOpen: (event: E) => void;
};

function Chip<E extends CalendarEvent>({ segment, label, tabbable, showTitle = true, before, after, continuesBefore, continuesAfter, renderEvent, onOpen }: ChipProps<E>) {
  const { event } = segment;
  return (
    <button
      type="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      title={label}
      data-calendar-event={event.id}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      className={cn(
        "relative flex h-6 min-w-0 shrink-0 items-center gap-0.5 rounded-field px-1.5 text-start text-caption font-semibold",
        "hover:brightness-95 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        CHIP[event.tone ?? "brand"],
        before && "-ms-[5px] rounded-s-none",
        after && "-me-[5px] rounded-e-none",
      )}
    >
      {continuesBefore ? <CaretLeft aria-hidden="true" weight="bold" className="size-3 shrink-0 rtl:-scale-x-100" /> : null}
      {showTitle ? <span className="min-w-0 flex-1 truncate" dir="auto">{renderEvent ? renderEvent(event) : event.title}</span> : <span className="flex-1" />}
      {continuesAfter ? <CaretRight aria-hidden="true" weight="bold" className="size-3 shrink-0 rtl:-scale-x-100" /> : null}
    </button>
  );
}

function MoreButton<E extends CalendarEvent>({ count, date, events, tabbable, labelFor, renderEvent, onOpen }: { count: number; date: CalendarDate; events: Parsed<E>[]; tabbable: boolean; labelFor: (p: Parsed<E>) => string; renderEvent?: (event: E) => ReactNode; onOpen: (event: E) => void }) {
  const t = useStrings();
  const text = useDateText();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        tabIndex={tabbable ? 0 : -1}
        onClick={(e) => e.stopPropagation()}
        className="h-6 shrink-0 rounded-field px-1.5 text-start text-caption font-semibold text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      >
        {t("calendarMore", { count })}
      </PopoverTrigger>
      <PopoverContent title={text.full(date)} className="w-72">
        <ul className="flex flex-col gap-1">
          {events.map((p) => (
            <li key={p.event.id} className="flex flex-col">
              <Chip
                segment={p}
                label={labelFor(p)}
                tabbable
                renderEvent={renderEvent}
                onOpen={(event) => {
                  setOpen(false);
                  onOpen(event);
                }}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function GridSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid grid-cols-7 gap-1">
      {Array.from({ length: rows * 7 }, (_, i) => (
        <Skeleton key={i} className={rows === 1 ? "h-64" : "h-24"} />
      ))}
    </div>
  );
}

export function CalendarGrid<E extends CalendarEvent>({
  view = "month",
  month,
  onMonthChange,
  events,
  timeZone,
  today: todayProp,
  onSelectDay,
  onOpenEvent,
  renderEvent,
  status = "ready",
  onRetry,
  maxPerDay = 3,
  className,
}: CalendarGridProps<E>) {
  const t = useStrings();
  const { dir } = useOrgtik();
  const text = useDateText();
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  const wantFocus = useRef(false);
  const weekLocale = text.weekLocale;
  const today = useMemo(() => todayProp ?? todayIn(timeZone), [todayProp, timeZone]);

  // The days shown: whole weeks from the locale's first day of the week.
  const first = view === "week" ? startOfWeek(month, weekLocale) : startOfWeek(startOfMonth(month), weekLocale);
  const weeks = view === "week" ? 1 : getWeeksInMonth(month, weekLocale);
  const rows = useMemo(() => Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => first.add({ days: w * 7 + d }))), [first.toString(), weeks]); // eslint-disable-line react-hooks/exhaustive-deps
  const inView = (d: CalendarDate) => (view === "week" ? d.compare(first) >= 0 && d.compare(first.add({ days: 6 })) <= 0 : isSameMonth(d, month));

  const [focused, setFocused] = useState<CalendarDate>(() => (inView(today) ? today : view === "week" ? month : startOfMonth(month)));
  // A month changed from outside (the header buttons, the app) keeps the focused day's place.
  useEffect(() => {
    if (inView(focused)) return;
    if (view === "week") setFocused(first.add({ days: Math.max(0, focused.compare(startOfWeek(focused, weekLocale))) }));
    else setFocused(startOfMonth(month).set({ day: Math.min(focused.day, endOfMonth(month).day) }));
  }, [month.toString(), view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wantFocus.current) return;
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-date="${iso(focused)}"]`);
    if (cell) {
      wantFocus.current = false;
      cell.focus();
    }
  });

  const parsed = useMemo(() => parse(events), [events]);
  const labelFor = (p: Parsed<E>) => t("calendarEvent", { title: p.event.title, date: text.range(p.start, p.end) });

  const shift = (unit: "days" | "weeks" | "months" | "years", n: number) => (n < 0 ? focused.subtract({ [unit]: -n }) : focused.add({ [unit]: n }));
  const moveTo = (next: CalendarDate) => {
    wantFocus.current = true;
    setFocused(next);
    if (!inView(next)) onMonthChange(view === "week" ? next : startOfMonth(next));
  };
  const step = (n: number) => {
    const next = view === "week" ? month.add({ weeks: n }) : startOfMonth(month).add({ months: n });
    onMonthChange(next);
  };
  const goToday = () => {
    setFocused(today);
    if (!inView(today)) onMonthChange(view === "week" ? today : startOfMonth(today));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
    if (!cell) return;
    const onCell = e.target === cell;
    const forward = dir === "rtl" ? -1 : 1;
    let next: CalendarDate | null = null;
    switch (e.key) {
      case "ArrowRight": next = shift("days", forward); break;
      case "ArrowLeft": next = shift("days", -forward); break;
      case "ArrowDown": next = shift("weeks", 1); break;
      case "ArrowUp": next = shift("weeks", -1); break;
      case "Home": next = startOfWeek(focused, weekLocale); break;
      case "End": next = endOfWeek(focused, weekLocale); break;
      case "PageUp": next = shift(e.shiftKey ? "years" : "months", -1); break;
      case "PageDown": next = shift(e.shiftKey ? "years" : "months", 1); break;
      case "Enter":
      case " ":
        if (!onCell) return;
        e.preventDefault();
        onSelectDay?.(focused);
        return;
      default:
        return;
    }
    e.preventDefault();
    moveTo(next);
  };

  const title = view === "week" ? text.range(first, first.add({ days: 6 })) : text.monthYear(month);
  const tabbableDate = rows.some((r) => r.some((d) => same(d, focused))) ? focused : view === "week" ? first : startOfMonth(month);

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <h2 id={titleId} aria-live="polite" className="me-auto font-display text-title-sm text-fg">{title}</h2>
      {/* Off while today is already on screen: there is nowhere to go (a press would change nothing). */}
      <Button size="sm" variant="secondary" onClick={goToday} disabled={inView(today)}>{t("calendarToday")}</Button>
      <IconButton size="sm" variant="secondary" label={t(view === "week" ? "calendarPreviousWeek" : "calendarPreviousMonth")} icon={<CaretLeft className="rtl:-scale-x-100" />} onClick={() => step(-1)} />
      <IconButton size="sm" variant="secondary" label={t(view === "week" ? "calendarNextWeek" : "calendarNextMonth")} icon={<CaretRight className="rtl:-scale-x-100" />} onClick={() => step(1)} />
    </div>
  );

  if (status === "error") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {header}
        <ErrorState size="compact" onRetry={onRetry} />
      </div>
    );
  }

  const limit = view === "week" ? Infinity : Math.max(1, maxPerDay);
  const rowLayouts = rows.map((row) => layoutWeek(parsed, row[0]!));

  // The agenda: each event once, under its first day in view.
  const rangeStart = view === "week" ? first : startOfMonth(month);
  const rangeEnd = view === "week" ? first.add({ days: 6 }) : endOfMonth(month);
  const agenda = new Map<string, { date: CalendarDate; items: Parsed<E>[] }>();
  for (const p of parsed) {
    if (p.start.compare(rangeEnd) > 0 || p.end.compare(rangeStart) < 0) continue;
    const day = p.start.compare(rangeStart) < 0 ? rangeStart : p.start;
    const key = iso(day);
    if (!agenda.has(key)) agenda.set(key, { date: day, items: [] });
    agenda.get(key)!.items.push(p);
  }
  const agendaDays = [...agenda.values()].sort((a, b) => a.date.compare(b.date));

  return (
    <div className={cn("@container flex min-w-0 flex-col gap-3", className)}>
      {header}
      {status === "loading" ? (
        <GridSkeleton label={t("loading")} rows={weeks} />
      ) : (
        <>
          <table
            ref={gridRef}
            role="grid"
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            className="hidden w-full table-fixed border-collapse @[40rem]:table"
          >
            <thead>
              <tr>
                {rows[0]!.map((d) => (
                  <th key={iso(d)} role="columnheader" scope="col" data-weekday={d.toDate("UTC").getUTCDay()} className="pb-1.5 text-start text-caption font-semibold text-fg-muted">
                    <span aria-hidden="true" className="ps-1.5">{text.weekdayShort(d)}</span>
                    <span className="sr-only">{text.weekdayLong(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, w) => {
                const segments = rowLayouts[w]!;
                return (
                  <tr key={iso(row[0]!)}>
                    {row.map((d, col) => {
                      const mine = segments.filter((s) => s.first <= col && s.last >= col);
                      const lanes: (Segment<E> | undefined)[] = [];
                      for (const s of mine) lanes[s.lane] = s;
                      const shown = lanes.slice(0, limit);
                      const hidden = mine.filter((s) => s.lane >= limit).length;
                      const isToday = same(d, today);
                      const outside = view === "month" && !isSameMonth(d, month);
                      const tabbable = same(d, tabbableDate);
                      return (
                        <td
                          key={iso(d)}
                          role="gridcell"
                          data-date={iso(d)}
                          tabIndex={tabbable ? 0 : -1}
                          aria-label={text.full(d)}
                          aria-current={isToday ? "date" : undefined}
                          onFocus={(e) => {
                            if (e.target === e.currentTarget && !same(d, focused)) setFocused(d);
                          }}
                          onClick={() => {
                            moveTo(d);
                            onSelectDay?.(d);
                          }}
                          className={cn(
                            "border border-line p-1 align-top",
                            view === "week" ? "h-72" : "h-36",
                            outside ? "bg-sunken" : "bg-raised",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                          )}
                        >
                          {/* Chips are 24px tall (WCAG 2.5.8): they sit inside a clickable day, so spacing alone can't pass. */}
                          <div className="flex min-w-0 flex-col gap-1">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "grid size-6 place-items-center rounded-pill text-caption tabular-nums",
                                isToday ? "bg-action-primary font-semibold text-on-action-primary" : outside ? "text-fg-muted" : "text-fg",
                              )}
                            >
                              {text.day(d)}
                            </span>
                            {shown.map((s, lane) =>
                              s ? (
                                <Chip
                                  key={s.event.id}
                                  segment={s}
                                  label={labelFor(s)}
                                  tabbable={tabbable}
                                  showTitle={col === s.first}
                                  before={col > s.first}
                                  after={col < s.last}
                                  continuesBefore={col === s.first && s.first === 0 && s.start.compare(d) < 0}
                                  continuesAfter={col === s.last && s.last === 6 && s.end.compare(d) > 0}
                                  renderEvent={renderEvent}
                                  onOpen={onOpenEvent}
                                />
                              ) : (
                                <span key={`gap-${lane}`} aria-hidden="true" className="h-6 shrink-0" />
                              ),
                            )}
                            {hidden > 0 ? (
                              <MoreButton
                                count={hidden}
                                date={d}
                                events={mine.slice().sort((a, b) => a.lane - b.lane)}
                                tabbable={tabbable}
                                labelFor={labelFor}
                                renderEvent={renderEvent}
                                onOpen={onOpenEvent}
                              />
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="@[40rem]:hidden">
            {agendaDays.length ? (
              <ol className="flex flex-col gap-4">
                {agendaDays.map(({ date, items }) => (
                  <li key={iso(date)} className="flex flex-col gap-1.5">
                    <h3 className={cn("text-label font-semibold", same(date, today) ? "text-fg-brand" : "text-fg")}>
                      {text.full(date)}
                      {same(date, today) ? <span className="ms-2 text-caption font-normal text-fg-muted">{t("calendarToday")}</span> : null}
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {items.map((p) => (
                        <li key={p.event.id} className="flex flex-col">
                          <AgendaItem p={p} label={labelFor(p)} range={same(p.start, p.end) ? null : text.range(p.start, p.end)} renderEvent={renderEvent} onOpen={onOpenEvent} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-body text-fg-muted">{t("calendarNoEvents")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AgendaItem<E extends CalendarEvent>({ p, label, range, renderEvent, onOpen }: { p: Parsed<E>; label: string; range: string | null; renderEvent?: (event: E) => ReactNode; onOpen: (event: E) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onOpen(p.event)}
      className={cn(
        "flex min-h-control-md items-center gap-2 rounded-field px-3 py-2 text-start text-body-sm font-semibold",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        CHIP[p.event.tone ?? "brand"],
      )}
    >
      <span className="min-w-0 flex-1 truncate" dir="auto">{renderEvent ? renderEvent(p.event) : p.event.title}</span>
      {range ? <span className="shrink-0 text-caption font-normal">{range}</span> : null}
    </button>
  );
}
