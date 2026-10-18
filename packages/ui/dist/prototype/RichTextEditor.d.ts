export type RichTextFormat = {
    bold: boolean;
    italic: boolean;
    bullets: boolean;
};
export type RichTextEditorProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    contentFormat?: "html" | "text";
    format?: RichTextFormat;
    onFormatChange?: (format: RichTextFormat) => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    maxLength?: number;
    error?: string;
    onBlur?: () => void;
};
export declare function RichTextEditor({ label, value, onChange, contentFormat, format, onFormatChange, placeholder, disabled, rows, maxLength, error, onBlur }: RichTextEditorProps): import("react").JSX.Element;
//# sourceMappingURL=RichTextEditor.d.ts.map