"use client";
import type { ReactNode } from "react";
import { Stepper } from "../components/Stepper.js";

/** Shared import progression. Parsing, mapping and row validation belong to the consuming tool. */
export function ImportWizard({ label, stages, step, onStepChange, children }: { label: string; stages: readonly string[]; step: number; onStepChange?: (step: number) => void; children?: ReactNode }) {
  return <><Stepper label={label} steps={stages.map((name, index) => ({ id: String(index), label: name, state: index === step ? "current" : index < step ? "complete" : "upcoming" }))} onStepClick={onStepChange && step < stages.length - 1 ? id => { const index = Number(id); if (index >= 0 && index <= step) onStepChange(index); } : undefined} />{children}</>;
}
