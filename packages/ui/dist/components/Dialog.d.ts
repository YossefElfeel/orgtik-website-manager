import type { HTMLAttributes, ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type VariantProps } from "class-variance-authority";
export declare const Dialog: <Payload>(props: BaseDialog.Root.Props<Payload>) => React.JSX.Element;
/** Opens the dialog. Pass your button through `render`: <DialogTrigger render={<Button />}>Edit</DialogTrigger> */
export declare const DialogTrigger: BaseDialog.Trigger;
export declare const DialogClose: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").AlertDialogCloseProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
declare const dialogPopup: (props?: ({
    size?: "sm" | "md" | "lg" | "xl" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export type DialogContentProps = Omit<BaseDialog.Popup.Props, "className" | "render"> & VariantProps<typeof dialogPopup> & {
    className?: string;
    /** Hide the corner close button, e.g. when the footer has the only way out on purpose. */
    hideClose?: boolean;
};
export declare function DialogContent({ className, size, hideClose, children, ...props }: DialogContentProps): import("react").JSX.Element;
export declare function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
/** The scrolling middle. Header and footer stay put. */
export declare function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
/** Actions, at the reading end. The primary action goes last. */
export declare function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function DialogTitle({ className, ...props }: Omit<BaseDialog.Title.Props, "className"> & {
    className?: string;
}): import("react").JSX.Element;
export declare function DialogDescription({ className, ...props }: Omit<BaseDialog.Description.Props, "className"> & {
    className?: string;
}): import("react").JSX.Element;
declare const sheetPopup: (props?: ({
    side?: "bottom" | "end" | "start" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export declare const Sheet: <Payload>(props: BaseDialog.Root.Props<Payload>) => React.JSX.Element;
export declare const SheetTrigger: BaseDialog.Trigger;
export declare const SheetClose: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").AlertDialogCloseProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export type SheetContentProps = Omit<BaseDialog.Popup.Props, "className" | "render"> & VariantProps<typeof sheetPopup> & {
    className?: string;
    hideClose?: boolean;
    children?: ReactNode;
};
export declare function SheetContent({ className, side, hideClose, children, ...props }: SheetContentProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Dialog.d.ts.map