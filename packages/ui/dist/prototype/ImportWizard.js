"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Stepper } from "../components/Stepper.js";
/** Shared import progression. Parsing, mapping and row validation belong to the consuming tool. */
export function ImportWizard({ label, stages, step, onStepChange, children }) {
    return _jsxs(_Fragment, { children: [_jsx(Stepper, { label: label, steps: stages.map((name, index) => ({ id: String(index), label: name, state: index === step ? "current" : index < step ? "complete" : "upcoming" })), onStepClick: onStepChange && step < stages.length - 1 ? id => { const index = Number(id); if (index >= 0 && index <= step)
                    onStepChange(index); } : undefined }), children] });
}
//# sourceMappingURL=ImportWizard.js.map