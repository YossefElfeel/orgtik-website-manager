import { cva } from "class-variance-authority";
/**
 * The frame every text-like control shares (Input, Select trigger, later Textarea and the number
 * fields): 8px field radius (D-078), a 3:1 border,
 * the focus ring, and the invalid, disabled and read-only looks.
 */
export const controlFrame = cva([
    "ot-control w-full min-w-0 rounded-field border border-line-control bg-raised text-fg",
    "transition-[border-color,box-shadow] duration-(--ot-duration-fast) ease-ot-out",
    "hover:border-fg-subtle",
    "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-1 has-[input:focus-visible]:outline-focus",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
    "data-[invalid]:border-danger has-[[data-invalid]]:border-danger aria-invalid:border-danger",
    "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
    "has-[input:read-only]:bg-sunken data-[readonly]:bg-sunken",
], {
    variants: {
        size: {
            sm: "h-control-sm text-body-sm",
            md: "h-control-md text-body",
            lg: "h-control-lg text-body-lg",
        },
    },
    defaultVariants: { size: "md" },
});
//# sourceMappingURL=control.js.map