"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Dates, in their own entry (`@orgtik/ui/dates`): React Aria's calendar (D-009: dates are the one
// place the library uses React Aria) inside the library's Base UI popover, the combination the
// base-ui-rtl spike verified. Apps without date inputs never load React Aria.
//
// Values are ISO dates ("2026-09-30"), the shape the APIs use.
import { useContext } from "react";
import { Popover } from "@base-ui/react/popover";
import { Button as RAButton, Calendar as RACalendar, CalendarStateContext, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, Heading, I18nProvider, RangeCalendar as RARangeCalendar, } from "react-aria-components";
import { parseDate } from "@internationalized/date";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { controlFrame } from "../lib/control.js";
import { floatingPopup } from "../lib/overlay.js";
import { formatLocale } from "../locale.js";
import { useFormatter, useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
const toDate = (v) => {
    if (!v)
        return null;
    try {
        return parseDate(v);
    }
    catch {
        return null;
    }
};
/** The calendar locale: the person's language, the Gregorian calendar, and their digits (D-016). */
function useCalendarLocale() {
    const { locale, digits } = useOrgtik();
    if (locale === "ar")
        return `ar-u-ca-gregory-nu-${digits}`;
    return { en: "en-GB", de: "de-CH", fr: "fr-CH", it: "it-CH" }[locale];
}
const cell = cn("grid size-9 cursor-default place-items-center rounded-pill text-body-sm text-fg outline-hidden tabular-nums transition-colors", "data-[hovered]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-focus", "data-[outside-month]:hidden data-[disabled]:text-fg-subtle data-[disabled]:opacity-50 data-[unavailable]:text-fg-subtle data-[unavailable]:line-through", "data-[selected]:bg-action-primary data-[selected]:text-on-action-primary");
/**
 * Month and year as selects, for dates far from today (a date of birth): the arrows alone mean
 * hundreds of clicks. Native selects: they work with a keyboard, a screen reader and a phone's own
 * picker, and need no popover inside the calendar's popover. Years run from min to max (default:
 * 100 years back, 10 ahead).
 */
function JumpHeader() {
    const state = useContext(CalendarStateContext);
    const t = useStrings();
    const locale = useCalendarLocale();
    if (!state)
        return null;
    const focused = state.focusedDate;
    const minYear = state.minValue?.year ?? focused.year - 100;
    const maxYear = state.maxValue?.year ?? focused.year + 10;
    const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
    const months = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, label: monthName.format(new Date(Date.UTC(2000, i, 1))) }));
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
    const select = cn(controlFrame, "h-8 min-w-0 cursor-pointer px-2 text-body-sm");
    return (_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [_jsx(Heading, { className: "sr-only" }), _jsx("select", { "aria-label": t("month"), className: cn(select, "flex-1"), value: focused.month, onChange: (e) => state.setFocusedDate(focused.set({ month: Number(e.target.value) })), children: months.map((m) => (_jsx("option", { value: m.n, children: m.label }, m.n))) }), _jsx("select", { "aria-label": t("year"), className: cn(select, "tabular-nums"), value: focused.year, onChange: (e) => state.setFocusedDate(focused.set({ year: Number(e.target.value) })), children: years.map((y) => (_jsx("option", { value: y, children: y }, y))) })] }));
}
function MonthHeader() {
    const nav = "grid size-8 place-items-center rounded-pill text-fg-muted outline-hidden hover:bg-hover hover:text-fg data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus data-[disabled]:opacity-40";
    return (
    // A div, not <header>: a header outside a section becomes a page "banner" landmark.
    _jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [_jsx(RAButton, { slot: "previous", className: nav, children: _jsx(CaretLeft, { "aria-hidden": "true", className: "size-4 rtl:-scale-x-100" }) }), _jsx(Heading, { className: "font-display text-title-sm text-fg" }), _jsx(RAButton, { slot: "next", className: nav, children: _jsx(CaretRight, { "aria-hidden": "true", className: "size-4 rtl:-scale-x-100" }) })] }));
}
function Grid({ range = false }) {
    return (_jsxs(CalendarGrid, { className: "border-separate border-spacing-y-0.5", children: [_jsx(CalendarGridHeader, { children: (day) => _jsx(CalendarHeaderCell, { className: "pb-1 text-caption font-semibold text-fg-subtle", children: day }) }), _jsx(CalendarGridBody, { children: (date) => (_jsx(CalendarCell, { date: date, className: cn(cell, range &&
                        "data-[selected]:rounded-none data-[selected]:bg-brand-subtle data-[selected]:text-fg-brand data-[selection-start]:rounded-s-pill data-[selection-start]:bg-action-primary data-[selection-start]:text-on-action-primary data-[selection-end]:rounded-e-pill data-[selection-end]:bg-action-primary data-[selection-end]:text-on-action-primary") })) })] }));
}
const unavailable = (fn) => (fn ? (d) => fn(d.toString().slice(0, 10)) : undefined);
/** A month to pick one date in, on its own (a scheduler) or inside DatePicker. */
export function Calendar({ value, defaultValue, onChange, min, max, isDateUnavailable, label, className, jump = false }) {
    const locale = useCalendarLocale();
    return (_jsx(I18nProvider, { locale: locale, children: _jsxs(RACalendar, { "aria-label": label, value: value === undefined ? undefined : toDate(value), defaultValue: toDate(defaultValue), onChange: (d) => onChange?.(d.toString()), minValue: toDate(min), maxValue: toDate(max), isDateUnavailable: unavailable(isDateUnavailable), className: cn("w-fit", className), children: [jump ? _jsx(JumpHeader, {}) : _jsx(MonthHeader, {}), _jsx(Grid, {})] }) }));
}
/** A month to pick a start and an end in. */
export function RangeCalendar({ value, defaultValue, onChange, min, max, isDateUnavailable, label, className }) {
    const locale = useCalendarLocale();
    const toRange = (r) => (r ? { start: toDate(r.start), end: toDate(r.end) } : r === null ? null : undefined);
    return (_jsx(I18nProvider, { locale: locale, children: _jsxs(RARangeCalendar, { "aria-label": label, value: toRange(value), defaultValue: toRange(defaultValue) ?? undefined, onChange: (r) => onChange?.({ start: r.start.toString(), end: r.end.toString() }), minValue: toDate(min), maxValue: toDate(max), isDateUnavailable: unavailable(isDateUnavailable), className: cn("w-fit", className), children: [_jsx(MonthHeader, {}), _jsx(Grid, { range: true })] }) }));
}
function Trigger({ children, placeholder, size, className, ...props }) {
    return (_jsxs(Popover.Trigger, { ...props, className: cn(controlFrame({ size }), "flex cursor-default items-center justify-between gap-2 ps-3 pe-2 text-start outline-none data-[popup-open]:border-focus", className), children: [_jsx("span", { className: cn("truncate", !children && "text-fg-subtle"), children: children ?? placeholder }), _jsx(CalendarBlank, { "aria-hidden": "true", className: "size-4 shrink-0 text-fg-muted" })] }));
}
function PickerPopup({ children }) {
    return (_jsx(Popover.Portal, { children: _jsx(Popover.Positioner, { side: "bottom", align: "start", sideOffset: 6, className: "z-50 outline-none", children: _jsx(Popover.Popup, { className: cn(floatingPopup, "p-3"), children: children }) }) }));
}
/** One date: a field that shows it in the person's language, and a calendar in a popover. */
export function DatePicker({ value, onChange, placeholder, size, disabled, className, "aria-label": ariaLabel, jump, ...bounds }) {
    const t = useStrings();
    const f = useFormatter();
    return (_jsxs(Popover.Root, { children: [_jsx(Trigger, { placeholder: placeholder ?? t("pickDate"), size: size, disabled: disabled, "aria-label": ariaLabel, className: className, children: value ? f.date(value + "T00:00:00", { dateStyle: "medium" }) : null }), _jsx(PickerPopup, { children: _jsx(Calendar, { value: value, onChange: onChange, label: ariaLabel ?? t("pickDate"), jump: jump, ...bounds }) })] }));
}
/** A start and an end date (a report period, a leave request). */
export function DateRangePicker({ value, onChange, placeholder, size, disabled, className, "aria-label": ariaLabel, ...bounds }) {
    const t = useStrings();
    const f = useFormatter();
    const show = (d) => f.date(d + "T00:00:00", { dateStyle: "medium" });
    return (_jsxs(Popover.Root, { children: [_jsx(Trigger, { placeholder: placeholder ?? t("pickRange"), size: size, disabled: disabled, "aria-label": ariaLabel, className: className, children: value ? `${show(value.start)} – ${show(value.end)}` : null }), _jsx(PickerPopup, { children: _jsx(RangeCalendar, { value: value, onChange: onChange, label: ariaLabel ?? t("pickRange"), ...bounds }) })] }));
}
const pad2 = (n) => String(n).padStart(2, "0");
// The wall-clock date and time of an instant in a time zone (the browser's when none is given).
function wallIn(at, timeZone) {
    if (!timeZone)
        return { date: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`, time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}` };
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
// How far a zone's wall clock is ahead of UTC at an instant, in ms.
function offsetAt(ms, timeZone) {
    const w = wallIn(new Date(ms), timeZone);
    const [y, mo, d] = w.date.split("-").map(Number);
    const [h, mi] = w.time.split(":").map(Number);
    return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(ms / 60000) * 60000;
}
// The instant at which a zone's wall clock shows this date and time. Checked twice, so a date on
// the other side of a daylight-saving change gets that day's offset.
function instantOf(date, time, timeZone) {
    if (!timeZone)
        return new Date(`${date}T${time}:00`).toISOString();
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const first = guess - offsetAt(guess, timeZone);
    return new Date(guess - offsetAt(first, timeZone)).toISOString();
}
function zoneNames(locale, timeZone, at) {
    const pick = (style) => new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
    return { zone: pick("longGeneric"), offset: pick("shortOffset") };
}
/**
 * A date and a time, as one instant. The value is stored as an absolute moment and shown in the
 * person's time zone, or in `timeZone`, which is named under the field: "7 days" stays 7×24 hours
 * wherever they are (the Files audit found a link expiring 3 hours early because local time was
 * read as UTC).
 */
export function DateTimePicker({ value, onChange, min, defaultTime = "09:00", timeZone, dateLabel, timeLabel, size, disabled, className }) {
    const t = useStrings();
    const { locale, digits } = useOrgtik();
    const wall = value ? wallIn(new Date(value), timeZone) : null;
    const date = wall?.date ?? null;
    const time = wall?.time ?? "";
    const combine = (d, tm) => instantOf(d, tm || defaultTime, timeZone);
    const own = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
    const note = timeZone
        ? t("timeZoneNoteNamed", zoneNames(formatLocale(locale, digits), timeZone, value ? new Date(value) : new Date()))
        : own
            ? t("timeZoneNote", { zone: own })
            : null;
    return (_jsxs("div", { className: cn("flex flex-col gap-1.5", className), children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(DatePicker, { value: date, onChange: (d) => onChange(combine(d, time)), min: min ? wallIn(new Date(min), timeZone).date : undefined, size: size, disabled: disabled, "aria-label": dateLabel ?? t("pickDate"), className: "min-w-44 flex-1" }), _jsx("input", { type: "time", "aria-label": timeLabel ?? t("pickTime"), value: time, disabled: disabled || !date, onChange: (e) => date && e.target.value && onChange(combine(date, e.target.value)), className: cn(controlFrame({ size }), "w-32 px-3 tabular-nums") })] }), note ? _jsx("span", { className: "text-caption text-fg-subtle", children: note }) : null] }));
}
// A month or week of days with events (Tasks' calendar, HR leave): see CalendarGrid.tsx.
export { CalendarGrid } from "./CalendarGrid.js";
//# sourceMappingURL=index.js.map