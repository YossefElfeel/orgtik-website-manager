const crypto = require("node:crypto");
const { offers, bundles } = require("./seed-website-offers");
const { advance } = require("./lifecycle");
const MONTHS = [1, 3, 6, 12], BANDS = [1, 2, 3, 5], DURATION = { 1: 0, 3: 5, 6: 10, 12: 15 };
const QUOTE_TTL = 15 * 60 * 1000, DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const error = (status, code, message) => Object.assign(new Error(message), { status, code });
const countSaving = count => count >= 5 ? 15 : count >= 3 ? 10 : count >= 2 ? 5 : 0;

function registerCatalog(S) {
  S.db.websiteOffers ??= clone(offers);
  S.db.websiteOfferBundles ??= clone(bundles);
  S.db.publicWebsiteQuotes ??= [];
  S.db.publicWebsiteOrders ??= [];
  S.db.websiteOrderLinks ??= [];
  for (const offer of S.db.websiteOffers.filter(row => row.serviceId)) {
    if (!S.db.services.some(row => row.id === offer.serviceId)) S.db.services.push({ id: offer.serviceId, family: offer.id.includes("/") ? offer.id.split("/")[0] : "it-support", kind: "package", billing: "monthly", name: clone(offer.name), status: "active", websiteCatalogId: offer.id, deliveryDays: 30, milestones: ["Onboarding", "Delivery review"] });
    if (!S.db.plans.some(row => row.id === offer.serviceId)) {
      const chfRate = S.pricing.rate(S.db, "USD", "CHF");
      if (!(chfRate > 0)) throw error(503, "price_unavailable", "The service seed's platform CHF rate is unavailable.");
      S.db.plans.push({ id: offer.serviceId, tool: null, service: true, tier: "pro", name: clone(offer.name), perUser: false, minSeats: 1, yearlyDiscountPct: 0, visibility: "public", status: "active", limits: {}, flags: {}, defaultUsd: { monthly: offer.monthlyCHF / chfRate }, websiteCatalogId: offer.id });
      S.db.countries.CH.fixed ??= {};
      S.db.countries.CH.fixed[`${offer.serviceId}:monthly`] ??= offer.monthlyCHF;
    }
  }
  return S.db.websiteOffers;
}

function fixtureControls(ctx) {
  return (!ctx.config?.hosted && !process.env.VERCEL) || process.env.MOCK_SANDBOX === "preview";
}

function resolveRegion(req, ctx, S) {
  const token = ctx.identity.tokenFrom?.(req) || req.get("authorization");
  const user = ctx.identity.userFromReq(req);
  if (token && !user) throw error(401, "unauthenticated", "Sign in again before requesting workspace prices.");
  if (user) {
    const claims = ctx.identity.decode?.(ctx.identity.tokenFrom?.(req)) || {};
    const selected = req.workspaceContext?.workspaceId || req.p?.ws?.id || req.get("x-workspace") || claims.workspaceId || claims.ws;
    const mine = S.db.workspaces.filter(ws => !["deleted", "cancelled"].includes(ws.state) && ws.members.some(member => member.userKey === user.key && member.status === "active"));
    const ws = selected ? mine.find(row => row.id === selected) : mine[0];
    if (!ws) throw error(403, "no_workspace", "Choose an active workspace you belong to.");
    const country = ws.billing?.country || ws.country;
    return { workspace: { ...ws, country }, buyerKey: user.key, role: ws.members.find(member => member.userKey === user.key && member.status === "active").role, readOnly: Boolean(claims.readOnly), region: { country, currency: ws.currency, source: "workspace", workspaceId: ws.id } };
  }
  const override = fixtureControls(ctx) ? req.get("x-mock-country") : null;
  const wanted = String(override || process.env.MOCK_VISITOR_COUNTRY || "CH").toUpperCase();
  const country = S.db.countries[wanted] ? wanted : "CH";
  const currency = S.db.countries[country]?.currency;
  if (!currency) throw error(503, "region_unavailable", "The mock visitor billing region is unavailable.");
  return { workspace: { country, currency, billing: { country }, members: [], lines: [] }, buyerKey: null, region: { country, currency, source: country !== wanted ? "fallback" : override ? "mock-override" : process.env.MOCK_VISITOR_COUNTRY ? "mock-detection" : "fallback" } };
}

function priceBase(S, offer, workspace) {
  const currency = workspace.currency, decimals = S.db.currencies[currency]?.decimals;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3 || S.db.currencies[currency].active === false) throw error(503, "currency_unavailable", "This billing currency is unavailable.");
  const planId = offer.planId || offer.serviceId;
  const plan = S.db.plans.find(row => row.id === planId && row.status === "active" && row.visibility === "public" && !row.private && !row.workspaceId);
  const tool = offer.tool && S.db.tools.find(row => row.key === offer.tool);
  const service = offer.serviceId && S.db.services.find(row => row.id === offer.serviceId);
  if (!plan || offer.tool && (!tool || !["live", "beta"].includes(tool.status)) || offer.serviceId && service?.status !== "active") throw error(409, "offer_unavailable", "This public offer is unavailable.");
  const quantity = offer.tool ? S.purchasedSeats(workspace, offer.tool, planId) : 1;
  const resolved = S.resolveForWorkspace(planId, workspace, "monthly", quantity);
  if (!resolved || resolved.currency !== currency) throw error(503, "price_unavailable", "No platform price is available in this currency.");
  return { currency, decimals, monthly: resolved.amount, unit: resolved.unit, quantity: resolved.quantity, perUser: Boolean(plan.perUser), name: clone(tool?.name || offer.name), source: resolved.source, ...(offer.kind === 'service' && S.db.servicePricingPolicy ? { discountPolicy: S.db.servicePricingPolicy } : {}) };
}

function priceLine(base, offer, months, count, autoRenew = false) {
  const duration = base.discountPolicy?.durationSavings?.[months] ?? DURATION[months], countDiscount = base.discountPolicy ? base.discountPolicy.countBands.filter(band => count >= band.min).at(-1)?.saving || 0 : countSaving(count);
  const discount = Math.max(duration, countDiscount);
  const scale = 10 ** base.decimals;
  const subtotal = Math.round((base.monthly * months + Number.EPSILON) * scale);
  const total = Math.round((base.monthly * months * (100 - discount) / 100 + Number.EPSILON) * scale);
  if (![subtotal, total].every(value => Number.isSafeInteger(value) && value >= 0)) throw error(503, "price_unavailable", "This offer cannot be represented safely in its billing currency.");
  return { catalogId: offer.id, kind: offer.kind, name: base.name.en, months, autoRenew, currency: base.currency, decimals: base.decimals, monthlyMinor: Math.round(base.monthly * scale), unitMinor: Math.round(base.unit * scale), quantity: base.quantity, perUser: base.perUser, subtotal, total, saving: subtotal - total, discount, reason: duration >= countDiscount ? "duration" : "bundle", monthlyEquivalent: total / months, fulfillment: offer.fulfillment, ...(offer.planId ? { planId: offer.planId, tool: offer.tool } : { serviceId: offer.serviceId }), source: base.source };
}

function policy(S, resolved) {
  return { id: "website-offers-v1", terms: MONTHS, durationSavings: DURATION, countBands: BANDS.map(min => ({ min, saving: countSaving(min) })), ...(S.db.servicePricingPolicy ? { serviceDurationSavings: clone(S.db.servicePricingPolicy.durationSavings), serviceCountBands: clone(S.db.servicePricingPolicy.countBands) } : {}), tieWinner: "duration", countScope: "group", rounding: "full-period-line-currency-decimals", priceVersion: S.db.priceVersion, tax: S.taxForWorkspace(resolved.workspace) };
}

function publicCatalog(S, resolved) {
  require('../sales/service-catalog').applyScheduled(S);
  const pricingPolicy = policy(S, resolved), currency = resolved.region.currency, decimals = S.db.currencies[currency]?.decimals;
  const available = S.db.websiteOffers.filter(offer => {
    const plan = S.db.plans.find(row => row.id === (offer.planId || offer.serviceId));
    if (!plan || plan.status !== "active" || plan.visibility !== "public" || plan.private || plan.workspaceId) return false;
    return offer.tool ? S.db.tools.some(row => row.key === offer.tool && ["live", "beta"].includes(row.status)) : S.db.services.some(row => row.id === offer.serviceId && row.status === "active");
  });
  return {
    currency, decimals, region: clone(resolved.region), policy: pricingPolicy,
    paymentMethods: ["card", ...(resolved.region.country === "CH" && currency === "CHF" ? ["twint"] : []), "paypal"],
    bundles: clone(S.db.websiteOfferBundles.filter(bundle => bundle.ids.every(id => available.some(offer => offer.id === id)))),
    items: available.map(offer => {
      const base = priceBase(S, offer, resolved.workspace);
      return { id: offer.id, kind: offer.kind, name: base.name.en, names: base.name, fulfillment: offer.fulfillment, managedIn: offer.kind === 'service' ? 'crm' : 'console', ...(offer.description ? { descriptions: clone(offer.description) } : {}), ...(offer.capabilities ? { capabilities: clone(offer.capabilities) } : {}), ...(offer.department ? { department: offer.department } : {}), ...(offer.departmentName ? { departmentNames: clone(offer.departmentName) } : {}), ...(offer.icon ? { icon: offer.icon } : {}), monthlyMinor: Math.round(base.monthly * 10 ** decimals), unitMinor: Math.round(base.unit * 10 ** decimals), quantity: base.quantity, perUser: base.perUser, currency, decimals, prices: Object.fromEntries(MONTHS.map(months => [months, Object.fromEntries(BANDS.map(count => [count, priceLine(base, offer, months, count)]))])) };
    }),
  };
}

function groupsQuote(S, groups, resolved) {
  require('../sales/service-catalog').applyScheduled(S);
  if (!Array.isArray(groups) || !groups.length || groups.length > 20) throw error(422, "invalid_groups", "Choose at least one package.");
  const seen = new Set(), groupIds = new Set();
  const normalized = groups.map(group => {
    if (!group || typeof group.id !== "string" || !group.id || group.id.length > 120 || groupIds.has(group.id) || !["service", "software"].includes(group.kind) || !Array.isArray(group.lines) || !group.lines.length || group.lines.length > 30) throw error(422, "invalid_groups", "Review your package selections.");
    groupIds.add(group.id);
    const lines = group.lines.map(line => {
      const offer = S.db.websiteOffers.find(row => row.id === line?.catalogId && row.kind === group.kind);
      if (!offer || seen.has(offer.id) || !MONTHS.includes(line.months) || (line.autoRenew !== undefined && typeof line.autoRenew !== "boolean")) throw error(422, "invalid_lines", "Review item availability and the four supported durations.");
      seen.add(offer.id);
      return priceLine(priceBase(S, offer, resolved.workspace), offer, line.months, group.lines.length, line.autoRenew === true);
    });
    const preset = S.db.websiteOfferBundles.find(row => row.id === group.bundleId && row.kind === group.kind && row.ids.length === lines.length && row.ids.every(id => lines.some(line => line.catalogId === id)));
    return { id: group.id, kind: group.kind, ...(preset ? { bundleId: preset.id } : {}), name: preset?.name || (lines.length === 1 ? lines[0].name : group.kind === "software" ? "Custom software plan" : "Custom service plan"), lines };
  });
  const lines = normalized.flatMap(group => group.lines), sum = key => lines.reduce((total, line) => total + line[key], 0);
  const tax = S.taxForWorkspace(resolved.workspace), discounted = sum("total");
  const taxAmount = tax.inclusive ? discounted - Math.round(discounted / (1 + tax.rate / 100)) : Math.round(discounted * tax.rate / 100);
  if (![sum("subtotal"), sum("saving"), discounted, taxAmount, discounted + (tax.inclusive ? 0 : taxAmount)].every(Number.isSafeInteger)) throw error(503, "price_unavailable", "The order total cannot be represented safely in its billing currency.");
  return { groups: normalized, quote: { subtotal: sum("subtotal"), saving: sum("saving"), offerTotal: discounted, net: tax.inclusive ? discounted - taxAmount : discounted, tax: taxAmount, taxLabel: tax.label, taxInclusive: tax.inclusive, total: tax.inclusive ? discounted : discounted + taxAmount, monthlyEquivalent: sum("monthlyEquivalent"), valid: true } };
}

function secret(ctx) {
  const value = ctx.websiteOrderSecret || process.env.MOCK_WEBSITE_ORDER_SECRET || process.env.MOCK_HANDOFF_SECRET;
  if (value) return value;
  // Reuse the already-required persistent-store credential with a separate purpose. The
  // credential and derived key never enter an order, log, URL or response; no new setup.
  const storeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (storeToken) return crypto.createHmac("sha256", storeToken).update("orgtik:website-orders:claim-key:v1").digest("hex");
  if (ctx.config?.hosted || process.env.VERCEL) throw error(503, "order_service_unavailable", "The hosted mock persistent order store is unavailable.");
  return value || "orgtik-local-prototype-orders";
}
const opaque = (ctx, label, value) => crypto.createHmac("sha256", secret(ctx)).update(`${label}:${JSON.stringify(value)}`).digest("base64url");
const claimHash = token => crypto.createHash("sha256").update(String(token || "")).digest("hex");
const billingInput = input => {
  const fields = ["name", "legalName", "email", "company", "country", "address", "taxId"];
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.entries(input).some(([key, value]) => !fields.includes(key) || typeof value !== "string")) throw error(422, "invalid_billing_fields", "Use only billing name, email, company, country, address and tax ID. Payment credentials are not accepted.");
  const billing = input;
  const name = String(billing.name || billing.legalName || "").trim(), email = String(billing.email || "").trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error(422, "invalid_billing", "Add your billing name and email.");
  return { name, email, ...(billing.company ? { company: String(billing.company).trim() } : {}), ...(billing.country ? { country: String(billing.country).toUpperCase() } : {}), ...(billing.address ? { address: String(billing.address).trim() } : {}), ...(billing.taxId ? { taxId: String(billing.taxId).trim() } : {}) };
};

// Allocate whole minor units, so the immutable aggregate net/tax remain the ledger authority.
// Start from each line's tax-rate-derived value and distribute the residual by fractional
// remainder (input order breaks ties). This never adds/subtracts tax a second time.
function allocateMinor(values, target) {
  const amounts = values.map(Math.floor), residual = target - amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(target) || residual < 0 || residual > values.length) throw error(409, "order_ledger_mismatch", "The immutable order ledger cannot be reconciled.");
  values.map((value, index) => ({ index, fraction: value - amounts[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).slice(0, residual).forEach(({ index }) => amounts[index]++);
  return { amounts, residual };
}

function invoiceLedger(order) {
  const lines = order.groups.flatMap(group => group.lines), rate = order.policy.tax.rate || 0;
  const quoted = lines.map(line => line.total);
  const net = order.quote.taxInclusive ? allocateMinor(quoted.map(amount => amount / (1 + rate / 100)), order.quote.net) : { amounts: quoted, residual: 0 };
  const tax = order.quote.taxInclusive ? { amounts: quoted.map((amount, index) => amount - net.amounts[index]), residual: 0 } : allocateMinor(net.amounts.map(amount => amount * rate / 100), order.quote.tax);
  if (net.amounts.reduce((sum, amount) => sum + amount, 0) !== order.quote.net || tax.amounts.reduce((sum, amount) => sum + amount, 0) !== order.quote.tax || order.quote.net + order.quote.tax !== order.quote.total) throw error(409, "order_ledger_mismatch", "The immutable order totals cannot be reconciled.");
  const major = amount => amount / 10 ** order.decimals;
  return {
    lines: lines.map((line, index) => ({ label: `${line.name} · ${line.months} months`, catalogId: line.catalogId, quantity: line.quantity, amount: major(net.amounts[index]), quotedAmount: major(line.total), taxAmount: major(tax.amounts[index]), grossAmount: major(net.amounts[index] + tax.amounts[index]) })),
    rounding: { method: "largest-remainder", currencyDecimals: order.decimals, netResidualMinor: net.residual, taxResidualMinor: tax.residual },
  };
}

function createQuote(S, ctx, body, resolved) {
  const priced = groupsQuote(S, body?.groups, resolved), createdAt = S.iso(S.now());
  const quoteId = `wq_${opaque(ctx, "quote", [S.id("wq"), createdAt, resolved.region, priced.groups])}`;
  const quote = freeze({ quoteId, createdAt, expiresAt: S.iso(S.now() + QUOTE_TTL), expiresIn: 900, currency: resolved.region.currency, decimals: S.db.currencies[resolved.region.currency].decimals, region: clone(resolved.region), policy: policy(S, resolved), ...priced, buyerKey: resolved.buyerKey });
  S.db.publicWebsiteQuotes.push(quote);
  const { buyerKey, ...publicQuote } = quote;
  return publicQuote;
}

function confirmOrder(S, ctx, req, resolved) {
  if (["suspended", "cancelled", "deleted"].includes(resolved.workspace?.state)) throw error(423, "workspace_unavailable", "This workspace cannot confirm a payment.");
  if (resolved.readOnly) throw error(403, "read_only", "Payment changes are turned off while viewing as another person.");
  if (resolved.buyerKey && resolved.role !== "owner") throw error(403, "owner_required", "Only the workspace owner can confirm this payment.");
  const b = req.body || {};
  if (Object.keys(b).some(key => !["quoteId", "reference", "paymentMethod", "billing"].includes(key))) throw error(422, "server_quote_required", "Confirm the server quote; browser amounts cannot authorize payment.");
  const reference = String(b.reference || "").trim(), billing = billingInput(b.billing);
  if (!/^[\w][\w.:-]{2,119}$/.test(reference)) throw error(422, "invalid_reference", "Use a valid purchase reference.");
  if (!["card", "twint", "paypal"].includes(b.paymentMethod) || b.paymentMethod === "twint" && (resolved.region.country !== "CH" || resolved.region.currency !== "CHF")) throw error(422, "payment_method_unavailable", "Choose an available simulated payment method.");
  const quote = S.db.publicWebsiteQuotes.find(row => row.quoteId === b.quoteId);
  if (!quote) throw error(404, "quote_not_found", "Refresh your order quote.");
  if (quote.buyerKey && quote.buyerKey !== resolved.buyerKey || quote.region.workspaceId && quote.region.workspaceId !== resolved.region.workspaceId || quote.currency !== resolved.region.currency || quote.region.country !== resolved.region.country || billing.country && billing.country !== quote.region.country) throw error(409, "quote_region_changed", "Refresh the quote for your current billing workspace and region.");
  const fingerprint = claimHash(JSON.stringify([quote.quoteId, b.paymentMethod, billing]));
  const prior = S.db.publicWebsiteOrders.find(row => row.snapshot.reference === reference);
  if (prior) { if (prior.fingerprint !== fingerprint) throw error(409, "reference_conflict", "This reference belongs to another immutable payment attempt."); return clone(prior.snapshot); }
  if (Date.parse(quote.expiresAt) <= S.now()) throw error(410, "quote_expired", "The quote expired. Refresh and review the total before paying.");
  const paymentWs = { country: quote.region.country, currency: quote.currency };
  const gateway = b.paymentMethod === "card" ? S.routeGateways(paymentWs, { method: "card" })[0]?.id : `website-${b.paymentMethod}-mock`;
  if (!gateway) throw error(503, "gateway_unavailable", "No simulated payment route is available for this region.");
  const usdRate = S.usdRate(quote.currency);
  if (!(usdRate > 0)) throw error(503, "payment_rate_unavailable", "The platform USD reporting rate is unavailable.");
  const declined = S.failNext > 0 || fixtureControls(ctx) && req.get("x-mock-payment") === "declined";
  if (S.failNext > 0) S.failNext--;
  const createdAt = S.iso(S.now()), claimToken = declined ? null : opaque(ctx, "claim", [quote.quoteId, reference, fingerprint]);
  const snapshot = freeze({ version: 1, reference, paymentStatus: declined ? "failed" : "succeeded", paymentMethod: b.paymentMethod, createdAt, currency: quote.currency, decimals: quote.decimals, region: clone(quote.region), policy: clone(quote.policy), quoteId: quote.quoteId, groups: quote.groups.map(group => ({ ...clone(group), lines: group.lines.map(line => ({ ...clone(line), activation: line.fulfillment === "tool" ? "awaiting-link" : "awaiting-onboarding" })) })), quote: clone(quote.quote), ...(declined ? { failure: { code: "card_declined", message: "The simulated payment was declined. Nothing was provisioned." } } : { claimToken }) });
  S.db.publicWebsiteOrders.push(freeze({ snapshot, fingerprint, claimHash: claimToken ? claimHash(claimToken) : null, billing, gateway, usdRate, buyerKey: quote.buyerKey }));
  return clone(snapshot);
}

function linkWebsiteOrder(S, { workspace: ws, actor }, body) {
  registerCatalog(S);
  if (!body || Object.keys(body).some(key => !["reference", "claimToken"].includes(key)) || !body.reference || !body.claimToken) throw error(422, "server_order_required", "Link the paid server order using its reference and claim token.");
  const key = actor?.key || actor?.userKey || actor?.user?.key;
  const member = ws?.members.find(row => row.userKey === key && row.status === "active");
  if (!member || !["owner", "admin"].includes(member.role) || actor?.readOnly) throw error(403, "forbidden", "A workspace owner or admin must link the purchase.");
  if (["suspended", "cancelled", "deleted"].includes(ws.state)) throw error(423, "workspace_unavailable", "This workspace cannot activate an order.");
  const stored = S.db.publicWebsiteOrders.find(row => row.snapshot.reference === body.reference), order = stored?.snapshot;
  const presented = claimHash(body.claimToken), validClaim = stored?.claimHash && crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(stored.claimHash));
  if (!validClaim || order.paymentStatus !== "succeeded") throw error(403, "invalid_order_claim", "This paid order cannot be verified.");
  const prior = S.db.websiteOrderLinks.find(row => row.reference === order.reference);
  if (prior) { if (prior.workspaceId !== ws.id) throw error(409, "order_already_linked", "This order belongs to another workspace."); return clone(prior); }
  // A newly registered, unused workspace can establish its first billing region from the
  // verified guest purchase. An existing workspace or paid order is never converted.
  const initialBilling = !order.region.workspaceId && ws.billingInitialized === false && member.role === "owner" && ws.members.length === 1 && ws.lines.every(line => line.planId === "general_free" && line.snapshot.amount === 0) && !S.db.invoices.some(invoice => invoice.workspaceId === ws.id) && !S.db.serviceRequests.some(request => request.workspaceId === ws.id);
  if (!initialBilling && ws.currency !== order.currency || order.region.workspaceId && order.region.workspaceId !== ws.id) throw error(409, "order_currency_mismatch", "The paid order must be linked to its original billing workspace and currency.");
  const lines = order.groups.flatMap(group => group.lines);
  for (const line of lines) if (line.fulfillment === "tool" && !S.db.plans.some(plan => plan.id === line.planId && plan.tool === line.tool) || line.fulfillment === "managed-service" && !S.db.services.some(service => service.id === line.serviceId)) throw error(409, "fulfillment_unavailable", "The paid offer's fulfilment mapping is unavailable.");
  const ledger = invoiceLedger(order);
  if (initialBilling) {
    ws.country = order.region.country; ws.currency = order.currency;
    ws.billing.country = order.region.country; ws.billingInitialized = true;
    for (const line of ws.lines) line.snapshot.currency = order.currency;
  }
  const at = S.iso(S.now()), result = { reference: order.reference, workspaceId: ws.id, at, tools: [], requests: [], skipped: [], invoice: null };
  for (const line of lines) {
    if (line.fulfillment === "tool") {
      const old = ws.lines.find(row => row.tool === line.tool && !["ended", "deleted"].includes(row.state));
      const start = old?.state === "active" && old.planId === line.planId && Date.parse(old.periodEnd) > S.now() ? Date.parse(old.periodEnd) : S.now();
      const term = { reference: order.reference, start: S.iso(start), end: S.iso(start + line.months * 30 * DAY), months: line.months, amount: line.total / 10 ** order.decimals, quantity: line.quantity, autoRenew: line.autoRenew, policy: order.policy.id };
      if (start > S.now()) {
        old.prepaidTerms ??= []; old.prepaidTerms.push(term); old.periodEnd = term.end;
        old.renewalMonths = line.months; old.autoRenew = line.autoRenew;
        result.tools.push({ catalogId: line.catalogId, lineId: old.id, state: "active", termMonths: line.months, quantity: line.quantity });
      } else {
        const id = S.id("ln");
        if (old) Object.assign(old, { state: "ended", endedAt: at, replacedBy: id });
        const purchased = { id, tool: line.tool, planId: line.planId, cycle: line.months === 12 ? "yearly" : "monthly", termMonths: line.months, renewalMonths: line.months, autoRenew: line.autoRenew, state: "active", startedAt: at, periodStart: at, periodEnd: term.end, snapshot: { amount: term.amount, periodAmount: term.amount, monthlyAmount: term.amount / line.months, unit: term.amount / line.quantity, quantity: line.quantity, currency: order.currency, source: "Website server order", priceVersion: order.policy.priceVersion }, source: { kind: "website_order", reference: order.reference, policy: order.policy.id } };
        ws.lines.unshift(purchased); result.tools.push({ catalogId: line.catalogId, lineId: id, state: "active", termMonths: line.months, quantity: line.quantity });
      }
    } else {
      const id = S.id("sr");
      S.db.serviceRequests.push({ id, number: `SR-${210 + S.db.serviceRequests.length + 1}`, workspaceId: ws.id, serviceId: line.serviceId, catalogId: line.catalogId, title: line.name, brief: `Server-paid website order ${order.reference}: ${line.months} months. Onboarding confirms the service period.`, state: "new", createdAt: at, assignee: null, budget: null, deadline: null, quote: null, milestones: [], deliveries: [], messages: [], termMonths: line.months, autoRenew: line.autoRenew, source: { kind: "website_order", reference: order.reference, catalogId: line.catalogId } });
      result.requests.push({ catalogId: line.catalogId, requestId: id, state: "new" });
    }
  }
  const major = minor => minor / 10 ** order.decimals;
  const invoice = { id: S.id("inv"), number: `INV-2026-${String(S.allocateInvoiceNumber?.() ?? 1041 + S.db.invoices.length).padStart(6, "0")}`, workspaceId: ws.id, kind: "website_order", chargeKind: "website_offer", state: "paid", currency: order.currency, issuedAt: at, dueAt: at, paidAt: order.createdAt, reference: order.reference, lines: ledger.lines, rounding: ledger.rounding, subtotal: major(order.quote.net), savings: major(order.quote.saving), taxLabel: order.quote.taxLabel, taxInclusive: order.quote.taxInclusive, taxDisplay: order.quote.taxInclusive ? "inclusive" : "exclusive", taxRate: order.policy.tax.rate, reverseCharge: Boolean(order.policy.tax.reverseCharge), tax: major(order.quote.tax), total: major(order.quote.total), payments: [{ id: S.id("pay"), amount: major(order.quote.total), currency: order.currency, method: order.paymentMethod, gateway: stored.gateway, at: order.createdAt, status: "succeeded", usdRate: stored.usdRate, usdAmount: S.pricing.toDecimals(major(order.quote.total) / stored.usdRate, 2) }], creditNotes: [], refunded: 0 };
  S.db.invoices.push(invoice); result.invoice = { id: invoice.id, number: invoice.number, total: invoice.total, currency: invoice.currency };
  ws.currencyLocked = true;
  ws.billingInitialized = true;
  S.db.websiteOrderLinks.push(freeze(clone(result)));
  S.notifyOwner(ws, "website_order_linked", { title: `Website order ${order.reference} is in your workspace`, reference: order.reference }, `website-order:${order.reference}`);
  S.log(key, "website_order_link", order.reference, { workspaceId: ws.id, paymentStatus: "succeeded" });
  return clone(result);
}

function mountPublicRoutes(app, ctx, S, H) {
  registerCatalog(S);
  const handle = fn => (req, res) => { try { H.ok(res, fn(req)); } catch (e) { if (!e.status) throw e; H.fail(res, e.status, e.code, e.message); } };
  app.get("/v1/public/catalog", handle(req => { if (S.db.workspaceAuthorityVersion !== 1) advance(S); return publicCatalog(S, resolveRegion(req, ctx, S)); }));
  app.post("/v1/public/website-quotes", handle(req => { if (S.db.workspaceAuthorityVersion !== 1) advance(S); return createQuote(S, ctx, req.body, resolveRegion(req, ctx, S)); }));
  app.post("/v1/public/website-orders", handle(req => confirmOrder(S, ctx, req, resolveRegion(req, ctx, S))));
}

module.exports = { registerCatalog, mountPublicRoutes, linkWebsiteOrder, resolveRegion, publicCatalog, groupsQuote, createQuote, confirmOrder, priceLine, MONTHS, BANDS, QUOTE_TTL };
