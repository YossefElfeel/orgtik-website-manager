import {
  createGroup,
  groupFingerprint,
  CRM_PORTAL_URL,
} from "./purchase-catalog.js";
import { getPaymentMethod } from "./purchase-payment.js";
import { msg } from "../content/strings.js";
import { publicRequest } from "./purchase-platform.js";

export const ORDER_SESSION_KEY = "orgtik.purchase-preview.v1";
const payments = new Map();
const attempts = new Map();
const ATTEMPT_KEY = "orgtik.purchase-attempt.v1";
let pendingPayment;
const setups = new Map();
const clone = (value) => JSON.parse(JSON.stringify(value));
function freeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((v) => {
    if (v && typeof v === "object" && !Object.isFrozen(v)) freeze(v);
  });
  return value;
}
export function validateCustomer(customer) {
  const errors = {};
  if (!customer?.name?.trim()) errors.name = msg("purchase-adapter:2");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer?.email?.trim() || ""))
    errors.email = msg("purchase-adapter:3");
  return errors;
}
export function createPurchaseSnapshot(order) {
  if (
    order?.version !== 1 ||
    order.paymentStatus !== "succeeded" ||
    !order.quoteId ||
    !order.claimToken ||
    !order.currency ||
    !Number.isInteger(order.decimals) ||
    !Array.isArray(order.groups) ||
    !Number.isFinite(order.quote?.total)
  )
    throw Object.assign(new Error(msg("purchase-adapter:4")), {
      code: "server_order_required",
    });
  return freeze(clone(order));
}
export const purchaseFingerprint = (groups) =>
  JSON.stringify(groups.map((group) => [group.id, groupFingerprint(group)]));
export async function quoteWebsite({ groups, signal }) {
  const normalized = groups.map(createGroup);
  if (
    !normalized.length ||
    normalized.some(
      (group) =>
        !group.lines.length ||
        group.needsReview ||
        group.lines.some((line) => ![1, 3, 6, 12].includes(line.months)),
    )
  )
    throw new Error(msg("purchase-adapter:8"));
  const quote = await publicRequest("/website-quotes", {
    body: {
      groups: normalized.map((group) => ({
        id: group.id,
        kind: group.kind,
        ...(group.bundleId ? { bundleId: group.bundleId } : {}),
        lines: group.lines,
      })),
    },
    signal,
  });
  return freeze(clone(quote));
}
export function getPendingPayment() {
  if (pendingPayment !== undefined) return pendingPayment;
  try {
    const pending = JSON.parse(
      globalThis.window?.sessionStorage?.getItem(ATTEMPT_KEY) || "null",
    );
    return pending?.payload?.quoteId &&
      pending.payload.reference &&
      pending.quote?.quoteId === pending.payload.quoteId
      ? pending
      : null;
  } catch {
    return null;
  }
}
const retainAttempt = (attempt) => {
  pendingPayment = attempt;
  try {
    window.sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {}
};
const clearAttempt = (reference) => {
  if (getPendingPayment()?.payload.reference !== reference) return;
  pendingPayment = null;
  try {
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {}
};
export function purchaseErrorText(error) {
  if (
    getPendingPayment() &&
    (error?.code === "transport_unavailable" ||
      error?.code === "server_order_required" ||
      error?.status >= 500 ||
      error?.name === "AbortError")
  )
    return msg("PlatformPricing:16");
  if (error?.code === "quote_expired") return msg("PlatformPricing:5");
  if (error?.code === "owner_required") return msg("PlatformPricing:15");
  if (error?.code === "payment_failed") return msg("purchase-adapter:9");
  if (error?.name === "AbortError" || error?.message === "cancelled")
    return msg("PurchaseCheckout:20");
  return error?.code
    ? msg("PlatformPricing:2")
    : error?.message || msg("PlatformPricing:2");
}
const delay = (signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("cancelled"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, 450);
    signal?.addEventListener("abort", abort, { once: true });
  });
// The hosted mock confirms the displayed platform quote. Browser totals never become a receipt.
export async function simulatePayment({
  groups,
  customer,
  reference,
  paymentMethod = "card",
  authorization,
  outcome = "success",
  signal,
  quote: displayedQuote,
}) {
  if (payments.has(reference)) return payments.get(reference);
  const method = getPaymentMethod(paymentMethod);
  if (authorization?.method !== method.id || authorization.approved !== true)
    throw new Error(msg("purchase-adapter:6"));
  if (Object.keys(validateCustomer(customer)).length)
    throw new Error(msg("purchase-adapter:7"));
  if (outcome === "cancelled") throw new Error("cancelled");
  const stableGroups = groups.map(createGroup);
  let newAttempt = false;
  const request = (async () => {
    const saved = getPendingPayment();
    let attempt =
      attempts.get(reference) ||
      (saved?.payload.reference === reference ? saved : null);
    if (!attempt) {
      newAttempt = true;
      const quote =
        displayedQuote ||
        (await quoteWebsite({ groups: stableGroups, signal }));
      const payload = {
        quoteId: quote.quoteId,
        reference,
        paymentMethod: method.id,
        billing: {
          name: customer.name.trim(),
          email: customer.email.trim(),
          company: customer.company || "",
        },
      };
      attempt = {
        payload,
        quote,
        fingerprint: purchaseFingerprint(stableGroups),
      };
      attempts.set(reference, attempt);
    }
    retainAttempt(attempt);
    const result = await publicRequest("/website-orders", {
      body: attempt.payload,
      signal,
      anonymous: !attempt.quote.region?.workspaceId,
      ...(outcome === "declined"
        ? { headers: { "x-mock-payment": "declined" } }
        : {}),
    });
    if (result?.paymentStatus === "failed")
      throw Object.assign(new Error(msg("purchase-adapter:9")), {
        code: "payment_failed",
        confirmed: true,
      });
    const order = createPurchaseSnapshot(result);
    clearAttempt(reference);
    return order;
  })();
  payments.set(reference, request);
  try {
    return await request;
  } catch (error) {
    payments.delete(reference);
    const rejected = newAttempt && error.status >= 400 && error.status < 500;
    if (
      error.code === "payment_failed" ||
      error.code === "quote_expired" ||
      rejected
    ) {
      attempts.delete(reference);
      clearAttempt(reference);
      error.confirmed = true;
    }
    throw error;
  }
}
export function createCRMHandoffRequest(
  order,
  customer = null,
  verified = false,
) {
  if (order?.paymentStatus !== "succeeded")
    throw new Error(msg("purchase-adapter:10"));
  // Production adapter input: backend purchase reference, immutable quoted lines,
  // terms, renewals, activation, and customer context. Only safe billing fields may
  // be retained in this tab's receipt for password setup; credentials never are.
  return {
    purchaseReference: order.reference,
    customerContext: customer
      ? {
          name: customer.name,
          email: customer.email,
          company: customer.company,
          verified,
        }
      : null,
    purchases: order.groups,
    amounts: order.quote,
    currency: order.currency,
    paymentMethod: getPaymentMethod(order.paymentMethod).id,
  };
}
export async function provisionCRM(
  order,
  { scenario = "ready", verified = false, customer = null } = {},
) {
  const request = createCRMHandoffRequest(order, customer, verified);
  const prior = setups.get(order.reference);
  if (prior?.status === "ready")
    return {
      ...prior,
      access: verified ? "verified-existing" : "setup-required",
    };
  await delay();
  const result = {
    purchaseReference: request.purchaseReference,
    destination: /^https:\/\//.test(CRM_PORTAL_URL) ? CRM_PORTAL_URL : null,
    status:
      scenario === "failed"
        ? "failed"
        : scenario === "pending"
          ? "pending"
          : "ready",
    access: verified ? "verified-existing" : "setup-required",
  };
  // Reference-keyed setup is idempotent. Pending/failed setups may be retried without payment.
  setups.set(order.reference, result);
  return result;
}
export function savePurchaseSession(order, crm, customer) {
  try {
    window.sessionStorage.setItem(
      ORDER_SESSION_KEY,
      JSON.stringify({
        order,
        crm: { status: crm.status, access: "setup-required" },
        // Only billing details needed for password setup survive a reload in this tab.
        // Never keep a password, payment credentials, or authenticated identity here.
        ...(customer && !Object.keys(validateCustomer(customer)).length
          ? {
              customer: {
                name: customer.name.trim(),
                email: customer.email.trim(),
                company: customer.company || "",
              },
            }
          : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function loadPurchaseSession() {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(ORDER_SESSION_KEY) || "null",
    );
    if (
      value?.order?.version !== 1 ||
      value.order.paymentStatus !== "succeeded" ||
      !value.order.quoteId ||
      !value.order.claimToken ||
      !Number.isInteger(value.order.decimals) ||
      !Array.isArray(value.order.groups) ||
      !Number.isFinite(value.order.quote?.total)
    )
      return null;
    return {
      order: freeze({
        ...value.order,
        paymentMethod: getPaymentMethod(value.order.paymentMethod).id,
      }),
      crm: {
        status: ["ready", "pending", "failed"].includes(value.crm?.status)
          ? value.crm.status
          : "pending",
        access: "setup-required",
      },
      customer:
        value.customer && !Object.keys(validateCustomer(value.customer)).length
          ? {
              name: value.customer.name,
              email: value.customer.email,
              company: value.customer.company || "",
            }
          : null,
    };
  } catch {
    return null;
  }
}
export function clearPurchaseSession() {
  try {
    window.sessionStorage.removeItem(ORDER_SESSION_KEY);
  } catch {}
}
