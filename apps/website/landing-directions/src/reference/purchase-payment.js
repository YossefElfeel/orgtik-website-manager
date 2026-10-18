import { msg } from "../content/strings.js";
// Available choices in the local simulation; production methods come from the payment backend.
export const PAYMENT_METHODS = Object.freeze([
  Object.freeze({
    id: "card",
    get name() {
      return msg("purchase-payment:1");
    },
    get description() {
      return msg("purchase-payment:2");
    },
    icon: "credit-card",
    get guidance() {
      return msg("purchase-payment:3");
    },
  }),
  Object.freeze({
    id: "twint",
    get name() {
      return msg("purchase-payment:4");
    },
    get description() {
      return msg("purchase-payment:5");
    },
    icon: "device-mobile",
    get guidance() {
      return msg("purchase-payment:6");
    },
  }),
  Object.freeze({
    id: "paypal",
    get name() {
      return msg("purchase-payment:7");
    },
    get description() {
      return msg("purchase-payment:8");
    },
    icon: "wallet",
    get guidance() {
      return msg("purchase-payment:9");
    },
  }),
]);

export function getPaymentMethod(id = "card") {
  const method = PAYMENT_METHODS.find((option) => option.id === id);
  if (!method) throw new Error(msg("purchase-payment:10"));
  return method;
}

// Synthetic inputs only. No real credentials or provider connections belong here.
export const TEST_CARD_NUMBERS = Object.freeze([
  "4242424242424242",
  "5555555555554444",
]);
export const TEST_CARD_EXPIRY = "12/30";
export const TEST_CARD_SECURITY_CODE = "123";

export function normalizeTestPaymentInput(field, value) {
  const text = String(value || "");
  if (field === "cardNumber") {
    if (!/^[\d\s]*$/.test(text)) return null;
    const digits = text.replace(/\s/g, "");
    if (!TEST_CARD_NUMBERS.some((number) => number.startsWith(digits)))
      return null;
    return digits.replace(/(.{4})(?=.)/g, "$1 ");
  }
  if (field === "expiry") {
    if (!/^[\d/\s]*$/.test(text)) return null;
    const digits = text.replace(/[\s/]/g, "");
    if (!TEST_CARD_EXPIRY.replace("/", "").startsWith(digits)) return null;
    return digits.length > 2
      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
  }
  if (field === "securityCode")
    return TEST_CARD_SECURITY_CODE.startsWith(text) ? text : null;
  return null;
}

export function validateTestPaymentDetails(methodId, details = {}) {
  const method = getPaymentMethod(methodId);
  const errors = {};
  if (method.id === "card") {
    if (!TEST_CARD_NUMBERS.includes(details.cardNumber?.replace(/\s/g, "")))
      errors.cardNumber = msg("purchase-payment:11");
    if (details.expiry !== TEST_CARD_EXPIRY)
      errors.expiry = msg("purchase-payment:12", [TEST_CARD_EXPIRY]);
    if (details.securityCode !== TEST_CARD_SECURITY_CODE)
      errors.securityCode = msg("purchase-payment:13", [
        TEST_CARD_SECURITY_CODE,
      ]);
  }
  return errors;
}

export function createTestPaymentAuthorization(methodId, details) {
  const method = getPaymentMethod(methodId);
  if (Object.keys(validateTestPaymentDetails(method.id, details)).length)
    throw new Error(msg("purchase-payment:14"));
  // The Pay request confirms this local simulation. No wallet approval or credentials are collected.
  return Object.freeze({ method: method.id, approved: true });
}
