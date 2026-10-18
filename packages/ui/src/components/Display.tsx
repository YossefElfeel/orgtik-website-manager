"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";

// Avatar -------------------------------------------------------------------------------------

const avatar = cva("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-pill bg-brand-subtle font-body font-semibold text-fg-brand select-none", {
  variants: { size: { xs: "size-6 text-micro", sm: "size-8 text-caption", md: "size-10 text-body-sm", lg: "size-14 text-title-sm" } },
  defaultVariants: { size: "md" },
});

/**
 * Up to two initials from a name. Arabic letters would join into one shape ("هس"), so they are
 * kept apart with a zero-width non-joiner.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? Array.from(parts[0])[0]! : "";
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1]!)[0]! : "";
  const joiner = /[؀-ۿ]/.test(first + last) ? "‌" : "";
  return (first + (last ? joiner + last : "")).toLocaleUpperCase();
}

export type AvatarProps = VariantProps<typeof avatar> & {
  /** The person's name: the image's alt text and the source of the initials. */
  name: string;
  src?: string | null;
  className?: string;
  /** Hide from assistive tech when the name is already written next to it. */
  decorative?: boolean;
};

export function Avatar({ name, src, size, className, decorative = false }: AvatarProps) {
  return (
    <BaseAvatar.Root className={cn(avatar({ size }), className)} aria-hidden={decorative || undefined} title={decorative ? undefined : name}>
      {src ? <BaseAvatar.Image src={src} alt={decorative ? "" : name} className="size-full object-cover" /> : null}
      <BaseAvatar.Fallback aria-label={decorative ? undefined : name} role={decorative ? undefined : "img"}>
        {/* xs sits in overlapping stacks, where a second letter hides under the next circle. */}
        {size === "xs" ? Array.from(initials(name))[0] : initials(name)}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}

// Card ---------------------------------------------------------------------------------------

const card = cva("rounded-card border border-line bg-raised text-fg", {
  variants: {
    padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
    /** raised lifts a card that floats over other content (e.g. a pinned summary); most cards are flat. */
    elevation: { flat: "", raised: "shadow-raised" },
  },
  defaultVariants: { padding: "md", elevation: "flat" },
});

export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>;

/** A container for one object or one summary. Not a wrapper for every block on a page. */
export function Card({ className, padding, elevation, ...props }: CardProps) {
  return <div className={cn(card({ padding, elevation }), className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-display text-title-sm text-fg">{title}</h3>
        {description ? <p className="text-body-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// Skeleton and Spinner -----------------------------------------------------------------------

/** A placeholder with the shape of the content that is loading. The region should carry aria-busy. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("ot-skeleton rounded-field bg-sunken", className)} {...props} />;
}

const spinner = cva("animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]", {
  variants: { size: { sm: "size-4", md: "size-5", lg: "size-8" } },
  defaultVariants: { size: "md" },
});

/**
 * A busy indicator. With `label` it announces itself (role="status"); without one it's
 * decorative, for use inside something that already says it's busy (a Button's `loading`).
 */
export function Spinner({ size, className, label }: VariantProps<typeof spinner> & { className?: string; label?: string | true }) {
  const t = useStrings();
  const text = label === true ? t("loading") : label;
  const svg = (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(spinner({ size }), "text-fg-brand", className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (!text) return svg;
  return (
    <span role="status" className="inline-flex items-center gap-2 text-body-sm text-fg-muted">
      {svg}
      <span>{text}</span>
    </span>
  );
}
