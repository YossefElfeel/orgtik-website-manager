import { type ReactNode } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
export type CheckboxProps = Omit<BaseCheckbox.Root.Props, "className" | "render" | "children"> & {
    /** The visible label. Leave it out only when the row or column around it names the checkbox, and pass aria-label. */
    label?: ReactNode;
    description?: ReactNode;
    className?: string;
};
export declare const Checkbox: import("react").ForwardRefExoticComponent<Omit<CheckboxProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=Checkbox.d.ts.map