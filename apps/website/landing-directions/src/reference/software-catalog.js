// Software products, terms, bundles and plan pricing shared by every surface.
export const SOFTWARE_PRODUCTS = [
  {
    id: "hr",
    name: "People",
    formal: "HR",
    icon: "ph-users-three",
    title: "A little less admin. A lot more human.",
    short: "Bring your people and their work together.",
    description:
      "Give people, documents, and everyday processes a clearer place in your business.",
    tasks: ["People & teams", "Leave & onboarding", "Employee documents"],
    category: "Operations",
    number: "01",
    monthlyPrice: 39,
    image: "brand-phone.webp",
    highlights: [
      {
        title: "One people directory",
        body: "Keep roles, teams, contacts, and essential employee information easy to understand.",
      },
      {
        title: "Guided people moments",
        body: "Turn onboarding, leave, and recurring HR requests into clear repeatable flows.",
      },
      {
        title: "Documents with context",
        body: "Connect employee records to the people and decisions they belong to.",
      },
    ],
    useCases: [
      {
        title: "Welcome a new teammate",
        body: "Create the profile, assign the onboarding checklist, and keep the right documents together.",
      },
      {
        title: "Coordinate leave",
        body: "Collect a request, make the decision visible, and keep the team calendar current.",
      },
      {
        title: "Answer a people question",
        body: "Move from the employee record to the policy or document without losing the context.",
      },
    ],
  },
  {
    id: "crm",
    name: "Relationships",
    formal: "CRM",
    icon: "ph-chart-line-up",
    title: "Make the next conversation count.",
    short: "Keep relationships moving forward.",
    description:
      "Organize contacts, understand opportunities, and keep the next action in view.",
    tasks: [
      "Contacts & companies",
      "Pipeline visibility",
      "Follow-ups & activities",
    ],
    category: "Growth",
    number: "02",
    monthlyPrice: 49,
    image: "brand-glass.webp",
    highlights: [
      {
        title: "A shared customer picture",
        body: "Bring contacts, companies, conversations, and ownership into one clear relationship view.",
      },
      {
        title: "A pipeline people can read",
        body: "See opportunity stage, value, confidence, and the next action without reconstructing the story.",
      },
      {
        title: "Follow-ups that stay visible",
        body: "Keep the next conversation connected to the relationship that made it necessary.",
      },
    ],
    useCases: [
      {
        title: "Qualify a new lead",
        body: "Capture the relationship, decide its stage, and assign the next useful action.",
      },
      {
        title: "Review the pipeline",
        body: "Compare active opportunities and focus the team on work that needs attention.",
      },
      {
        title: "Prepare a follow-up",
        body: "Read the recent context, confirm the owner, and schedule the next conversation.",
      },
    ],
  },
  {
    id: "files",
    name: "Files",
    formal: "Files",
    icon: "ph-folder-simple",
    title: "Find the file. Keep the flow.",
    short: "Give your business knowledge a home.",
    description:
      "Bring the documents that matter into a clear, shared structure your team can understand.",
    tasks: [
      "Folders & organization",
      "Document discovery",
      "Sharing workflows",
    ],
    category: "Operations",
    number: "03",
    monthlyPrice: 19,
    image: "brand-cards.webp",
    highlights: [
      {
        title: "A structure people recognize",
        body: "Create a shared filing pattern that reflects how the business actually works.",
      },
      {
        title: "Faster document discovery",
        body: "Use clear labels and useful context to reduce the time spent searching and asking.",
      },
      {
        title: "Sharing with purpose",
        body: "Keep documents connected to the team, project, or customer moment that needs them.",
      },
    ],
    useCases: [
      {
        title: "Build a shared library",
        body: "Turn scattered business documents into a structure the whole team can navigate.",
      },
      {
        title: "Find the current file",
        body: "Use the folder, label, and owner context to reach the right version quickly.",
      },
      {
        title: "Hand work to another team",
        body: "Share the document with its purpose, status, and next action already attached.",
      },
    ],
  },
  {
    id: "tasks",
    name: "Work",
    formal: "Tasks",
    icon: "ph-check-square",
    title: "From a good idea to a job well done.",
    short: "Turn priorities into progress.",
    description:
      "Connect projects, people, and next steps so everyone can see what moves the work forward.",
    tasks: [
      "Project planning",
      "Ownership & priorities",
      "Progress visibility",
    ],
    category: "Operations",
    number: "04",
    monthlyPrice: 25,
    image: "brand-tablet.webp",
    highlights: [
      {
        title: "Priorities in one view",
        body: "Connect projects, milestones, and daily actions without turning the workspace into noise.",
      },
      {
        title: "Ownership people can see",
        body: "Make every next step clear with an owner, status, and useful deadline.",
      },
      {
        title: "Progress with context",
        body: "Review what moved, what is blocked, and what decision will unlock the next stage.",
      },
    ],
    useCases: [
      {
        title: "Plan a new project",
        body: "Define the outcome, organize the milestones, and give the first actions clear owners.",
      },
      {
        title: "Run a weekly review",
        body: "Scan priorities, unblock stalled work, and agree what the team moves next.",
      },
      {
        title: "Hand off completed work",
        body: "Close the task with its files, decisions, and follow-on action still connected.",
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    formal: "Marketing",
    icon: "ph-megaphone",
    title: "Give every campaign a direction.",
    short: "Make your next move more intentional.",
    description:
      "Bring campaign plans, content, and customer activity into a more considered marketing workflow.",
    tasks: ["Campaign planning", "Content calendar", "Performance overview"],
    category: "Growth",
    number: "05",
    monthlyPrice: 35,
    image: "brand-glass.webp",
    highlights: [
      {
        title: "Campaigns with a clear brief",
        body: "Connect the audience, message, channel, owner, and intended outcome before production begins.",
      },
      {
        title: "A useful content rhythm",
        body: "Plan, review, and publish content through one shared calendar and approval flow.",
      },
      {
        title: "Performance in context",
        body: "Relate campaign activity to the goal and decision it should inform next.",
      },
    ],
    useCases: [
      {
        title: "Shape a campaign",
        body: "Turn the business goal into an audience, message, channel mix, and delivery plan.",
      },
      {
        title: "Run the content calendar",
        body: "Coordinate briefs, production, approvals, and publishing across the team.",
      },
      {
        title: "Review what worked",
        body: "Bring the result back to the original goal and choose the next experiment.",
      },
    ],
  },
  {
    id: "website",
    name: "Website",
    formal: "Website Manager",
    icon: "ph-browser",
    title: "Keep your digital front door open.",
    short: "Make your website easier to manage.",
    description:
      "See content, requests, and website priorities together, with a clearer path from update to action.",
    tasks: ["Content management", "Website requests", "Maintenance overview"],
    category: "Growth",
    number: "06",
    monthlyPrice: 29,
    image: "brand-tablet.webp",
    highlights: [
      {
        title: "Content changes in one queue",
        body: "Collect requests with the page, priority, owner, and approval context already attached.",
      },
      {
        title: "A visible publishing flow",
        body: "Move updates from request to review and release without losing the reason behind them.",
      },
      {
        title: "Maintenance people understand",
        body: "Keep routine checks, technical work, and improvement ideas visible in one operating view.",
      },
    ],
    useCases: [
      {
        title: "Request a page update",
        body: "Capture the change, reference the right page, and route it to the correct owner.",
      },
      {
        title: "Prepare a release",
        body: "Review content, approvals, dependencies, and publishing status in one sequence.",
      },
      {
        title: "Plan website care",
        body: "Organize maintenance, quality checks, and improvement work around business priorities.",
      },
    ],
  },
];

export const SOFTWARE_MODES = [
  {
    id: "single",
    name: "Single product",
    note: "Start with one focused product.",
  },
  {
    id: "operations",
    name: "Operations bundle",
    note: "HR, Tasks and Files.",
  },
  {
    id: "growth",
    name: "Growth bundle",
    note: "CRM, Marketing and Website.",
  },
  {
    id: "suite",
    name: "All-in-one suite",
    note: "All six products in one workspace.",
  },
  {
    id: "custom",
    name: "Custom workspace",
    note: "Choose the combination that fits.",
  },
];

export const SOFTWARE_TERMS = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0 },
  { id: "annual", label: "12 months", months: 12, discount: 0.15 },
  { id: "biennial", label: "24 months", months: 24, discount: 0.22 },
];

export const SOFTWARE_BUNDLES = [
  {
    id: "operations",
    name: "Operations bundle",
    ids: ["hr", "tasks", "files"],
    rate: 0.15,
  },
  {
    id: "growth",
    name: "Growth bundle",
    ids: ["crm", "marketing", "website"],
    rate: 0.15,
  },
  {
    id: "suite",
    name: "All-in-one suite",
    ids: ["hr", "crm", "files", "tasks", "marketing", "website"],
    rate: 0.25,
  },
];

export const SOFTWARE_MULTI_RATE = 0.1;

// Plans change setup and support around the same products.
export const SOFTWARE_PLAN_MULTIPLIERS = {
  starter: 1,
  complete: 1.2,
  ongoing: 1.45,
};

const SOFTWARE_IDS = SOFTWARE_PRODUCTS.map((product) => product.id);

export function getSoftwareProduct(id) {
  return SOFTWARE_PRODUCTS.find((product) => product.id === id) || null;
}

export function resolveSoftwareIds(ids = []) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return SOFTWARE_IDS.filter((id) => wanted.has(id));
}

// Older links say "complete" for the six-product suite.
export function getSoftwareMode(id) {
  const key = id === "complete" ? "suite" : id;
  return SOFTWARE_MODES.find((mode) => mode.id === key) || null;
}

export function getSoftwareTerm(id) {
  return (
    SOFTWARE_TERMS.find((term) => term.id === id) ||
    SOFTWARE_TERMS.find((term) => term.id === "annual")
  );
}

export function getSoftwareTermByMonths(months) {
  return SOFTWARE_TERMS.find((term) => term.months === months) || null;
}

export function getSoftwareBundle(ids) {
  const list = resolveSoftwareIds(ids);
  return (
    SOFTWARE_BUNDLES.find(
      (bundle) =>
        bundle.ids.length === list.length &&
        bundle.ids.every((id) => list.includes(id)),
    ) || null
  );
}

export function softwareModeOf(ids) {
  const list = resolveSoftwareIds(ids);
  if (list.length <= 1) return "single";
  return getSoftwareBundle(list)?.id || "custom";
}

// The best saving the selection qualifies for; adding a product never lowers it.
export function getSoftwareBundleRate(ids) {
  const list = resolveSoftwareIds(ids);
  return SOFTWARE_BUNDLES.filter((bundle) =>
    bundle.ids.every((id) => list.includes(id)),
  ).reduce(
    (rate, bundle) => Math.max(rate, bundle.rate),
    list.length > 1 ? SOFTWARE_MULTI_RATE : 0,
  );
}

export function priceSoftware(ids, planId = "starter", termId = "annual") {
  const list = resolveSoftwareIds(ids);
  const plan = SOFTWARE_PLAN_MULTIPLIERS[planId] ? planId : "starter";
  const multiplier = SOFTWARE_PLAN_MULTIPLIERS[plan];
  const term = getSoftwareTerm(termId);
  const listMonthly = list.reduce(
    (sum, id) => sum + getSoftwareProduct(id).monthlyPrice,
    0,
  );
  const rate = getSoftwareBundleRate(list);
  const base = Math.round(listMonthly * (1 - rate) * (1 - term.discount));
  const estimate = Math.round(base * multiplier);
  const listPrice = Math.round(listMonthly * multiplier);
  return {
    ids: list,
    count: list.length,
    planId: plan,
    term,
    mode: softwareModeOf(list),
    listMonthly,
    rate,
    base,
    estimate,
    listPrice,
    saving: listPrice - estimate,
    total: estimate * term.months,
    billing: "monthly",
  };
}

const percent = (rate) => `${Math.round(rate * 100)}%`;

export function getSoftwareSavingHint(ids) {
  const list = resolveSoftwareIds(ids);
  if (!list.length) return null;
  const rate = getSoftwareBundleRate(list);
  const options = SOFTWARE_BUNDLES.map((bundle) => ({
    bundle,
    missing: bundle.ids.filter((id) => !list.includes(id)),
  }))
    .filter((entry) => entry.missing.length === 1)
    .map((entry) => ({
      ...entry,
      next: getSoftwareBundleRate([...list, entry.missing[0]]),
    }))
    .filter((entry) => entry.next > rate)
    // Name the bundle that actually unlocks the new saving.
    .sort((a, b) => b.next - a.next || b.bundle.rate - a.bundle.rate);
  if (options.length) {
    const { bundle, missing, next } = options[0];
    const product = getSoftwareProduct(missing[0]);
    return {
      addId: missing[0],
      rate: next,
      label: `Add ${product.formal}`,
      text: `Add ${product.formal} to ${bundle.id === "suite" ? "get" : "complete"} the ${bundle.name} and save ${percent(next)}${rate ? ` instead of ${percent(rate)}` : ""}.`,
    };
  }
  if (list.length === 1)
    return {
      addId: null,
      rate: SOFTWARE_MULTI_RATE,
      label: "",
      text: `Add a second product to save ${percent(SOFTWARE_MULTI_RATE)}.`,
    };
  return null;
}

export function recommendSoftwarePlan(ids) {
  const list = resolveSoftwareIds(ids);
  if (!list.length) return null;
  return list.length > 1
    ? {
        planId: "complete",
        why: "Several products work best with connected workflows, roles and adoption support.",
      }
    : {
        planId: "starter",
        why: `${getSoftwareProduct(list[0]).formal} on its own is quick to set up. You can change plans before you sign.`,
      };
}

export function nameSoftwareSelection(ids) {
  const list = resolveSoftwareIds(ids);
  if (!list.length) return "";
  if (list.length === 1) return getSoftwareProduct(list[0]).formal;
  return getSoftwareBundle(list)?.name || "Custom workspace";
}

const SOFTWARE_SETUP = [
  "Configuration workshop",
  "Core workspace setup",
  "Guided launch plan",
  "Team handover session",
];

function softwareConnected(count) {
  return [
    "Workflow and role mapping",
    ...(count > 1 ? ["Cross-system coordination"] : []),
    "Adoption support",
  ];
}

const SOFTWARE_ONGOING = [
  "Ongoing support rhythm",
  "Improvement roadmap",
  "Evolution planning",
];

// Every plan includes the full products; plans differ in setup and support.
export function getSoftwarePlanFeatures(planId, ids) {
  const list = resolveSoftwareIds(ids);
  const products = list.map((id) => {
    const product = getSoftwareProduct(id);
    return list.length === 1
      ? product.tasks.join(", ")
      : `${product.formal}: ${product.tasks.join(", ")}`;
  });
  return [
    ...products,
    ...SOFTWARE_SETUP,
    ...(planId === "complete" || planId === "ongoing"
      ? softwareConnected(list.length)
      : []),
    ...(planId === "ongoing" ? SOFTWARE_ONGOING : []),
  ];
}

export function getSoftwarePlanAdditions(planId, ids) {
  const list = resolveSoftwareIds(ids);
  if (planId === "starter")
    return { planId: "complete", items: softwareConnected(list.length) };
  if (planId === "complete")
    return { planId: "ongoing", items: SOFTWARE_ONGOING };
  return null;
}

export function getSoftwarePlanMatrix(ids, termId = "annual") {
  const list = resolveSoftwareIds(ids);
  const term = getSoftwareTerm(termId);
  return [
    {
      title: "Products",
      rows: list.map((id) => {
        const product = getSoftwareProduct(id);
        return {
          label: product.formal,
          detail: product.tasks.join(" · "),
          values: [true, true, true],
        };
      }),
    },
    {
      title: "Setup",
      rows: SOFTWARE_SETUP.map((label) => ({
        label,
        values: [true, true, true],
      })),
    },
    {
      title: "Connected workflows",
      rows: softwareConnected(list.length).map((label) => ({
        label,
        values: [false, true, true],
      })),
    },
    {
      title: "Ongoing support",
      rows: SOFTWARE_ONGOING.map((label) => ({
        label,
        values: [false, false, true],
      })),
    },
    {
      title: "Billing",
      rows: [
        {
          label: "Billed",
          values: Array(3).fill(
            term.months > 1
              ? `Monthly, ${term.label} term`
              : "Monthly, no term",
          ),
        },
      ],
    },
  ];
}
