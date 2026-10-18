import type { ReactNode } from "react";
export type Density = "comfortable" | "compact";
export type ToolbarProps = {
    label: string;
    search?: {
        value: string;
        onChange: (value: string) => void;
        label: string;
        placeholder?: string;
    };
    filters?: ReactNode;
    actions?: ReactNode;
    density?: Density;
    onDensityChange?: (value: Density) => void;
    children?: ReactNode;
    className?: string;
};
export declare function Toolbar({ label, search, filters, actions, density, onDensityChange, children, className }: ToolbarProps): import("react").JSX.Element;
//# sourceMappingURL=Toolbar.d.ts.map