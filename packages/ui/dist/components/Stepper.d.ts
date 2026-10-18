export type StepState = "complete" | "current" | "upcoming" | "error";
export type Step = {
    id: string;
    label: string;
    description?: string;
    state: StepState;
    optional?: boolean;
};
export type StepperProps = {
    steps: Step[];
    /** Called for a reached step (complete, current or error). The app decides what opening it does. */
    onStepClick?: (id: string) => void;
    /** Why an upcoming step can't be opened yet; shown as its tooltip. */
    lockedHint?: string;
    label: string;
    className?: string;
};
export declare function Stepper({ steps, onStepClick, lockedHint, label, className }: StepperProps): import("react").JSX.Element;
//# sourceMappingURL=Stepper.d.ts.map