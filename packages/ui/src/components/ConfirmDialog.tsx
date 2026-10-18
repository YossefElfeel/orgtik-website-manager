"use client";
import { useId, useState, type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/cn.js";
import { scrim } from "../lib/overlay.js";
import { useStrings } from "../provider/OrgtikProvider.js";
import { Button } from "./Button.js";
import { Checkbox } from "./Checkbox.js";
import { Input } from "./Input.js";

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
  reason?: { label: ReactNode; required?: boolean; placeholder?: string };
  /** A statement the person must tick first: "I understand the client loses access today." */
  acknowledgement?: ReactNode;
  /** A word the person must type, for the most dangerous actions (deleting a workspace). */
  typeToConfirm?: string;
  /**
   * Runs the action. Return a promise to keep the dialog open, with the button busy, until it
   * settles. On rejection the dialog stays open and says so; on success it closes.
   */
  onConfirm: (details: { reason: string }) => void | Promise<unknown>;
};

export function ConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  impact,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  irreversible = false,
  reason,
  acknowledgement,
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useStrings();
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? innerOpen;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [acked, setAcked] = useState(false);
  const [typed, setTyped] = useState("");
  const reasonId = useId();
  const typedId = useId();

  const setOpen = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setFailed(false);
      setReasonText("");
      setAcked(false);
      setTyped("");
    }
    setInnerOpen(next);
    onOpenChange?.(next);
  };

  const ready =
    !pending &&
    (!reason?.required || reasonText.trim().length > 0) &&
    (!acknowledgement || acked) &&
    (!typeToConfirm || typed.trim() === typeToConfirm);

  const confirm = async () => {
    if (!ready) return;
    setFailed(false);
    const result = onConfirm({ reason: reasonText.trim() });
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      try {
        await result;
        setPending(false);
        setOpen(false);
      } catch {
        setPending(false);
        setFailed(true);
      }
    } else {
      setOpen(false);
    }
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {trigger ? <AlertDialog.Trigger render={trigger} /> : null}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={scrim} />
        <AlertDialog.Popup
          className={cn(
            "fixed start-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[440px] -translate-y-1/2 flex-col gap-5 p-6",
            "ltr:-translate-x-1/2 rtl:translate-x-1/2",
            "rounded-panel border border-line bg-overlay text-fg shadow-overlay outline-none",
            "transition-[opacity,scale] duration-(--ot-duration-base) ease-ot-out-strong",
            "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0",
          )}
        >
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="font-display text-title text-fg">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-body text-fg-muted">
              {impact}
              {irreversible ? <> {t("cannotBeUndone")}</> : null}
            </AlertDialog.Description>
          </div>

          {reason || acknowledgement || typeToConfirm ? (
            <div className="flex flex-col gap-4">
              {reason ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={reasonId} className="text-label text-fg">
                    {reason.label}
                    {reason.required ? (
                      <span aria-hidden="true" className="ms-0.5 text-danger">
                        *
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    id={reasonId}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder={reason.placeholder}
                    required={reason.required}
                    rows={3}
                    className="min-h-20 w-full resize-y rounded-field border border-line-control bg-raised px-3 py-2 text-body text-fg outline-hidden placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                  />
                </div>
              ) : null}
              {typeToConfirm ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={typedId} className="text-label text-fg">
                    {t("typeToConfirm", { word: typeToConfirm })}
                  </label>
                  <Input id={typedId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} dir="auto" />
                </div>
              ) : null}
              {acknowledgement ? <Checkbox label={acknowledgement} checked={acked} onCheckedChange={(v) => setAcked(v)} /> : null}
            </div>
          ) : null}

          {failed ? (
            <p role="alert" className="flex items-start gap-2 rounded-field bg-danger-subtle px-3 py-2 text-body-sm text-danger">
              <WarningCircle aria-hidden="true" weight="fill" className="mt-[0.15em] size-[1.1em] shrink-0" />
              {t("actionFailed")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <AlertDialog.Close render={<Button variant="secondary" disabled={pending} />}>{cancelLabel ?? t("cancel")}</AlertDialog.Close>
            <Button variant={tone} loading={pending} disabled={!ready && !pending} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
