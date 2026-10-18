"use client";
import type { ReactNode } from "react";
import { ArrowClockwise, LockSimple, Tray, WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Button } from "./Button.js";
import { Skeleton } from "./Display.js";

// Every list and page has these states (audit code MS). Each one says what happened and offers
// the next step, so none of them is a dead end.

type StateProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** The way forward: "Upload a file", "Ask for access". An empty state without one is a dead end. */
  action?: ReactNode;
  icon?: ReactNode;
  /** compact fits inside a card or table; page fills the content area. */
  size?: "compact" | "page";
  /**
   * The title's element. A state inside a page is a paragraph under the page's own heading (the
   * default); a state that IS the page (404, no access, a crash) passes "h1", so the page has one.
   */
  titleAs?: "p" | "h1" | "h2" | "h3";
  className?: string;
};

function StateFrame({ icon, title, description, action, size = "page", titleAs: Title = "p", tone = "neutral", className, role }: StateProps & { tone?: "neutral" | "danger"; role?: string }) {
  return (
    <div role={role} className={cn("mx-auto flex max-w-md flex-col items-center gap-3 text-center", size === "page" ? "py-16" : "py-8", className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "grid place-items-center rounded-pill [&_svg]:size-[55%]",
            size === "page" ? "size-14" : "size-10",
            tone === "danger" ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-fg-brand",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        {title ? <Title className={cn("font-display text-fg", size === "page" ? "text-title" : "text-title-sm")}>{title}</Title> : null}
        {description ? <p className="text-body text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = <Tray />, title, ...props }: StateProps) {
  const t = useStrings();
  return <StateFrame icon={icon} title={title ?? t("emptyTitle")} {...props} />;
}

export function ErrorState({
  icon = <WarningCircle />,
  title,
  description,
  onRetry,
  action,
  ...props
}: StateProps & { onRetry?: () => void }) {
  const t = useStrings();
  return (
    <StateFrame
      role="alert"
      tone="danger"
      icon={icon}
      title={title ?? t("errorTitle")}
      description={description ?? t("errorBody")}
      action={
        action ??
        (onRetry ? (
          <Button variant="secondary" startIcon={<ArrowClockwise />} onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null)
      }
      {...props}
    />
  );
}

export function NoPermissionState({ icon = <LockSimple />, title, description, ...props }: StateProps) {
  const t = useStrings();
  return <StateFrame icon={icon} title={title ?? t("noPermissionTitle")} description={description ?? t("noPermissionBody")} {...props} />;
}

/** Placeholder rows in the shape of a list. The region is marked busy for assistive tech. */
export function LoadingState({ rows = 5, className, label }: { rows?: number; className?: string; label?: string }) {
  const t = useStrings();
  return (
    <div role="status" aria-busy="true" aria-label={label ?? t("loading")} className={cn("flex flex-col gap-3 py-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-pill" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type ListStatus = "loading" | "error" | "forbidden" | "empty" | "ready";

/**
 * Picks the right state for a list, so a screen can't forget one:
 *   <ListStates status={status} empty={{ title: "No files yet", action: <UploadButton /> }} onRetry={refetch}>
 *     <FileTable … />
 *   </ListStates>
 * `status` comes from the query: loading before the first answer, error on failure, forbidden on
 * 403, empty when the answer has no rows (and no filter is on; filtered-empty passes its own copy).
 */
export function ListStates({
  status,
  children,
  empty,
  error,
  forbidden,
  onRetry,
  loadingRows,
  size = "page",
}: {
  status: ListStatus;
  children: ReactNode;
  empty: StateProps;
  error?: StateProps;
  forbidden?: StateProps;
  onRetry?: () => void;
  loadingRows?: number;
  size?: StateProps["size"];
}) {
  switch (status) {
    case "loading":
      return <LoadingState rows={loadingRows} />;
    case "error":
      return <ErrorState size={size} onRetry={onRetry} {...error} />;
    case "forbidden":
      return <NoPermissionState size={size} {...forbidden} />;
    case "empty":
      return <EmptyState size={size} {...empty} />;
    default:
      return <>{children}</>;
  }
}
