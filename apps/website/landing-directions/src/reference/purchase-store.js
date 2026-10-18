import { useSyncExternalStore } from "react";
import {
  createGroup,
  groupFromIds,
  groupFingerprint,
  groupName,
  quoteCart,
  quoteGroup,
  migrateLegacy,
  MONTHS,
  money,
  currencyScale,
} from "./purchase-catalog.js";
export const CART_STORAGE_KEY = "orgtik.cart.v2";
const listeners = new Set();
let storageAvailable = true;
function readInitial() {
  try {
    const current = window.localStorage.getItem(CART_STORAGE_KEY);
    if (current) {
      const saved = JSON.parse(current);
      return {
        items: (Array.isArray(saved.groups) ? saved.groups : [])
          .map(createGroup)
          .filter((g) => g.lines.length),
        messages: Array.isArray(saved.messages)
          ? saved.messages.filter((m) => typeof m === "string")
          : [],
      };
    }
    const legacy = window.localStorage.getItem("orgtik.cart.v1");
    if (legacy) {
      const migrated = migrateLegacy(JSON.parse(legacy));
      try {
        window.localStorage.setItem("orgtik.cart.v1.backup", legacy);
        window.localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({
            version: 2,
            groups: migrated.groups,
            messages: migrated.messages,
          }),
        );
      } catch {
        storageAvailable = false;
      }
      return { items: migrated.groups, messages: migrated.messages };
    }
  } catch {
    storageAvailable = false;
  }
  return { items: [], messages: [] };
}
let snapshot = {
  ...readInitial(),
  notice: null,
  conflict: null,
  persistent: storageAvailable,
  editingId: null,
};
let undoItems = null;
function publish(patch, save = false) {
  snapshot = { ...snapshot, ...patch };
  if (save)
    try {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          groups: snapshot.items,
          messages: snapshot.messages,
        }),
      );
    } catch {
      snapshot = { ...snapshot, persistent: false };
    }
  listeners.forEach((fn) => fn());
}
function commit(items, text, undo = true) {
  if (undo) undoItems = snapshot.items;
  publish({ items, conflict: null, notice: { text, undo } }, true);
}
export const getCartSnapshot = () => snapshot;
export const useCart = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getCartSnapshot,
    getCartSnapshot,
  );
export function addCartItem(input, { replaceId = null } = {}) {
  const group = createGroup(input);
  if (!group.lines.length) return false;
  const overlaps = snapshot.items
    .filter((g) => g.id !== replaceId && g.kind === group.kind)
    .flatMap((g) =>
      g.lines
        .filter((l) => group.lines.some((n) => n.catalogId === l.catalogId))
        .map((l) => ({ ...l, groupId: g.id })),
    );
  if (overlaps.length) {
    publish({ conflict: { group, replaceId, overlaps } });
    return false;
  }
  const items = replaceId
    ? snapshot.items.map((g) =>
        g.id === replaceId ? { ...group, id: replaceId } : g,
      )
    : [...snapshot.items, group];
  commit(
    items,
    replaceId
      ? "Your plan has been updated."
      : `${groupName(group)} added to cart.`,
  );
  return true;
}
export function resolveOverlap(choice) {
  const pending = snapshot.conflict;
  if (!pending) return;
  const { group, replaceId, overlaps } = pending;
  const ids = new Set(overlaps.map((l) => l.catalogId));
  let next;
  if (choice === "keep") {
    const incoming = {
      ...group,
      lines: group.lines.filter((l) => !ids.has(l.catalogId)),
    };
    next = snapshot.items.filter((g) => g.id !== replaceId);
    if (incoming.lines.length)
      next.push({ ...incoming, id: replaceId || incoming.id });
  } else if (choice === "replace") {
    next = snapshot.items
      .filter((g) => g.id !== replaceId)
      .map((g) =>
        g.kind === group.kind
          ? { ...g, lines: g.lines.filter((l) => !ids.has(l.catalogId)) }
          : g,
      )
      .filter((g) => g.lines.length);
    next.push({ ...group, id: replaceId || group.id });
  } else {
    publish({ conflict: null });
    return;
  }
  commit(
    next,
    "Overlapping items resolved. Group savings have been recalculated.",
  );
}
export function updateGroup(id, patch) {
  const old = snapshot.items.find((g) => g.id === id);
  if (!old) return;
  const next = createGroup({ ...old, ...patch, id });
  if (!next.lines.length) {
    removeCartItem(id);
    return;
  }
  commit(
    snapshot.items.map((g) => (g.id === id ? next : g)),
    "Changes saved.",
  );
}
export function updateLine(groupId, catalogId, patch) {
  const group = snapshot.items.find((g) => g.id === groupId);
  if (!group) return;
  updateGroup(groupId, {
    lines: group.lines.map((l) =>
      l.catalogId === catalogId ? { ...l, ...patch } : l,
    ),
  });
}
export function removeCartItem(id) {
  commit(
    snapshot.items.filter((g) => g.id !== id),
    "Plan removed.",
  );
}
export function clearCart() {
  commit([], "Cart cleared.");
}
export function completeCartPurchase(ids) {
  undoItems = null;
  commit(
    snapshot.items.filter((g) => !ids.includes(g.id)),
    "Purchase complete.",
    false,
  );
}
export function undoCartUpdate() {
  if (!undoItems) return;
  const items = undoItems;
  undoItems = null;
  publish(
    {
      items,
      notice: { text: "Previous selection restored.", undo: false },
      conflict: null,
    },
    true,
  );
}
export const undoCartRemoval = undoCartUpdate;
export function dismissCartNotice() {
  publish({ notice: null });
}
export function acknowledgeMigration(id) {
  updateGroup(id, { needsReview: false });
}
export function dismissMigrationMessages() {
  publish({ messages: [] }, true);
}
export const dismissRepricedNote = dismissMigrationMessages;
export const cancelCartEdit = () => publish({ editingId: null });
export const beginCartEdit = (id) => publish({ editingId: id });
export const formatCHF = (amount) =>
  money(Math.round(amount * currencyScale()));
export const itemLabel = groupName;
export const formatItemEstimate = (group) =>
  `${money(quoteGroup(group).total)} upfront`;
export function cartTotals(items) {
  const q = quoteCart(items);
  return {
    ...q,
    monthly: q.monthlyEquivalent / currencyScale(),
    project: 0,
    periodTotal: q.total / currencyScale(),
    savings: q.saving / currencyScale(),
    onRequest: !q.valid,
  };
}
// Compatibility for legacy page view-models; rendered purchase components use groups.
export function createCartItem(input) {
  if (input?.lines) return createGroup(input);
  if (!input) return null;
  const months =
    input.termId === "annual"
      ? 12
      : MONTHS.includes(input.commitmentMonths)
        ? input.commitmentMonths
        : 1;
  const group = groupFromIds(
    input.kind,
    (input.selections || []).map((l) => l.id),
    months,
  );
  return {
    ...group,
    name: groupName(group),
    estimate: quoteGroup(group).monthlyEquivalent / currencyScale(),
    selections: input.selections || [],
  };
}
export function getCartChecks(items) {
  return items
    .filter((g) => !quoteGroup(g).valid)
    .map((g) => ({ type: "review", itemIds: [g.id] }));
}
export function updateCartItem(id, patch) {
  updateGroup(id, patch);
}
export const updateServicePeriod = (id, months) => {
  const g = snapshot.items.find((g) => g.id === id);
  if (g && MONTHS.includes(months))
    updateGroup(id, {
      defaultMonths: months,
      lines: g.lines.map((l) => ({ ...l, months })),
    });
};
export const undoServicePeriod = undoCartUpdate;
export const containsConfiguration = (group) =>
  snapshot.items.find((g) => groupFingerprint(g) === groupFingerprint(group));
window.addEventListener("storage", (event) => {
  if (event.key !== CART_STORAGE_KEY && event.key !== null) return;
  try {
    const value = JSON.parse(event.newValue || '{"groups":[]}');
    undoItems = null;
    publish({
      items: (Array.isArray(value.groups) ? value.groups : [])
        .map(createGroup)
        .filter((g) => g.lines.length),
      messages: Array.isArray(value.messages)
        ? value.messages.filter((message) => typeof message === "string")
        : [],
      notice: null,
      conflict: null,
    });
  } catch {
    /* Keep the current selection on malformed writes. */
  }
});
