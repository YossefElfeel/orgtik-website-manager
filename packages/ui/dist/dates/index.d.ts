export type IsoDate = string;
export type DateRange = {
    start: IsoDate;
    end: IsoDate;
};
/** min/max bound the choice; isDateUnavailable greys out single days (holidays, booked days). */
type Bounds = {
    min?: IsoDate;
    max?: IsoDate;
    isDateUnavailable?: (date: IsoDate) => boolean;
};
/** A month to pick one date in, on its own (a scheduler) or inside DatePicker. */
export declare function Calendar({ value, defaultValue, onChange, min, max, isDateUnavailable, label, className, jump }: Bounds & {
    value?: IsoDate | null;
    defaultValue?: IsoDate;
    onChange?: (v: IsoDate) => void;
    label?: string;
    className?: string; /** Month and year selects in the header (dates far from today). */
    jump?: boolean;
}): import("react").JSX.Element;
/** A month to pick a start and an end in. */
export declare function RangeCalendar({ value, defaultValue, onChange, min, max, isDateUnavailable, label, className }: Bounds & {
    value?: DateRange | null;
    defaultValue?: DateRange;
    onChange?: (v: DateRange) => void;
    label?: string;
    className?: string;
}): import("react").JSX.Element;
export type DatePickerProps = Bounds & {
    /** Month and year selects in the calendar (a date of birth, a contract start years back). */
    jump?: boolean;
    value: IsoDate | null;
    onChange: (value: IsoDate) => void;
    placeholder?: string;
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    "aria-label"?: string;
    className?: string;
};
/** One date: a field that shows it in the person's language, and a calendar in a popover. */
export declare function DatePicker({ value, onChange, placeholder, size, disabled, className, "aria-label": ariaLabel, jump, ...bounds }: DatePickerProps): import("react").JSX.Element;
export type DateRangePickerProps = Bounds & {
    value: DateRange | null;
    onChange: (value: DateRange) => void;
    placeholder?: string;
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    "aria-label"?: string;
    className?: string;
};
/** A start and an end date (a report period, a leave request). */
export declare function DateRangePicker({ value, onChange, placeholder, size, disabled, className, "aria-label": ariaLabel, ...bounds }: DateRangePickerProps): import("react").JSX.Element;
/** An instant ("2026-10-08T07:30:00.000Z"), the shape expiries and schedules are stored in. */
export type IsoInstant = string;
export type DateTimePickerProps = {
    /** The stored instant, or null. Shown and edited in `timeZone` (default: the person's own). */
    value: IsoInstant | null;
    onChange: (value: IsoInstant) => void;
    /** The earliest instant allowed (a link can't expire in the past). */
    min?: IsoInstant;
    /** Time used when only a date is picked. */
    defaultTime?: string;
    /**
     * The IANA zone the date and time are read and written in ("Africa/Cairo"), when it isn't the
     * person's own: a post scheduled for a brand's audience, an HR shift at a site. The value stays
     * an instant; the note under the field names the zone.
     */
    timeZone?: string;
    dateLabel?: string;
    timeLabel?: string;
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    className?: string;
};
/**
 * A date and a time, as one instant. The value is stored as an absolute moment and shown in the
 * person's time zone, or in `timeZone`, which is named under the field: "7 days" stays 7×24 hours
 * wherever they are (the Files audit found a link expiring 3 hours early because local time was
 * read as UTC).
 */
export declare function DateTimePicker({ value, onChange, min, defaultTime, timeZone, dateLabel, timeLabel, size, disabled, className }: DateTimePickerProps): import("react").JSX.Element;
export { CalendarGrid, type CalendarGridProps, type CalendarEvent } from "./CalendarGrid.js";
//# sourceMappingURL=index.d.ts.map