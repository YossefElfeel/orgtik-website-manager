import type { ReactNode } from "react";
/** Shared import progression. Parsing, mapping and row validation belong to the consuming tool. */
export declare function ImportWizard({ label, stages, step, onStepChange, children }: {
    label: string;
    stages: readonly string[];
    step: number;
    onStepChange?: (step: number) => void;
    children?: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=ImportWizard.d.ts.map