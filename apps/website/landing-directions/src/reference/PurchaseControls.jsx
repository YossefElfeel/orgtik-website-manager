import React, { useEffect, useRef, useId } from "react";
import {
  MONTHS,
  TERM_SAVINGS,
  termLabel,
  findItem,
  groupName,
  groupFingerprint,
} from "./purchase-catalog.js";
import {
  useCart,
  addCartItem,
  removeCartItem,
  undoCartUpdate,
  dismissCartNotice,
  resolveOverlap,
} from "./purchase-store.js";
import "./commerce.css";
import "./purchase.css";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

export function PurchaseAction({
  children,
  onClick,
  href,
  disabled = false,
  secondary = false,
  type = "button",
  ...props
}) {
  const contents = (
    <>
      <span>{children}</span>
      <span className="commerce-action__arrow">
        <i className="ph ph-arrow-up-right" aria-hidden="true" />
      </span>
    </>
  );
  return href ? (
    <a
      {...props}
      href={href}
      onClick={onClick}
      className={`commerce-action purchase-action ${secondary ? "purchase-action--secondary" : ""}`}
    >
      {contents}
    </a>
  ) : (
    <button
      {...props}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`commerce-action purchase-action ${secondary ? "purchase-action--secondary" : ""}`}
    >
      {contents}
    </button>
  );
}
export function PurchaseDialog({
  open,
  title,
  onClose,
  children,
  className = "",
  descriptionId,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      ref.current?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else document.querySelector(".purchase-toast button")?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`purchase-dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...ref.current.querySelectorAll(
            "a[href], button, input, select, textarea, [tabindex]",
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            !element.closest("[hidden], [inert]") &&
            element.getClientRects().length,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      <div className="purchase-dialog__head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="purchase-icon-button"
          aria-label={attr(
            "gl_commerce|purchaseControls-intro|button@aria-label",
          )}
          onClick={onClose}
        >
          <i className="ph ph-x" aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DurationPicker({
  months,
  onChange,
  label = msg("PurchaseControls:1"),
  displayLabel,
  showSavings = false,
}) {
  const id = useId();
  return (
    <fieldset className="purchase-duration" aria-label={label}>
      <legend>{displayLabel || label}</legend>
      <div>
        {MONTHS.map((m) => (
          <label key={m}>
            <input
              type="radio"
              name={id}
              value={m}
              aria-label={`${termLabel(m)}${showSavings && m > 1 ? msg("PurchaseControls:2", [TERM_SAVINGS[m]]) : ""}`}
              checked={months === m}
              onChange={() => onChange(m)}
            />
            <span>
              {m}
              {run("gl_commerce|purchaseControls-intro|label", 0)}
              {showSavings && m > 1 && (
                <small>
                  {run("gl_commerce|purchaseControls-intro|label-2", 0)}
                  {TERM_SAVINGS[m]}%
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function AddPackageButton({
  item,
  disabled = false,
  removable = true,
  onAction,
  ...props
}) {
  const { items } = useCart();
  const primary = useRef(null);
  const existing =
    item && items.find((g) => groupFingerprint(g) === groupFingerprint(item));
  const focusPrimary = () =>
    requestAnimationFrame(() =>
      primary.current?.focus({ preventScroll: true }),
    );
  const action = (
    <PurchaseAction
      {...props}
      ref={primary}
      href={existing ? "/cart" : undefined}
      disabled={!existing && (disabled || !item?.lines.length)}
      onClick={() => {
        if (!existing && addCartItem(item)) focusPrimary();
        onAction?.();
      }}
      aria-label={
        existing
          ? msg("PurchaseControls:3", [groupName(item)])
          : msg("PurchaseControls:4", [item ? groupName(item) : "selection"])
      }
    >
      {existing ? msg("PurchaseControls:5") : msg("PurchaseControls:6")}
    </PurchaseAction>
  );
  return existing && removable ? (
    <div className="purchase-cart-actions">
      {action}
      <button
        type="button"
        className="purchase-cart-remove"
        aria-label={msg("PurchaseControls:7", [groupName(item)])}
        onClick={() => {
          removeCartItem(existing.id);
          onAction?.();
          focusPrimary();
        }}
      >
        <i className="ph ph-trash" aria-hidden="true" />
        {run("gl_commerce|purchaseControls-intro|button", 1)}
      </button>
    </div>
  ) : (
    action
  );
}
export function CartLink() {
  const { items } = useCart();
  return (
    <a
      href="/cart"
      className="cart-link"
      aria-label={msg("PurchaseControls:8", [
        items.length,
        items.length === 1 ? "plan" : "plans",
      ])}
    >
      <i className="ph ph-shopping-cart" aria-hidden="true" />
      <span className="cart-link__count">{items.length}</span>
    </a>
  );
}
export function CartNotice() {
  const { notice, conflict } = useCart();
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(dismissCartNotice, 10000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape" && !conflict) dismissCartNotice();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [conflict]);
  return (
    <>
      {notice && (
        <aside
          className="purchase-toast"
          aria-label={attr(
            "gl_commerce|purchaseControls-intro|aside@aria-label",
          )}
        >
          <span className="purchase-toast__icon" aria-hidden="true">
            <i className="ph ph-check" />
          </span>
          <div
            className="purchase-toast__message"
            role="status"
            aria-atomic="true"
          >
            <strong>{run("gl_commerce|purchaseControls-intro|div", 0)}</strong>
            <p>{notice.text}</p>
          </div>
          <div className="purchase-toast__actions">
            {notice.undo && (
              <button
                className="purchase-toast__undo"
                onClick={undoCartUpdate}
                type="button"
              >
                <i
                  className="ph ph-arrow-counter-clockwise"
                  aria-hidden="true"
                />
                {run("gl_commerce|purchaseControls-intro|button-2", 1)}
              </button>
            )}
            <a className="purchase-toast__cart" href="/cart">
              {run("gl_commerce|purchaseControls-intro|a", 0)}
              <i className="ph ph-arrow-right" aria-hidden="true" />
            </a>
          </div>
          <button
            className="purchase-toast__close"
            type="button"
            onClick={dismissCartNotice}
            aria-label={attr(
              "gl_commerce|purchaseControls-intro|button@aria-label-2",
            )}
          >
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </aside>
      )}
      <CartOverlapDialog conflict={conflict} />
    </>
  );
}
function OverlapItems({ lines, kind }) {
  return (
    <ul className="purchase-overlap__items">
      {lines.map((line) => (
        <li key={line.catalogId}>
          <strong>{findItem(line.catalogId, kind)?.name}</strong>
          <span>
            {termLabel(line.months)} ·{" "}
            {line.autoRenew
              ? msg("PurchaseControls:9")
              : msg("PurchaseControls:10")}
          </span>
        </li>
      ))}
    </ul>
  );
}
function CartOverlapDialog({ conflict }) {
  const { items } = useCart();
  const descriptionId = useId();
  const sharedIds = new Set(conflict?.overlaps.map((line) => line.catalogId));
  const currentPlans = items.filter((group) =>
    conflict?.overlaps.some((line) => line.groupId === group.id),
  );
  const sharedLines =
    conflict?.group.lines.filter((line) => sharedIds.has(line.catalogId)) || [];
  const otherLines =
    conflict?.group.lines.filter((line) => !sharedIds.has(line.catalogId)) ||
    [];
  const sameTerms =
    !!conflict &&
    conflict.overlaps.every((line) => {
      const next = sharedLines.find(
        (next) => next.catalogId === line.catalogId,
      );
      return next?.months === line.months && next?.autoRenew === line.autoRenew;
    });
  return (
    <PurchaseDialog
      open={!!conflict}
      title={attr("gl_commerce|purchaseControls-intro|PurchaseDialog@title")}
      descriptionId={descriptionId}
      className="purchase-dialog--overlap"
      onClose={() => resolveOverlap("cancel")}
    >
      {conflict && (
        <>
          <p id={descriptionId} className="purchase-overlap__intro">
            {sharedIds.size}{" "}
            {sharedIds.size === 1 ? msg("PurchaseControls:11") : "items are"}{" "}
            {run("gl_commerce|purchaseControls-intro|p", 0)}
          </p>
          <div className="purchase-overlap__comparison">
            <section
              className="purchase-overlap__version purchase-overlap__version--current"
              aria-label={attr(
                "gl_commerce|purchaseControls-hero|section@aria-label",
              )}
            >
              <h3>
                <i className="ph ph-shopping-cart" aria-hidden="true" />
                {run("gl_commerce|purchaseControls-hero|h3", 1)}
              </h3>
              <div className="purchase-overlap__plans">
                {currentPlans.map((group) => (
                  <div key={group.id}>
                    <h4>{groupName(group)}</h4>
                    <OverlapItems
                      kind={group.kind}
                      lines={group.lines.filter((line) =>
                        sharedIds.has(line.catalogId),
                      )}
                    />
                  </div>
                ))}
              </div>
              <p className="purchase-overlap__consequence">
                {run("gl_commerce|purchaseControls-hero|p", 0)}{" "}
                {currentPlans.length === 1 ? "plan" : "plans"}.
              </p>
              <PurchaseAction onClick={() => resolveOverlap("keep")}>
                {run("gl_commerce|purchaseControls-hero|PurchaseAction", 0)}
              </PurchaseAction>
            </section>
            <section
              className="purchase-overlap__version purchase-overlap__version--new"
              aria-label={attr(
                "gl_commerce|purchaseControls-section-1|section@aria-label",
              )}
            >
              <h3>
                <i className="ph ph-plus" aria-hidden="true" />
                {run("gl_commerce|purchaseControls-section-1|h3", 1)}
              </h3>
              <div className="purchase-overlap__plans">
                <div>
                  <h4>{groupName(conflict.group)}</h4>
                  <OverlapItems
                    kind={conflict.group.kind}
                    lines={sharedLines}
                  />
                </div>
              </div>
              <p className="purchase-overlap__consequence">
                {run("gl_commerce|purchaseControls-section-1|p", 0)}
              </p>
              <PurchaseAction
                secondary
                onClick={() => resolveOverlap("replace")}
              >
                {run(
                  "gl_commerce|purchaseControls-section-1|PurchaseAction",
                  0,
                )}
              </PurchaseAction>
            </section>
          </div>
          {sameTerms && (
            <p className="purchase-overlap__same">
              {run("gl_commerce|purchaseControls-intro|p-2", 0)}
            </p>
          )}
          {!!otherLines.length && (
            <div className="purchase-overlap__included">
              <strong>
                {run("gl_commerce|purchaseControls-intro|div-2", 0)}
              </strong>
              <span>
                {otherLines
                  .map(
                    (line) =>
                      findItem(line.catalogId, conflict.group.kind)?.name,
                  )
                  .join(", ")}
              </span>
            </div>
          )}
          <div className="purchase-overlap__footer">
            <p>{run("gl_commerce|purchaseControls-intro|p-3", 0)}</p>
            <button
              type="button"
              className="purchase-text-button"
              onClick={() => resolveOverlap("cancel")}
            >
              {run("gl_commerce|purchaseControls-intro|button-3", 0)}
            </button>
          </div>
        </>
      )}
    </PurchaseDialog>
  );
}
export function CartEditBar() {
  return null;
}
export const AddToCartButton = AddPackageButton;
