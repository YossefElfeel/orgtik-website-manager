import React, { useState, useRef, useEffect, useCallback } from "react";
import { CommerceLayout } from "./CommerceLayout";
import {
  useCart,
  updateLine,
  updateGroup,
  addCartItem,
  removeCartItem,
  clearCart,
  acknowledgeMigration,
  dismissMigrationMessages,
  dismissCartNotice,
} from "./purchase-store.js";
import {
  createGroup,
  groupName,
  groupTerm,
  quoteCart,
  quoteGroup,
  HOSTING_URL,
  money,
} from "./purchase-catalog.js";
import {
  ConfigurationEditor,
  PackageLines,
  QuoteSummary,
  PreviewNote,
  MobilePurchaseBar,
} from "./PurchaseUI";
import { PurchaseAction, PurchaseDialog } from "./PurchaseControls";
import { cartBackTarget } from "./navigation.js";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

function CartBackLink() {
  const target = cartBackTarget();
  return (
    <a
      className="purchase-cart-back"
      href={target.href}
      onClick={(event) => {
        if (
          !target.useHistory ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        window.history.back();
      }}
    >
      <i className="ph ph-arrow-left" aria-hidden="true" />
      {run("gl_commerce|purchaseCart-intro|a", 1)}
    </a>
  );
}

function CartGroup({ group, onEditState }) {
  const [draft, setDraft] = useState(null);
  const editing = !!draft;
  useEffect(() => {
    onEditState(group.id, editing);
    return () => onEditState(group.id, false);
  }, [group.id, editing, onEditState]);
  const section = useRef(null);
  const editButton = useRef(null);
  const wasEditing = useRef(false);
  const recoverRemovalFocus = () =>
    requestAnimationFrame(() => {
      const target =
        section.current?.querySelector("button") ||
        document.querySelector(".purchase-toast button");
      target?.focus();
    });
  useEffect(() => {
    if (draft && !wasEditing.current)
      section.current?.querySelector("input")?.focus();
    if (!draft && wasEditing.current) editButton.current?.focus();
    wasEditing.current = !!draft;
  }, [draft]);
  const save = () => {
    if (!draft.lines.length) removeCartItem(group.id);
    else addCartItem({ ...draft, needsReview: false }, { replaceId: group.id });
    setDraft(null);
  };
  return (
    <section
      ref={section}
      className="purchase-cart-group"
      aria-label={groupName(group)}
    >
      <header>
        <div>
          <span className="purchase-eyebrow">
            {group.kind === "service"
              ? msg("PurchaseCart:1")
              : msg("PurchaseCart:2")}
          </span>
          <h2>{groupName(group)}</h2>
          <p>
            {group.lines.length}
            {run("gl_commerce|purchaseCart-header|p", 0)}
            {groupTerm(group)} · {money(quoteGroup(group).total)}
            {run("gl_commerce|purchaseCart-header|p-2", 0)}
          </p>
        </div>
        <button
          type="button"
          className="purchase-text-button"
          aria-label={msg("PurchaseCart:3", [groupName(group)])}
          onClick={() => {
            removeCartItem(group.id);
            recoverRemovalFocus();
          }}
        >
          <span className="purchase-remove-label">
            {run("gl_commerce|purchaseCart-header|button", 1)}
          </span>
          {run("gl_commerce|purchaseCart-header|button", 2)}
          <i className="ph ph-trash" aria-hidden="true" />
        </button>
      </header>
      {draft ? (
        <>
          <ConfigurationEditor group={draft} onChange={setDraft} />
          <div className="purchase-draft-actions">
            <p role="status">
              {draft.lines.length ? (
                <>
                  {run("gl_commerce|purchaseCart-hero|p", 0)}{" "}
                  <strong>{money(quoteGroup(draft).total)}</strong>
                  {run("gl_commerce|purchaseCart-hero|p-2", 0)}
                </>
              ) : (
                msg("PurchaseCart:4")
              )}
            </p>
            <div className="purchase-toolbar">
              <PurchaseAction
                onClick={save}
                disabled={draft.lines.some((l) => !l.months)}
              >
                {run("gl_commerce|purchaseCart-hero|PurchaseAction", 0)}
              </PurchaseAction>
              <button type="button" onClick={() => setDraft(null)}>
                {run("gl_commerce|purchaseCart-hero|button", 0)}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <PackageLines
            compact
            group={group}
            onChange={(id, patch) => updateLine(group.id, id, patch)}
            onRemove={(id) => {
              updateGroup(group.id, {
                lines: group.lines.filter((l) => l.catalogId !== id),
              });
              recoverRemovalFocus();
            }}
          />
          {group.needsReview && (
            <div className="purchase-alert">
              <p>{run("gl_commerce|purchaseCart-hero|p-3", 0)}</p>
              <PurchaseAction
                secondary
                disabled={group.lines.some((l) => !l.months)}
                onClick={() => acknowledgeMigration(group.id)}
              >
                {run("gl_commerce|purchaseCart-hero|PurchaseAction-2", 0)}
              </PurchaseAction>
            </div>
          )}
          <button
            ref={editButton}
            type="button"
            className="purchase-text-button"
            onClick={() => {
              dismissCartNotice();
              setDraft(createGroup(group));
            }}
          >
            {run("gl_commerce|purchaseCart-hero|button-2", 0)}
            {run("gl_commerce|purchaseCart-hero|button-2", 1)}
            <i className="ph ph-pencil-simple" aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}
export function EmptyPurchaseCart() {
  return (
    <div className="purchase-empty">
      <span className="purchase-eyebrow">
        {run("gl_commerce|purchaseCart-intro|div", 0)}
      </span>
      <h2>{run("gl_commerce|purchaseCart-intro|h2", 0)}</h2>
      <p>{run("gl_commerce|purchaseCart-intro|p", 0)}</p>
      <div>
        <PurchaseAction href="/services#service-bundles">
          {run("gl_commerce|purchaseCart-intro|PurchaseAction", 0)}
        </PurchaseAction>
        <PurchaseAction href="/software#software-bundles" secondary>
          {run("gl_commerce|purchaseCart-intro|PurchaseAction-2", 0)}
        </PurchaseAction>
      </div>
    </div>
  );
}
export default function PurchaseCart() {
  const { items, messages, persistent } = useCart();
  const [clear, setClear] = useState(false);
  const [editingIds, setEditingIds] = useState([]);
  const onEditState = useCallback(
    (id, editing) =>
      setEditingIds((ids) =>
        editing
          ? ids.includes(id)
            ? ids
            : [...ids, id]
          : ids.includes(id)
            ? ids.filter((x) => x !== id)
            : ids,
      ),
    [],
  );
  const editing = editingIds.some((id) => items.some((g) => g.id === id));
  const quote = quoteCart(items);
  const checkoutAction = (compact = false) =>
    quote.valid && !editing ? (
      <PurchaseAction
        href="/checkout"
        aria-label={attr(
          "gl_commerce|purchaseCart-intro|PurchaseAction@aria-label",
        )}
      >
        {compact ? msg("PurchaseCart:5") : msg("PurchaseCart:6")}
      </PurchaseAction>
    ) : (
      <PurchaseAction disabled>
        {editing
          ? compact
            ? msg("PurchaseCart:7")
            : msg("PurchaseCart:8")
          : msg("PurchaseCart:9")}
      </PurchaseAction>
    );
  return (
    <CommerceLayout>
      <div
        className={`purchase-surface ${items.length ? "purchase-with-mobile-bar" : ""}`}
      >
        <CartBackLink />
        <div className="commerce-intro">
          <span className="purchase-eyebrow">
            {run("gl_commerce|purchaseCart-intro|div-2", 0)}
          </span>
          <h1>{run("gl_commerce|purchaseCart-intro|h1", 0)}</h1>
          <p>{run("gl_commerce|purchaseCart-intro|p-2", 0)}</p>
        </div>
        {!persistent && (
          <p className="purchase-alert">
            {run("gl_commerce|purchaseCart-intro|p-3", 0)}
          </p>
        )}
        {messages.length > 0 && (
          <div className="purchase-alert" role="status">
            {messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
            {messages.some((m) => m.includes("Hosting")) && (
              <a href={HOSTING_URL}>
                {run("gl_commerce|purchaseCart-intro|a-2", 0)}
              </a>
            )}
            <button
              type="button"
              className="purchase-text-button"
              onClick={dismissMigrationMessages}
            >
              {run("gl_commerce|purchaseCart-intro|button", 0)}
            </button>
          </div>
        )}
        {!items.length ? (
          <EmptyPurchaseCart />
        ) : (
          <div className="purchase-layout">
            <div>
              <div className="purchase-toolbar purchase-cart-toolbar">
                <span>
                  {items.length}
                  {run("gl_commerce|purchaseCart-intro|div-3", 0)}{" "}
                  {items.length === 1 ? "plan" : "plans"}
                  <small className="purchase-autosave">
                    {run("gl_commerce|purchaseCart-intro|div-4", 0)}
                  </small>
                </span>
                <button type="button" onClick={() => setClear(true)}>
                  {run("gl_commerce|purchaseCart-intro|button-2", 0)}
                </button>
              </div>
              {items.map((group) => (
                <CartGroup
                  group={group}
                  key={group.id}
                  onEditState={onEditState}
                />
              ))}
              <nav
                className="purchase-cart-additions"
                aria-label={attr(
                  "gl_commerce|purchaseCart-intro|nav@aria-label",
                )}
              >
                <PurchaseAction secondary href="/services#svc-builder">
                  {run("gl_commerce|purchaseCart-intro|PurchaseAction-3", 0)}
                </PurchaseAction>
                <PurchaseAction secondary href="/software#plan-builder">
                  {run("gl_commerce|purchaseCart-intro|PurchaseAction-4", 0)}
                </PurchaseAction>
              </nav>
            </div>
            <QuoteSummary
              groups={items}
              title={attr("gl_commerce|purchaseCart-intro|QuoteSummary@title")}
            >
              {checkoutAction()}
              {editing ? (
                <p role="status">
                  {run("gl_commerce|purchaseCart-intro|p-4", 0)}
                </p>
              ) : !quote.valid ? (
                <>
                  <p>{run("gl_commerce|purchaseCart-intro|p-5", 0)}</p>
                </>
              ) : null}
            </QuoteSummary>
          </div>
        )}
        <PreviewNote />
        {items.length > 0 && (
          <MobilePurchaseBar
            groups={items}
            note={editing ? msg("PurchaseCart:10") : msg("PurchaseCart:11")}
          >
            {checkoutAction(true)}
          </MobilePurchaseBar>
        )}
        <PurchaseDialog
          open={clear}
          title={attr("gl_commerce|purchaseCart-intro|PurchaseDialog@title")}
          onClose={() => setClear(false)}
        >
          <p>{run("gl_commerce|purchaseCart-intro|p-6", 0)}</p>
          <div className="purchase-dialog__actions">
            <PurchaseAction
              onClick={() => {
                clearCart();
                setClear(false);
              }}
            >
              {run("gl_commerce|purchaseCart-intro|PurchaseAction-5", 0)}
            </PurchaseAction>
            <PurchaseAction secondary onClick={() => setClear(false)}>
              {run("gl_commerce|purchaseCart-intro|PurchaseAction-6", 0)}
            </PurchaseAction>
          </div>
        </PurchaseDialog>
      </div>
    </CommerceLayout>
  );
}
