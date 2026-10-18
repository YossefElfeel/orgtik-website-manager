import { type ReactNode } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
export type SwitchProps = Omit<BaseSwitch.Root.Props, "className" | "render" | "children"> & {
    label?: ReactNode;
    description?: ReactNode;
    className?: string;
};
/**
 * An on/off setting that applies at once. For a choice saved with a form's Save button, use a
 * Checkbox instead. The thumb travels toward the reading end, so it mirrors in RTL.
 */
export declare const Switch: import("react").ForwardRefExoticComponent<Omit<SwitchProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=Switch.d.ts.map