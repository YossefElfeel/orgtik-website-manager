"use client";

// The steps of a wizard (Marketing's campaign wizard, post composer and account connection; HR's
// onboarding). A reached step is a real control and an unreached one says why it can't be opened
// yet; every state is in words, not only colour. Routing and saving are the app's: onStepClick says
// which step was asked for.
import { Fragment } from "react";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu.js";
import { Tooltip } from "./Popover.js";

export type StepState = "complete" | "current" | "upcoming" | "error";
export type Step = { id: string; label: string; description?: string; state: StepState; optional?: boolean };

export type StepperProps = {
  steps: Step[];
  /** Called for a reached step (complete, current or error). The app decides what opening it does. */
  onStepClick?: (id: string) => void;
  /** Why an upcoming step can't be opened yet; shown as its tooltip. */
  lockedHint?: string;
  label: string;
  className?: string;
};

const reached = (s: Step) => s.state !== "upcoming";

export function Stepper({ steps, onStepClick, lockedHint, label, className }: StepperProps) {
  const t = useStrings();
  const total = steps.length;
  const currentIndex = Math.max(0, steps.findIndex((s) => s.state === "current"));
  const current = steps[currentIndex];
  const stateText = (s: Step) => (s.state === "complete" ? t("stepComplete") : s.state === "error" ? t("stepError") : s.state === "current" ? t("stepCurrent") : t("stepUpcoming"));

  return (
    <nav aria-label={label} className={className}>
      {/* Phones: one line and a menu of the steps. */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <p className="min-w-0 text-body text-fg">
          <span className="text-fg-muted">{t("stepOf", { n: currentIndex + 1, total })}</span>
          <span aria-hidden> · </span>
          <span className="font-semibold">{current?.label}</span>
        </p>
        <Menu>
          <MenuTrigger className="shrink-0 rounded-pill px-3 py-1.5 text-body-sm font-semibold text-fg-brand hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus">
            {t("allSteps")}
          </MenuTrigger>
          <MenuContent align="end">
            {steps.map((s, i) => (
              <MenuItem key={s.id} disabled={!reached(s)} onClick={() => reached(s) && onStepClick?.(s.id)}>
                {t("stepOf", { n: i + 1, total })} · {s.label} ({stateText(s)})
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>

      {/* From md up: the whole row. Logical properties, so it mirrors in Arabic. */}
      <ol className="hidden items-start gap-2 md:flex">
        {steps.map((s, i) => {
          const marker = (
            <span
              aria-hidden
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-pill border text-caption font-semibold tabular-nums",
                s.state === "complete" && "border-action-primary bg-action-primary text-on-action-primary",
                s.state === "current" && "border-action-primary bg-brand-subtle text-fg-brand",
                s.state === "upcoming" && "border-line-strong bg-raised text-fg-muted",
                s.state === "error" && "border-danger bg-danger-subtle text-danger",
              )}
            >
              {s.state === "complete" ? <Check weight="bold" /> : s.state === "error" ? <WarningCircle weight="bold" /> : i + 1}
            </span>
          );
          const text = (
            <span className="flex min-w-0 flex-col text-start">
              <span className={cn("truncate text-body-sm", s.state === "current" ? "font-semibold text-fg" : "text-fg-muted", s.state === "error" && "text-danger")}>{s.label}</span>
              {s.optional ? <span className="text-micro text-fg-subtle">{t("stepOptional")}</span> : null}
            </span>
          );
          const sr = <span className="sr-only">{`${t("stepOf", { n: i + 1, total })}, ${stateText(s)}`}</span>;
          const body = reached(s) ? (
            <button
              type="button"
              aria-current={s.state === "current" ? "step" : undefined}
              onClick={() => onStepClick?.(s.id)}
              className="flex min-w-0 items-center gap-2 rounded-field p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              {marker}
              {text}
              {sr}
            </button>
          ) : (
            <Tooltip content={lockedHint ?? t("stepLocked")}>
              <span role="link" aria-disabled="true" tabIndex={0} className="flex min-w-0 cursor-not-allowed items-center gap-2 rounded-field p-1 focus-visible:outline-2 focus-visible:outline-focus">
                {marker}
                {text}
                {sr}
              </span>
            </Tooltip>
          );
          return (
            <Fragment key={s.id}>
              <li className="flex min-w-0 flex-1 items-center gap-2">
                {body}
                {i < total - 1 ? <span aria-hidden className={cn("h-px min-w-4 flex-1", s.state === "complete" ? "bg-action-primary" : "bg-line")} /> : null}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
