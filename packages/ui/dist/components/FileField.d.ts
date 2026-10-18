export type FileFieldProps = {
    label: string;
    value: File[];
    onChange: (files: File[]) => void;
    /** Accepted types, as for <input accept>: "image/*,.pdf". */
    accept?: string;
    /** Largest file allowed, in bytes. */
    maxSize?: number;
    multiple?: boolean;
    /** Most files allowed at once. */
    maxFiles?: number;
    description?: string;
    disabled?: boolean;
    className?: string;
};
/**
 * Choose files by dropping them or with a real file input (a keyboard and screen-reader path,
 * not a click-only drop zone). Refused files are named with the reason, not dropped silently.
 */
export declare function FileField({ label, value, onChange, accept, maxSize, multiple, maxFiles, description, disabled, className }: FileFieldProps): import("react").JSX.Element;
//# sourceMappingURL=FileField.d.ts.map