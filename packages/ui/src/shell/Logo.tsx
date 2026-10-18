import { useId } from "react";
import { LOGO } from "../brand/logo-data.js";
import { cn } from "../lib/cn.js";

export type LogoProps = {
  /** mark: the symbol alone (rails, favicons); wordmark: the name. */
  variant?: "mark" | "wordmark";
  /** current draws in the text colour; brand gives the mark the colour lockup's gradient. */
  tone?: "current" | "brand";
  /** The accessible name. Pass "" when a visible "OrgTik" label sits next to it. */
  label?: string;
  className?: string;
};

/** The OrgTik logo, from the website's files. It never mirrors in RTL. Server-safe. */
export function Logo({ variant = "mark", tone = "current", label = "OrgTik", className }: LogoProps) {
  const id = useId();
  const art = LOGO[variant];
  const gradient = tone === "brand" && variant === "mark";
  const g = LOGO.gradient;
  return (
    <svg
      viewBox={art.viewBox}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(variant === "mark" ? "h-8 w-auto" : "h-6 w-auto", className)}
      fill={gradient ? `url(#${id})` : "currentColor"}
    >
      {gradient ? (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {g.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      {art.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
