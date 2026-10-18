import { type ReactNode } from "react";
export type ConfirmDialogProps = {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** An element that opens the dialog, e.g. <Button variant="danger">Delete</Button>. */
    trigger?: React.ReactElement;
    /** A question naming the thing: "Delete 3 files?" */
    title: ReactNode;
    /**
     * What happens to other things, in numbers where possible: "They're in 2 shared links, which
     * will stop working." Required, so no destructive confirm says only "Are you sure?".
     */
    impact: ReactNode;
    /** The verb and object, matching the title: "Delete files". Never "OK" or "Yes". */
    confirmLabel: ReactNode;
    cancelLabel?: ReactNode;
    /** danger for irreversible loss; primary for reversible changes such as Archive. */
    tone?: "danger" | "primary";
    /** Adds "This can't be undone." under the impact. */
    irreversible?: boolean;
    /** Asks for a reason, stored with the action (e.g. a refund or a decline). */
    reason?: {
        label: ReactNode;
        required?: boolean;
        placeholder?: string;
    };
    /** A statement the person must tick first: "I understand the client loses access today." */
    acknowledgement?: ReactNode;
    /** A word the person must type, for the most dangerous actions (deleting a workspace). */
    typeToConfirm?: string;
    /**
     * Runs the action. Return a promise to keep the dialog open, with the button busy, until it
     * settles. On rejection the dialog stays open and says so; on success it closes.
     */
    onConfirm: (details: {
        reason: string;
    }) => void | Promise<unknown>;
};
export declare function ConfirmDialog({ open, defaultOpen, onOpenChange, trigger, title, impact, confirmLabel, cancelLabel, tone, irreversible, reason, acknowledgement, typeToConfirm, onConfirm, }: ConfirmDialogProps): import("react").JSX.Element;
//# sourceMappingURL=ConfirmDialog.d.ts.map