// Pricing in the Website Manager seed (plan: "Pricing"), read-only.
//
// Since the website's main of 2026-10-01 (c8be7fe), prices live in the website's purchasing
// catalog, src/reference/purchase-catalog.js: one package per service and software product (sample
// CHF prices in minor units), the ready-made bundles, and the savings (duration 0/5/10/15% at
// 1/3/6/12 months, or by count 0/5/10/15% at 1/2/3–4/5+ items; the greater wins, never stacked).
// The cart and checkout read that file, so the website keeps it (owner's choice, 2026-10-03): the
// Website Manager mirrors it here, read-only (managedIn), and ADM becomes the price authority later.
// Two entries, as before: service pricing and software pricing.
import path from "node:path";
import { pathToFileURL } from "node:url";

const text = (label, extra = {}) => ({ kind: "text", label, ...extra });
const long = (label) => ({ kind: "longtext", label });
const tags = (label, extra = {}) => ({ kind: "tags", label, ...extra });
const num = (label, extra = {}) => ({ kind: "number", label, ...extra });
const toggle = (label) => ({ kind: "toggle", label });
const group = (fields, label) => ({ kind: "group", ...(label ? { label } : {}), fields });
const list = (label, itemLabel, fields) => ({ kind: "list", label, itemLabel, item: group(fields) });
const pct = (label) => num(label, { min: 0, max: 90, unit: "percent" });
const chf = (label) => num(label, { min: 0, unit: "currency" });

export const PRICING_FILE = "src/reference/purchase-catalog.js";

export async function buildPricing({ ref, entry }) {
  // The catalog imports its sibling catalogs, so it is loaded from the extracted tree on disk.
  const P = await import(pathToFileURL(path.join(ref, "purchase-catalog.js")).href);
  for (const k of ["CATALOG", "BUNDLES", "TERM_SAVINGS", "countSaving"]) if (!(k in P)) throw new Error(`purchase-catalog.js: ${k} is missing`);
  const savings = {
    terms: Object.entries(P.TERM_SAVINGS).map(([months, saving]) => ({ months: Number(months), saving })),
    counts: [2, 3, 5].map((count) => ({ count, saving: P.countSaving(count) })),
  };
  const layout = [
    { key: "items", kind: "data", label: "packages", node: list("packages", "package", { id: text("key", { locked: true }), name: text("name"), description: long("description"), capabilities: tags("capabilities"), monthly: chf("monthlyPrice") }) },
    { key: "bundles", kind: "data", label: "bundles", node: list("bundles", "bundle", { id: text("key", { locked: true }), name: text("name"), items: tags("itemKeys", { neutral: true }), why: long("why"), recommended: toggle("recommended") }) },
    {
      key: "savings",
      kind: "data",
      label: "savings",
      node: group({
        terms: list("durationSavings", "duration", { months: num("months", { min: 1, max: 60 }), saving: pct("saving") }),
        counts: list("countSavings", "count", { count: num("fromItems", { min: 1 }), saving: pct("saving") }),
      }),
    },
  ];
  const side = (kind, id, order, name) =>
    entry(
      id,
      "pricing",
      order,
      { name, slug: {}, priceMode: "indicative", currency: "CHF", managedIn: PRICING_FILE, layout },
      {
        items: P.CATALOG.filter((x) => x.kind === kind).map((x) => ({ id: x.id, name: x.name, description: x.description, capabilities: x.capabilities, monthly: x.monthlyMinor / 100 })),
        bundles: P.BUNDLES.filter((b) => b.kind === kind).map((b) => ({ id: b.id, name: b.name, items: b.ids, why: b.why, recommended: Boolean(b.recommended) })),
        savings,
      },
      {},
    );
  const out = [side("service", "pr_services", 1, "Service pricing"), side("software", "pr_software", 2, "Software pricing")];
  for (const e of out) e.seo = {};
  return out;
}
