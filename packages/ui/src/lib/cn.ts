import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { tokens } from "../tokens.js";

// tailwind-merge has to know the library's own utilities, or it treats `text-body` (a type role)
// and `text-fg` (a colour) as the same group and drops one of them.
const colors = [
  "canvas", "raised", "sunken", "overlay", "chrome", "fg", "fg-muted", "fg-subtle", "fg-brand", "fg-on-chrome", "fg-on-chrome-muted",
  "action-primary", "on-action-primary", "action-brand", "on-action-brand", "focus", "line", "line-strong", "line-control",
  "success", "success-subtle", "success-solid", "on-success-solid", "warning", "warning-subtle", "warning-solid", "on-warning-solid",
  "danger", "danger-subtle", "danger-solid", "on-danger-solid", "info", "info-subtle", "info-solid", "on-info-solid",
  "action-primary-hover", "action-brand-hover", "danger-solid-hover", "hover", "pressed", "scrim", "brand-subtle",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colors,
      radius: Object.keys(tokens.radius),
      text: Object.keys(tokens.type),
      shadow: ["raised", "overlay"],
    },
    classGroups: {
      "font-size": [{ text: Object.keys(tokens.type) }],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts, the later class winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
