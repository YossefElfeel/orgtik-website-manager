// Shared looks for floating surfaces. Base UI sets data-starting-style / data-ending-style for one
// frame on enter and exit, so these are plain CSS transitions (1ms under reduced motion).

/** Menus, popovers and select lists: a small raised card that grows from its anchor. */
export const floatingPopup = [
  "rounded-overlay border border-line bg-overlay text-fg shadow-overlay outline-none",
  "origin-(--transform-origin) transition-[opacity,scale] duration-(--ot-duration-fast) ease-ot-out",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
].join(" ");

/** The dimmed layer behind a modal dialog or sheet. */
export const scrim = [
  "fixed inset-0 z-50 bg-scrim",
  "transition-opacity duration-(--ot-duration-base) ease-ot-out",
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
].join(" ");

/** One row in a menu or list. */
export const listItem = [
  "flex min-h-control-sm cursor-default items-center gap-2 rounded-field px-2 text-body text-fg outline-none select-none",
  "data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
].join(" ");
