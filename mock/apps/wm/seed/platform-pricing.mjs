// Published prototype copy for the platform-owned offer and payment adapter.
// Keep public Arabic launch deferred; non-English pages use the English fallback.
export const platformPricingCopy = [
  "Loading prices…",
  "Prices are unavailable. Try again.",
  "Retry prices",
  "Preparing your total…",
  "Your quote expired. Review the updated total before paying.",
  "Your quoted total changed. Review it before paying.",
  "Tax included ({0})",
  "Tax added ({0})",
  "Reverse charge · no tax added",
  "No tax is added under the configured rule.",
  "Ready to activate in your workspace",
  "Workspace activation confirmed",
  "Mock regional pricing: {0} ({1}).",
  "Workspace pricing: {0} ({1}).",
  "Only the workspace owner can complete this purchase.",
  "We couldn’t confirm this payment. Retry to recover the same attempt.",
  "Prices in {0}. Full selected periods are paid upfront.",
  "Seat capacity: {0}",
  "Recover payment",
];

// The pinned upstream page seed predates server-confirmed payment and account linking.
// Preserve the two approved published slot revisions whenever that seed is regenerated.
export function applyPlatformCommerceCopy(entries) {
  const commerce = entries.find(entry => entry.id === "gl_commerce");
  const slots = [
    ["purchaseCheckout-hero", "p-5", "Software activates after you link this purchase to your workspace. Service periods begin after onboarding confirms activation in your account."],
    ["purchaseCheckout-intro", "p-3", ". Regional tax is included in the quoted total."],
  ];
  for (const [block, slot, value] of slots) {
    if (!Object.hasOwn(commerce?.locales?.en?.[block] ?? {}, slot)) throw new Error(`Missing approved commerce slot ${block}.${slot}`);
    commerce.locales.en[block][slot] = value;
  }
}

export function platformPricingEntry(at, order = 14) {
  return {
    id: "st_platformPricing", type: "strings", siteId: "orgtik", order,
    name: "Platform pricing", slug: {},
    layout: [{ key: "lines", kind: "copy", label: "Offer and payment states", slots: platformPricingCopy.map((_, i) => ({ key: String(i + 1), kind: "message", context: "PlatformPricing" })) }],
    locales: { en: { lines: Object.fromEntries(platformPricingCopy.map((text, i) => [String(i + 1), text])) }, ar: {}, de: {}, fr: {}, it: {} },
    seo: {}, workflow: { state: "published", visibility: "live", version: 1, updatedAt: at, updatedBy: "seed", publishedAt: at },
    translation: { en: "published", ar: "not_started", de: "not_started", fr: "not_started", it: "not_started" },
  };
}
