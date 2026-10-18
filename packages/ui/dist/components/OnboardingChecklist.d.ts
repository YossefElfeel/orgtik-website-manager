export type OnboardingStep = {
    id: string;
    title: string;
    description?: string;
    complete: boolean;
    href?: string;
    onSelect?: () => void;
};
export declare function OnboardingChecklist({ steps, title, onDismiss }: {
    steps: OnboardingStep[];
    title?: string;
    onDismiss?: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=OnboardingChecklist.d.ts.map