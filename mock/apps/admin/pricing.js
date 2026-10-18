// The price resolver (spec 03 "Pricing", v1.0): pure functions over the pricing tables, so the
// platform mock, its tests (pricing.test.js, the spec's worked examples R03-EX-1…12) and later the
// backend agree on every number.
//
// Tables (all plain data, see store.js):
//   currencies { CODE: { decimals, step, mode: "nearest" | "up" | "down" } }       G-05
//   rates      [{ from, to, rate }] admin rates; a missing pair goes through USD     ADM-15
//   zones      [{ id, currency, isDefault, active }]                                  ADM-09/10
//   countries  { ISO: { zone, currency, fixed: { "<plan>:<cycle>": amount } } }       ADM-11, G-01
//   plans      [{ id, perUser, minSeats, yearlyDiscountPct, defaultUsd: { monthly, yearly? },
//                 private?: { amount, currency } }]                                   ADM-07
//   grid       { "<plan>:<cycle>:<zone>": amount }  (published prices)               ADM-12

/** Rounds to a currency's step and mode, then to its decimals (R03-ALG-4, G-05). */
function roundStep(amount, cur) {
  const step = cur.step || 10 ** -cur.decimals;
  const n = amount / step;
  const k = cur.mode === "up" ? Math.ceil(n - 1e-9) : cur.mode === "down" ? Math.floor(n + 1e-9) : Math.round(n);
  return toDecimals(k * step, cur.decimals);
}
/** Totals and proration round to the currency's decimals only, never to the step (ALG-8, X4). */
function toDecimals(amount, decimals) {
  const f = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * f) / f;
}

/** The admin rate from one currency to another: direct, inverse, or through USD. */
function rate(tables, from, to) {
  if (from === to) return 1;
  const direct = tables.rates.find((r) => r.from === from && r.to === to);
  if (direct) return direct.rate;
  const inverse = tables.rates.find((r) => r.from === to && r.to === from);
  if (inverse) return 1 / inverse.rate;
  if (from !== "USD" && to !== "USD") {
    const a = rate(tables, from, "USD"), b = rate(tables, "USD", to);
    if (a != null && b != null) return a * b;
  }
  return null;
}

const zoneOf = (tables, country) => {
  const c = tables.countries[country];
  const z = c && tables.zones.find((x) => x.id === c.zone && x.active !== false);
  return z ?? tables.zones.find((x) => x.isDefault); // X1, X5: no zone (or an inactive one) → Default
};

/**
 * One plan's price for one cycle in one billing country (R03-ALG-1…6), before seats.
 * Returns { amount, currency, source: "Private" | "Country" | "Zone" | "Zone (converted)" | "Default" }.
 */
function resolveUnit(tables, { planId, cycle, country }) {
  const plan = tables.plans.find((p) => p.id === planId);
  if (!plan) throw new Error(`unknown plan ${planId}`);
  // 1. A private (custom) plan has its own price and currency.
  if (plan.private) return { amount: plan.private.amount, currency: plan.private.currency, source: "Private" };
  const c = tables.countries[country] ?? {};
  const countryCur = c.currency ?? "USD";
  const curOf = (code) => tables.currencies[code] ?? { decimals: 2, step: 0.01, mode: "nearest" };
  const yearlyFromMonthly = (monthly) => monthly * 12 * (1 - (plan.yearlyDiscountPct ?? 0) / 100);
  // 2. The country's fixed price.
  const fixed = c.fixed?.[`${planId}:${cycle}`] ?? (cycle === "yearly" && c.fixed?.[`${planId}:monthly`] != null ? yearlyFromMonthly(c.fixed[`${planId}:monthly`]) : undefined);
  if (fixed != null) return { amount: roundStep(fixed, curOf(countryCur)), currency: countryCur, source: "Country" };
  // 3. The country's zone (or the Default zone). 6: yearly from monthly at the same level, rounded once.
  const zone = zoneOf(tables, country);
  let base = zone ? tables.grid[`${planId}:${cycle}:${zone.id}`] : undefined;
  if (base == null && cycle === "yearly" && zone) {
    const m = tables.grid[`${planId}:monthly:${zone.id}`];
    if (m != null) base = yearlyFromMonthly(m);
  }
  if (base != null) {
    // 4. Converted to the country's currency with the admin rate, then that currency's rounding.
    if (countryCur !== zone.currency) {
      const r = rate(tables, zone.currency, countryCur);
      if (r == null) return { amount: roundStep(base, curOf(zone.currency)), currency: zone.currency, source: "Zone" };
      return { amount: roundStep(base * r, curOf(countryCur)), currency: countryCur, source: "Zone (converted)" };
    }
    return { amount: roundStep(base, curOf(countryCur)), currency: countryCur, source: "Zone" };
  }
  // 5. The plan's default USD price, converted when a USD rate exists.
  let usd = plan.defaultUsd?.[cycle];
  if (usd == null && cycle === "yearly" && plan.defaultUsd?.monthly != null) usd = yearlyFromMonthly(plan.defaultUsd.monthly);
  if (usd == null) return null;
  const r = countryCur === "USD" ? 1 : rate(tables, "USD", countryCur);
  if (r == null) return { amount: roundStep(usd, curOf("USD")), currency: "USD", source: "Default" };
  return { amount: roundStep(usd * r, curOf(countryCur)), currency: countryCur, source: "Default" };
}

/** A subscription line: unit × max(seats, plan min seats) for per-user plans (ALG-7, S1). */
function resolveLine(tables, { planId, cycle, country, seats = 1 }) {
  const unit = resolveUnit(tables, { planId, cycle, country });
  if (!unit) return null;
  const plan = tables.plans.find((p) => p.id === planId);
  const qty = plan.perUser ? Math.max(seats, plan.minSeats ?? 1) : 1;
  const cur = tables.currencies[unit.currency] ?? { decimals: 2 };
  return { ...unit, unit: unit.amount, quantity: qty, amount: toDecimals(unit.amount * qty, cur.decimals) };
}

/** Currency lock belongs to a workspace, even when its country price resolves in another currency. */
function resolveWorkspaceLine(tables, { planId, cycle, workspace, seats = 1 }) {
  const r = resolveLine(tables, { planId, cycle, country: workspace.country, seats });
  if (!r || r.currency === workspace.currency) return r;
  const conversion = rate(tables, r.currency, workspace.currency);
  if (conversion == null) return null;
  const cur = tables.currencies[workspace.currency] ?? { decimals: 2, step: 0.01 };
  const unit = roundStep(r.unit * conversion, cur);
  return { ...r, currency: workspace.currency, unit, amount: toDecimals(unit * r.quantity, cur.decimals), workspaceConverted: true, convertedFromCurrency: r.currency };
}

const periodDays = cycle => cycle === "yearly" ? 365 : 30;
const monthlyAmount = line => line.termMonths ? line.snapshot.amount / line.termMonths : line.cycle === "yearly" ? line.snapshot.amount / 12 : line.cycle === "monthly" ? line.snapshot.amount : 0;
/** Unused old-period credit is independent of the new cycle. Legacy lines lack periodStart. */
function proration(current, cycle, now, decimals = 2) {
  const end = current && Date.parse(current.periodEnd);
  if (!current || !(end > now)) return { factor: 1, credit: 0, periodEnd: null, periodStart: null };
  const prepaid = current.prepaidTerms || [];
  const coreEnd = prepaid.length ? Math.min(...prepaid.map(term => Date.parse(term.start))) : end;
  const start = Date.parse(current.periodStart) || coreEnd - (current.termMonths ? current.termMonths * 30 : periodDays(current.cycle)) * 86400000;
  const fraction = (from, to) => Math.max(0, Math.min(1, (to - now) / (to - from)));
  const remaining = fraction(start, coreEnd);
  const unusedPrepaid = prepaid.reduce((sum, term) => sum + term.amount * fraction(Date.parse(term.start), Date.parse(term.end)), 0);
  // A six-month website offer switching to a monthly subscription starts a new monthly
  // period. Future prepaid periods remain money owed to the workspace, not lost time.
  const samePeriod = current.cycle === cycle && (!current.termMonths || current.termMonths === (cycle === "yearly" ? 12 : 1)) && !prepaid.length;
  return {
    factor: samePeriod ? remaining : 1,
    credit: toDecimals((current.snapshot.periodAmount ?? current.snapshot.amount) * remaining + unusedPrepaid, decimals),
    periodEnd: samePeriod ? current.periodEnd : null,
    periodStart: samePeriod ? new Date(start).toISOString() : null,
  };
}

/** D-060 display policy and deterministic prototype VAT validation; no live VIES claims. */
function taxForWorkspace(tables, ws) {
  const country = ws.billing?.country || ws.country;
  const rule = tables.taxRules?.find(t => t.country === country && t.active);
  const inclusive = ["SA", "AE", "KW", "QA", "BH", "OM"].includes(country);
  const taxId = String(ws.billing?.taxId ?? "").replace(/[\s.-]/g, "").toUpperCase();
  const eu = ["DE", "FR", "IT"].includes(country);
  const mockValid = ws.billing?.taxIdValid !== false && new RegExp(`^${country}[A-Z0-9]{8,12}$`).test(taxId);
  const reverseCharge = Boolean(eu && rule?.b2bReverseCharge && ws.billing?.legalName?.trim() && mockValid);
  const taxRate = reverseCharge ? 0 : rule?.rate ?? 0;
  return { ...(rule ?? {}), country, rate: taxRate, inclusive, reverseCharge, label: reverseCharge ? "Reverse charge 0%" : rule ? `${rule.name} ${taxRate}% (${inclusive ? "included" : "excluded"})` : `Tax ${inclusive ? "included" : "excluded"}`, validation: "mock" };
}

/**
 * A cart total (ALG-8): bundle % → coupon → proration → tax, each rounded to the currency's
 * decimals; a coupon never takes the total below 0 (K2); a fixed coupon only works in its
 * currencies (K1). tax: { rate, inclusive } (G-12: inclusive vs exclusive is per country rule).
 */
function totals({ lines, currency, decimals = 2, bundlePct = 0, coupon = null, prorationFactor = 1, tax = null }) {
  const sub = toDecimals(lines.reduce((s, l) => s + l.amount, 0), decimals);
  const eligible = field => lines.map((l, i) => l[field] !== false ? i : -1).filter(i => i >= 0);
  const allocate = (amount, indices, weights) => {
    const out = lines.map(() => 0);
    const sum = indices.reduce((n, i) => n + weights[i], 0);
    let rest = amount;
    indices.forEach((i, n) => { out[i] = n === indices.length - 1 ? rest : Math.min(rest, toDecimals(sum ? amount * weights[i] / sum : 0, decimals)); rest = toDecimals(rest - out[i], decimals); });
    return out;
  };
  const bundleIndices = eligible("bundleEligible");
  const bundle = toDecimals(bundleIndices.reduce((n, i) => n + lines[i].amount, 0) * (bundlePct / 100), decimals);
  const bundleParts = allocate(bundle, bundleIndices, lines.map(l => l.amount));
  const afterBundle = lines.map((l, i) => toDecimals(l.amount - bundleParts[i], decimals));
  const couponIndices = eligible("couponEligible");
  const couponBase = toDecimals(couponIndices.reduce((n, i) => n + afterBundle[i], 0), decimals);
  let couponOff = 0, couponError = null;
  if (coupon) {
    if (coupon.kind === "percent") couponOff = toDecimals(couponBase * (coupon.value / 100), decimals);
    else if (coupon.amounts?.[currency] != null) couponOff = Math.min(couponBase, coupon.amounts[currency]);
    else couponError = "coupon_currency";
  }
  couponOff = Math.min(couponBase, couponOff);
  const couponParts = allocate(couponOff, couponIndices, afterBundle);
  const lineAmounts = lines.map((l, i) => {
    const discounted = Math.max(0, toDecimals(afterBundle[i] - couponParts[i], decimals));
    const amount = toDecimals(discounted * (l.prorationFactor ?? prorationFactor), decimals);
    return { bundleDiscount: bundleParts[i], couponDiscount: couponParts[i], discounted, credit: l.credit ?? 0, prorated: toDecimals(amount - (l.credit ?? 0), decimals) };
  });
  const due = toDecimals(lineAmounts.reduce((n, l) => n + l.prorated, 0), decimals);
  const prorated = Math.max(0, due);
  const creditRemaining = Math.max(0, -due);
  let taxAmount = 0, total = prorated, net = prorated;
  if (tax?.rate) {
    if (tax.inclusive) { net = toDecimals(prorated / (1 + tax.rate / 100), decimals); taxAmount = toDecimals(prorated - net, decimals); }
    else { taxAmount = toDecimals(prorated * (tax.rate / 100), decimals); total = toDecimals(prorated + taxAmount, decimals); }
  }
  return { currency, subtotal: sub, bundleDiscount: bundle, couponDiscount: couponOff, couponError, prorated, net, tax: taxAmount, total, creditRemaining, lineAmounts };
}

module.exports = { roundStep, toDecimals, rate, zoneOf, resolveUnit, resolveLine, resolveWorkspaceLine, proration, periodDays, monthlyAmount, taxForWorkspace, totals };
