import { type ReactNode } from "react";
import type { Locale } from "../locale.js";
import type { DemoRuntime } from "./connections.js";
import type { Digits } from "../locale.js";
export declare const DEMO_PERSONAS: readonly ["current", "mona", "nour", "rana", "omar", "salma", "hoda", "hany"];
export declare const DEMO_WORKSPACES: readonly ["current", "orgtik", "nile", "spree", "desert", "new"];
export declare const DEMO_STATES: readonly ["normal", "loading", "empty", "error", "noAccess", "readOnly", "success"];
export declare const DEMO_SCENARIOS: readonly ["none", "renewal", "grace", "expiredGrace", "overdue"];
export type DemoScene = {
    persona: typeof DEMO_PERSONAS[number];
    workspace: typeof DEMO_WORKSPACES[number];
    state: typeof DEMO_STATES[number];
    scenario: typeof DEMO_SCENARIOS[number];
};
export type DemoOptions = {
    enabled: boolean;
    appKey: string;
    onLocaleChange?: (locale: Locale) => void;
    runtime?: DemoRuntime;
};
export type DemoPreferences = {
    digits: Digits;
    timeZone: string;
};
type DemoContextValue = {
    enabled: boolean;
    appKey: string;
    runtime?: DemoRuntime;
    preferences: DemoPreferences;
    updatePreferences: (patch: Partial<DemoPreferences>) => void;
    scene: DemoScene;
    update: (patch: Partial<DemoScene>) => void;
    reset: () => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    onLocaleChange?: (locale: Locale) => void;
};
export declare const useDemoScene: () => DemoContextValue;
export declare function DemoProvider({ options, children }: {
    options?: DemoOptions;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function SimulatedTag(): import("react").JSX.Element;
export declare function DemoPanel(): import("react").JSX.Element | null;
export declare function DemoSceneBanner(): import("react").JSX.Element | null;
export declare function DemoStateView({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=DemoPanel.d.ts.map