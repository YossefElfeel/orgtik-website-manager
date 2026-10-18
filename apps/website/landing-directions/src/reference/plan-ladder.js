// One plan ladder for services and software. Prices live in the catalogs.
export const PLAN_IDS = ["starter", "complete", "ongoing"];

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    service: {
      subtitle: "One clear priority per service",
      body: "Start with the most important part of each service, delivered as a defined project.",
    },
    software: {
      subtitle: "Set up and go live",
      body: "We configure everything, launch it with you and hand it over to your team.",
    },
  },
  complete: {
    id: "complete",
    name: "Complete",
    service: {
      subtitle: "The full service on one roadmap",
      body: "Every part of each service, planned and delivered together as one project.",
    },
    software: {
      subtitle: "Setup plus connected workflows",
      body: "Everything in Starter, plus workflows, roles and adoption support around the way you work.",
    },
  },
  ongoing: {
    id: "ongoing",
    name: "Ongoing",
    service: {
      subtitle: "Monthly delivery and support",
      body: "The full service as a steady monthly rhythm, with support and an improvement roadmap.",
    },
    software: {
      subtitle: "Ongoing support and evolution",
      body: "Everything in Complete, plus a regular support rhythm and planned improvements.",
    },
  },
};

const LEGACY_LABELS = {
  starter: "starter",
  focus: "starter",
  essential: "starter",
  launch: "starter",
  complete: "complete",
  connected: "complete",
  ongoing: "ongoing",
  partnership: "ongoing",
};

export function isPlanId(value) {
  return PLAN_IDS.includes(value);
}

export function getPlan(id) {
  return PLANS[id] || null;
}

export function planName(id) {
  return PLANS[id]?.name || "";
}

// Saved carts and links may still use Focus, Essential, Launch plan, Connected or Partnership.
export function planIdFromLabel(label) {
  if (typeof label !== "string") return null;
  const key = label
    .trim()
    .toLowerCase()
    .replace(/\s+plan$/, "");
  return LEGACY_LABELS[key] || null;
}

export function planBilling(kind, planId) {
  return kind === "service" && planId !== "ongoing" ? "project" : "monthly";
}

export function planSubtitle(kind, planId) {
  return PLANS[planId]?.[kind === "software" ? "software" : "service"].subtitle;
}

export function planBody(kind, planId) {
  return PLANS[planId]?.[kind === "software" ? "software" : "service"].body;
}

export function formatCHF(amount) {
  return "CHF " + new Intl.NumberFormat("de-CH").format(amount);
}

// Service prices are "from" estimates; software subscriptions are exact.
export function formatPlanPrice(kind, billing, estimate) {
  if (estimate === null || estimate === undefined)
    return { amount: "On request", unit: "" };
  return {
    amount: `${kind === "service" ? "From " : ""}${formatCHF(estimate)}`,
    unit: billing === "monthly" ? "per month" : "per project",
  };
}
