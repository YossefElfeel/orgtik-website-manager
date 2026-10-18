// Bridges cart items and the service/software catalogues so every surface agrees.
import {
  PLAN_IDS,
  formatPlanPrice,
  isPlanId,
  planBilling,
  planIdFromLabel,
  planName,
  planSubtitle,
} from "./plan-ladder.js";
import {
  getServiceEntry,
  getServicePlanAdditions,
  getServicePlanFeatures,
  getServicePlanMatrix,
  getServicePlanScope,
  nameServiceSelection,
  priceServices,
  recommendServicePlan,
  resolveServiceIds,
  SERVICE_FAMILIES,
} from "./service-catalog.js";
import {
  getSoftwarePlanAdditions,
  getSoftwarePlanFeatures,
  getSoftwarePlanMatrix,
  getSoftwareProduct,
  getSoftwareTerm,
  getSoftwareTermByMonths,
  nameSoftwareSelection,
  priceSoftware,
  recommendSoftwarePlan,
  resolveSoftwareIds,
  SOFTWARE_TERMS,
} from "./software-catalog.js";
import { SERVICE_DURATIONS, getServiceDuration } from "./service-duration.js";

const isFamilySlug = (id) => SERVICE_FAMILIES.some((f) => f.slug === id);

// Only price selections the catalogue fully recognises.
export function resolveSelection(kind, ids) {
  if (!Array.isArray(ids) || !ids.length) return null;
  if (kind === "software") {
    const list = resolveSoftwareIds(ids);
    return list.length === new Set(ids).size ? list : null;
  }
  if (!ids.every((id) => isFamilySlug(id) || getServiceEntry(id))) return null;
  const list = resolveServiceIds(ids);
  return list.length ? list : null;
}

export function selectionName(kind, id) {
  return kind === "software"
    ? getSoftwareProduct(id)?.formal || id
    : getServiceEntry(id)?.c.name || id;
}

export function nameSelection(kind, ids) {
  return kind === "software"
    ? nameSoftwareSelection(ids)
    : nameServiceSelection(ids);
}

export function priceSelection(kind, ids, planId, termId) {
  return kind === "software"
    ? priceSoftware(ids, planId, termId)
    : priceServices(ids, planId);
}

export function recommendPlan(kind, ids) {
  return kind === "software"
    ? recommendSoftwarePlan(ids)
    : recommendServicePlan(ids);
}

export function getPlanFeatures(kind, planId, ids) {
  return kind === "software"
    ? getSoftwarePlanFeatures(planId, ids)
    : getServicePlanFeatures(planId, ids);
}

export function getPlanAdditions(kind, planId, ids) {
  return kind === "software"
    ? getSoftwarePlanAdditions(planId, ids)
    : getServicePlanAdditions(planId, ids);
}

export function getPlanMatrix(kind, ids, termId) {
  return kind === "software"
    ? getSoftwarePlanMatrix(ids, termId)
    : getServicePlanMatrix(ids);
}

export function getPlanScope(planId, ids) {
  return getServicePlanScope(planId, ids);
}

export function softwareTermFrom(input) {
  if (SOFTWARE_TERMS.some((term) => term.id === input.termId))
    return getSoftwareTerm(input.termId);
  const byLabel = SOFTWARE_TERMS.find((term) => term.label === input.duration);
  return (
    byLabel ||
    getSoftwareTermByMonths(input.commitmentMonths) ||
    getSoftwareTerm("monthly")
  );
}

// A chosen commitment is a valid "N months" label; legacy labels mean "not chosen".
export function serviceCommitmentFrom(input) {
  const months = Number(input.commitmentMonths);
  return SERVICE_DURATIONS.includes(months) &&
    input.duration === getServiceDuration(months).label
    ? months
    : null;
}

export function builderHref(kind, ids, planId, period) {
  const params = new URLSearchParams();
  if (kind === "software") {
    params.set("modules", ids.join(","));
    params.set("plan", planId);
    params.set("duration", period || "annual");
    return `/software?${params.toString().replaceAll("%2C", ",")}#plan-builder`;
  }
  params.set("services", ids.join(","));
  params.set("plan", planId);
  if (planId === "ongoing" && period) params.set("duration", period);
  return `/services?${params.toString().replaceAll("%2C", ",").replaceAll("%2F", "/")}#svc-builder`;
}

// Turn a sanitised cart entry into a priced plan item. Unknown selections keep their saved values.
export function normalizePlanItem(item, input = item) {
  const legacyPlanId =
    (isPlanId(input.planId) && input.planId) || planIdFromLabel(input.plan);
  const planId =
    legacyPlanId ||
    (item.kind === "service" && item.billing === "monthly"
      ? "ongoing"
      : "starter");
  const ids = resolveSelection(
    item.kind,
    item.selections.map((entry) => entry.id),
  );
  const next = { ...item, planId, plan: planName(planId) };
  if (!ids) return next;
  next.selections = ids.map((id) => ({
    id,
    name: selectionName(item.kind, id),
  }));
  next.name = nameSelection(item.kind, ids);
  if (item.kind === "software") {
    const term = softwareTermFrom(input);
    const price = priceSoftware(ids, planId, term.id);
    Object.assign(next, {
      termId: term.id,
      duration: term.label,
      commitmentMonths: term.months,
      billing: "monthly",
      estimate: price.estimate,
      listPrice: price.listPrice,
      sourceHref: builderHref("software", ids, planId, term.id),
    });
    return next;
  }
  const price = priceServices(ids, planId);
  const months = planId === "ongoing" ? serviceCommitmentFrom(input) : null;
  Object.assign(next, {
    duration: months ? getServiceDuration(months).label : "",
    commitmentMonths: months || 1,
    billing: planBilling("service", planId),
    estimate: price.estimate,
    listPrice: price.subtotal,
    sourceHref: builderHref("service", ids, planId, months),
  });
  delete next.termId;
  return next;
}

// The three plans for a cart item, priced for its exact selection and period.
export function getItemPlanOptions(item) {
  const ids = item.selections.map((entry) => entry.id);
  const current = priceSelection(item.kind, ids, item.planId, item.termId);
  return PLAN_IDS.map((planId) => {
    const price = priceSelection(item.kind, ids, planId, item.termId);
    const billing =
      item.kind === "software" ? "monthly" : planBilling("service", planId);
    return {
      planId,
      name: planName(planId),
      subtitle: planSubtitle(item.kind, planId),
      estimate: price.estimate,
      billing,
      delta:
        billing === item.billing ? price.estimate - current.estimate : null,
    };
  });
}

// Columns and rows for the shared comparison table.
export function getPlanComparison(
  kind,
  ids,
  { termId, currentPlanId = null, recommendedPlanId } = {},
) {
  const list =
    kind === "software" ? resolveSoftwareIds(ids) : resolveServiceIds(ids);
  const recommended =
    recommendedPlanId === undefined
      ? recommendPlan(kind, list)?.planId
      : recommendedPlanId;
  const plans = PLAN_IDS.map((planId) => {
    const price = priceSelection(kind, list, planId, termId);
    const billing =
      kind === "software" ? "monthly" : planBilling("service", planId);
    const { amount, unit } = formatPlanPrice(kind, billing, price.estimate);
    const scope =
      kind === "software"
        ? price.term.months > 1
          ? `${price.term.label} term`
          : "no term"
        : list.length > 1
          ? `${list.length} services`
          : "";
    return {
      planId,
      name: planName(planId),
      subtitle: planSubtitle(kind, planId),
      price: amount,
      unit: [unit, scope].filter(Boolean).join(" · "),
      estimate: price.estimate,
      billing,
      recommended: planId === recommended,
      current: planId === currentPlanId,
    };
  });
  return { plans, groups: getPlanMatrix(kind, list, termId) };
}

// "What you get" for a cart item, grouped for display.
export function getItemIncludes(item) {
  const ids = resolveSelection(
    item.kind,
    item.selections.map((entry) => entry.id),
  );
  if (!ids) return null;
  if (item.kind === "software") {
    const features = getSoftwarePlanFeatures(item.planId, ids);
    return [
      {
        title: ids.length === 1 ? "Full product" : "Full products",
        items: ids.map((id) => {
          const product = getSoftwareProduct(id);
          return `${product.formal}: ${product.tasks.join(", ")}`;
        }),
      },
      {
        title: "Setup and support",
        items: features.slice(ids.length),
      },
    ];
  }
  const scope = getServicePlanScope(item.planId, ids);
  return [
    ...scope.services.map((service) => ({
      title: service.name,
      tag: service.department,
      items: service.included,
      excluded: service.excluded,
    })),
    { title: "How it runs", items: scope.extras },
  ];
}

export function getItemRecommendation(item) {
  return recommendPlan(
    item.kind,
    item.selections.map((entry) => entry.id),
  );
}
