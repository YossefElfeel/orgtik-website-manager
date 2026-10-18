import { msg } from "../content/strings.js";
// In-memory simulation only. No credentials or identity are persisted.
let customer = null;
const listeners = new Set();
export const getPreviewCustomer = () => customer;
export function subscribePreviewCustomer(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function signInPreviewCustomer(input) {
  const email = String(input?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(msg("purchase-identity:1"));
  customer = Object.freeze({
    name: String(input?.name || "").trim(),
    email,
    company: String(input?.company || "").trim(),
  });
  listeners.forEach((listener) => listener());
  return customer;
}
export function signOutPreviewCustomer() {
  customer = null;
  listeners.forEach((listener) => listener());
}
