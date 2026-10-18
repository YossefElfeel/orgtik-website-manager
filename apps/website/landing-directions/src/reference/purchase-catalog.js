import { SERVICE_FAMILIES } from "./service-catalog.js";
import { SOFTWARE_PRODUCTS } from "./software-catalog.js";
import { publicRequest, purchaseContextKey } from "./purchase-platform.js";

export const MONTHS = [1, 3, 6, 12];
export const HOSTING_URL = "https://orgtik.ch";
export const CRM_PORTAL_URL = import.meta.env?.VITE_CRM_PORTAL_URL || "";
export const TERM_SAVINGS = { 1: 0, 3: 5, 6: 10, 12: 15 };
const serviceNames = {
  "design/graphic-design": "Graphic design",
  "design/brand-development": "Branding",
  "design/web-and-app-design": "Web & app design",
  "development/web-development": "Web development",
  "development/custom-app-development": "Custom app development",
  "marketing/social-media-marketing": "Social media",
  "marketing/digital-advertising-switzerland": "Advertising management",
  "marketing/seo-services": "SEO",
  "it-support/website-management": "Website management",
  "it-support/software-support": "Software support",
};
export const CATALOG = [
  ...SERVICE_FAMILIES.filter((f) => f.slug !== "hosting")
    .flatMap((f) =>
      f.children.map((c) => ({
        id: `${f.slug}/${c.slug}`,
        kind: "service",
        department: f.slug,
        departmentName: f.short,
        name: serviceNames[`${f.slug}/${c.slug}`] || c.name,
        description: c.summary,
        capabilities: c.capabilities,
        icon: f.icon,
      })),
    )
    .map((item) => ({ ...item, monthlyMinor: null })),
  ...SOFTWARE_PRODUCTS.map((p) => ({
    id: p.id,
    kind: "software",
    department: p.category.toLowerCase(),
    departmentName: p.category,
    name: p.formal,
    description: p.short,
    capabilities: p.tasks,
    icon: p.icon,
    monthlyMinor: null,
  })),
];
const BASE_PRESENTATION = new Map(CATALOG.map(item => [item.id, { ...item }]));
const bundle = (id, kind, department, name, ids, why, recommended = false) => ({
  id,
  kind,
  department,
  name,
  ids,
  why,
  recommended,
});
const BUNDLE_PRESENTATION = [
  bundle(
    "brand-presence",
    "service",
    "design",
    "Brand Presence",
    ["design/graphic-design", "design/brand-development"],
    "Connect your identity with the materials people see every day.",
    true,
  ),
  bundle(
    "digital-experience",
    "service",
    "design",
    "Digital Experience",
    ["design/graphic-design", "design/web-and-app-design"],
    "Bring your visual communications and digital interfaces together.",
  ),
  bundle(
    "complete-design",
    "service",
    "design",
    "Complete Design",
    [
      "design/graphic-design",
      "design/brand-development",
      "design/web-and-app-design",
    ],
    "One connected selection for identity, communication, and digital experiences.",
  ),
  bundle(
    "product-build",
    "service",
    "development",
    "Product Build",
    ["development/web-development", "development/custom-app-development"],
    "Coordinate website and application development in one roadmap.",
    true,
  ),
  bundle(
    "search-social",
    "service",
    "marketing",
    "Search & Social",
    ["marketing/seo-services", "marketing/social-media-marketing"],
    "Connect search visibility with a consistent social presence.",
    true,
  ),
  bundle(
    "campaign-growth",
    "service",
    "marketing",
    "Campaign Growth",
    [
      "marketing/social-media-marketing",
      "marketing/digital-advertising-switzerland",
    ],
    "Plan social content and paid campaigns together. Media spend is separate.",
  ),
  bundle(
    "complete-marketing",
    "service",
    "marketing",
    "Complete Marketing",
    [
      "marketing/seo-services",
      "marketing/social-media-marketing",
      "marketing/digital-advertising-switzerland",
    ],
    "Connect search, social, and paid campaign management. Media spend is separate.",
  ),
  bundle(
    "digital-care",
    "service",
    "it-support",
    "Digital Care",
    ["it-support/website-management", "it-support/software-support"],
    "Keep your website and existing software supported together.",
    true,
  ),
  bundle(
    "team-workspace",
    "software",
    "operations",
    "Team Workspace",
    ["hr", "tasks", "files"],
    "Bring your people, projects, and documents into one workspace.",
    true,
  ),
  bundle(
    "sales-marketing",
    "software",
    "growth",
    "Sales & Marketing",
    ["crm", "marketing", "website"],
    "Connect customer relationships, campaigns, and website work.",
  ),
  bundle(
    "business-suite",
    "software",
    "all",
    "Business Suite",
    ["hr", "crm", "files", "tasks", "marketing", "website"],
    "All six products for a connected business workspace.",
  ),
];
export let BUNDLES = BUNDLE_PRESENTATION;
export const findItem = (id, kind) =>
  CATALOG.find((x) => x.id === id && (!kind || x.kind === kind));
export const findBundle = (id) => BUNDLES.find((x) => x.id === id);
const pricingListeners = new Set();
let pricing = {
  status: "idle",
  version: 0,
  currency: null,
  decimals: null,
  items: [],
  error: null,
};
let loadedContext = null;
let loading = null;
const updatePricing = (value) => {
  pricing = { ...value, version: pricing.version + 1 };
  pricingListeners.forEach((listener) => listener());
};
export const getPricingSnapshot = () => pricing;
export const subscribePricing = (listener) => {
  pricingListeners.add(listener);
  return () => pricingListeners.delete(listener);
};
export function installPublicCatalog(data, { locale = typeof document === "undefined" ? "en" : document.documentElement.lang || "en" } = {}) {
  if (
    !data?.currency ||
    !Number.isInteger(data.decimals) ||
    !Array.isArray(data.items)
  )
    throw new Error("invalid_catalog");
  for (const item of CATALOG) {
    const priced = data.items.find(
      (row) => row.id === item.id && row.kind === item.kind,
    );
    Object.assign(item, BASE_PRESENTATION.get(item.id));
    item.monthlyMinor = priced?.monthlyMinor ?? null;
    const localized = value => value?.[locale] ?? value?.en;
    if (item.kind === "service" && localized(priced?.names)) item.name = localized(priced.names);
    if (localized(priced?.descriptions)) item.description = localized(priced.descriptions);
    if (Array.isArray(localized(priced?.capabilities))) item.capabilities = [...localized(priced.capabilities)];
    if (priced?.department) item.department = priced.department;
    if (localized(priced?.departmentNames)) item.departmentName = localized(priced.departmentNames);
    if (priced?.icon) item.icon = priced.icon;
  }
  // This shared picker serves service and software groups. Its advertised saving is the
  // guaranteed minimum for either kind; exact per-line savings remain server-priced.
  for (const months of MONTHS) {
    const software = data.policy?.durationSavings?.[months] ?? ({ 1: 0, 3: 5, 6: 10, 12: 15 })[months];
    TERM_SAVINGS[months] = Math.min(software, data.policy?.serviceDurationSavings?.[months] ?? software);
  }
  BUNDLES = BUNDLE_PRESENTATION.flatMap(bundle => {
    const available = data.bundles?.find(row => row.id === bundle.id && row.kind === bundle.kind);
    if (!available) return [];
    const localized = value => typeof value === "string" ? value : value?.[locale] ?? value?.en;
    const name = localized(available.name) || bundle.name, why = localized(available.why) || bundle.why, recommended = available.recommended ?? bundle.recommended;
    const ids = available.ids && (available.ids.length !== bundle.ids.length || available.ids.some((id, index) => id !== bundle.ids[index])) ? available.ids : bundle.ids;
    return name === bundle.name && why === bundle.why && recommended === bundle.recommended && ids === bundle.ids ? [bundle] : [{ ...bundle, name, why, ids, recommended }];
  });
  updatePricing({ ...data, status: "ready", error: null });
  return pricing;
}
export async function loadPublicCatalog({ force = false } = {}) {
  const context = purchaseContextKey();
  if (!force && loadedContext === context && pricing.status === "ready")
    return pricing;
  if (loading?.context === context)
    return force
      ? loading.promise.then(() => loadPublicCatalog({ force: true }))
      : loading.promise;
  for (const item of CATALOG) item.monthlyMinor = null;
  updatePricing({
    status: "loading",
    currency: null,
    decimals: null,
    items: [],
    error: null,
  });
  const promise = publicRequest("/catalog")
    .then((data) => {
      if (purchaseContextKey() !== context) return null;
      loadedContext = context;
      return installPublicCatalog(data);
    })
    .catch((error) => {
      if (purchaseContextKey() === context)
        updatePricing({
          status: "error",
          currency: null,
          decimals: null,
          items: [],
          error: error.code || "unavailable",
        });
      return null;
    })
    .finally(() => {
      if (loading?.promise === promise) loading = null;
    });
  loading = { context, promise };
  return promise;
}
export const currencyScale = (context) =>
  10 ** (context?.decimals ?? pricing.decimals ?? 2);
export const money = (minor, context = pricing) => {
  if (
    !Number.isFinite(minor) ||
    !context?.currency ||
    !Number.isInteger(context.decimals)
  )
    return "—";
  const places = context.decimals;
  return `${context.currency} ${new Intl.NumberFormat("de-CH", { minimumFractionDigits: places > 2 || minor % currencyScale(context) ? places : 0, maximumFractionDigits: places }).format(minor / currencyScale(context))}`;
};
export const termLabel = (months) =>
  months ? `${months} month${months === 1 ? "" : "s"}` : "Choose duration";
export const countSaving = (count, kind = "service") =>
  ((kind === "service" ? pricing.policy?.serviceCountBands : null) ?? pricing.policy?.countBands ?? []).filter((band) => count >= band.min).at(-1)
    ?.saving ?? 0;
let sequence = 0;
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `group-${Date.now()}-${++sequence}`;
export function createGroup(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const kind = input.kind === "software" ? "software" : "service";
  const defaultMonths = MONTHS.includes(Number(input.defaultMonths))
    ? Number(input.defaultMonths)
    : 1;
  const ids = new Set();
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .filter((line) => {
      if (!line || !findItem(line.catalogId, kind) || ids.has(line.catalogId))
        return false;
      ids.add(line.catalogId);
      return true;
    })
    .slice(0, 30)
    .map((line) => ({
      catalogId: line.catalogId,
      months: MONTHS.includes(Number(line.months)) ? Number(line.months) : null,
      autoRenew: line.autoRenew === true,
    }));
  const template = findBundle(input.bundleId);
  return {
    id: typeof input.id === "string" ? input.id.slice(0, 120) : newId(),
    kind,
    bundleId: template?.kind === kind ? template.id : null,
    defaultMonths,
    lines,
    needsReview: input.needsReview === true,
  };
}
export function groupFromIds(kind, ids, months = 1, bundleId = null) {
  return createGroup({
    kind,
    bundleId,
    defaultMonths: months,
    lines: ids.map((catalogId) => ({ catalogId, months, autoRenew: false })),
  });
}
export function groupName(group) {
  const template = findBundle(group.bundleId);
  const exact =
    template &&
    template.ids.length === group.lines.length &&
    template.ids.every((id) => group.lines.some((l) => l.catalogId === id));
  if (exact) return template.name;
  if (template) return `${template.name} · customized`;
  if (group.lines.length === 1)
    return findItem(group.lines[0].catalogId, group.kind)?.name || "Package";
  return group.kind === "software"
    ? "Custom software plan"
    : "Custom service plan";
}
export const groupTerm = (group) =>
  new Set(group.lines.map((l) => l.months)).size > 1
    ? "Mixed durations"
    : termLabel(group.lines[0]?.months);
export function quoteGroup(group) {
  const normalized = createGroup(group);
  const count = normalized.lines.length;
  const band = count >= 5 ? 5 : count >= 3 ? 3 : count >= 2 ? 2 : 1;
  const lines = normalized.lines.map((line) => {
    const item = findItem(line.catalogId, normalized.kind);
    const priced = pricing.items.find(
      (row) => row.id === line.catalogId && row.kind === normalized.kind,
    )?.prices?.[line.months]?.[band];
    return {
      ...(priced ?? {
        subtotal: null,
        total: null,
        saving: null,
        monthlyEquivalent: null,
        discount: null,
        reason: null,
      }),
      ...line,
      name: item.name,
      kind: item.kind,
      monthlyMinor: item.monthlyMinor,
    };
  });
  const sum = (key) =>
    lines.every((line) => Number.isFinite(line[key]))
      ? lines.reduce((n, line) => n + line[key], 0)
      : null;
  return {
    lines,
    subtotal: sum("subtotal"),
    total: sum("total"),
    saving: sum("saving"),
    monthlyEquivalent: sum("monthlyEquivalent"),
    valid:
      lines.length > 0 &&
      pricing.status === "ready" &&
      lines.every((line) => Number.isFinite(line.total)) &&
      lines.every((l) => MONTHS.includes(l.months)) &&
      !normalized.needsReview,
  };
}
export function quoteCart(groups) {
  const quotes = groups.map(quoteGroup);
  const ids = quotes.flatMap((q) => q.lines.map((l) => l.catalogId));
  const sum = (key) =>
    quotes.every((quote) => Number.isFinite(quote[key]))
      ? quotes.reduce((n, quote) => n + quote[key], 0)
      : null;
  return {
    subtotal: sum("subtotal"),
    saving: sum("saving"),
    total: sum("total"),
    monthlyEquivalent: sum("monthlyEquivalent"),
    valid:
      groups.length > 0 &&
      quotes.every((q) => q.valid) &&
      new Set(ids).size === ids.length,
  };
}
export function groupFingerprint(group) {
  return JSON.stringify([
    group.kind,
    group.lines
      .map((l) => [l.catalogId, l.months, l.autoRenew])
      .sort((a, b) => a[0].localeCompare(b[0])),
  ]);
}
export function configurationHref(group) {
  const params = new URLSearchParams({
    [group.kind === "software" ? "modules" : "services"]: group.lines
      .map((l) => l.catalogId)
      .join(","),
    duration: String(group.defaultMonths),
  });
  if (group.bundleId) params.set("bundle", group.bundleId);
  params.set(
    "terms",
    group.lines.map((l) => `${l.catalogId}:${l.months || ""}`).join(","),
  );
  if (group.lines.some((l) => l.autoRenew))
    params.set(
      "renew",
      group.lines
        .filter((l) => l.autoRenew)
        .map((l) => l.catalogId)
        .join(","),
    );
  return `/${group.kind === "software" ? "software" : "services"}?${params}#${group.kind === "software" ? "plan-builder" : "svc-builder"}`;
}
export function groupFromLocation(kind, location) {
  const params = new URLSearchParams(location.search);
  let ids = (
    params.get(kind === "software" ? "modules" : "services") ||
    (kind === "software" ? params.get("module") : "") ||
    ""
  )
    .split(",")
    .filter((id) => findItem(id, kind));
  if (!ids.length && kind === "software") {
    const presets = {
      operations: ["hr", "tasks", "files"],
      growth: ["crm", "marketing", "website"],
      complete: ["hr", "crm", "files", "tasks", "marketing", "website"],
      suite: ["hr", "crm", "files", "tasks", "marketing", "website"],
    };
    ids = presets[params.get("mode")] || [];
  }
  if (
    !ids.length &&
    kind === "software" &&
    location.hash.startsWith("#/plans/")
  )
    ids = location.hash
      .split("/")
      .at(-1)
      .split(",")
      .filter((id) => findItem(id, kind));
  const template = findBundle(params.get("bundle"));
  if (!ids.length && template?.kind === kind) ids = template.ids;
  const raw =
    params.get("duration") ||
    (kind === "software" && location.hash.startsWith("#/plans/")
      ? location.hash.split("/")[3]
      : null);
  const months =
    raw === null
      ? 1
      : raw === "annual"
        ? 12
        : raw === "monthly"
          ? 1
          : Number(raw);
  const group = groupFromIds(
    kind,
    ids,
    MONTHS.includes(months) ? months : 1,
    template?.id,
  );
  const terms = new Map(
    (params.get("terms") || "").split(",").map((part) => {
      const pos = part.lastIndexOf(":");
      return [part.slice(0, pos), Number(part.slice(pos + 1))];
    }),
  );
  const renew = new Set((params.get("renew") || "").split(","));
  group.lines = group.lines.map((line) => ({
    ...line,
    months: terms.has(line.catalogId)
      ? MONTHS.includes(terms.get(line.catalogId))
        ? terms.get(line.catalogId)
        : null
      : MONTHS.includes(months)
        ? months
        : null,
    autoRenew: renew.has(line.catalogId),
  }));
  return group;
}
export function migrateLegacy(items) {
  const messages = new Set();
  const seen = new Set();
  const groups = [];
  for (const old of Array.isArray(items) ? items : []) {
    if (!old || !["service", "software"].includes(old.kind)) continue;
    const months =
      old.termId === "biennial"
        ? 24
        : old.termId === "annual"
          ? 12
          : old.termId === "monthly"
            ? 1
            : Number(old.commitmentMonths);
    const ids = (old.selections || [])
      .flatMap((s) => {
        const family = SERVICE_FAMILIES.find((f) => f.slug === s.id);
        return family
          ? family.children.map((c) => `${family.slug}/${c.slug}`)
          : [s.id];
      })
      .filter((id) => {
        if (String(id).startsWith("hosting")) {
          messages.add(
            "Hosting is purchased on the external OrgTik website and was removed from this cart.",
          );
          return false;
        }
        if (!findItem(id, old.kind)) {
          messages.add(
            "An unavailable item was removed. Review your saved selection.",
          );
          return false;
        }
        if (seen.has(`${old.kind}:${id}`)) {
          messages.add(
            "Overlapping saved selections were combined. Review their durations.",
          );
          return false;
        }
        seen.add(`${old.kind}:${id}`);
        return true;
      });
    if (!ids.length) continue;
    const group = groupFromIds(
      old.kind,
      ids,
      MONTHS.includes(months) ? months : 1,
    );
    group.needsReview = true;
    if (!MONTHS.includes(months) || old.billing === "project")
      group.lines.forEach((line) => {
        line.months = null;
      });
    groups.push(group);
  }
  if (groups.length)
    messages.add(
      "Packages and prices have changed. Review each saved group and confirm its scope before checkout.",
    );
  return { groups, messages: [...messages] };
}
