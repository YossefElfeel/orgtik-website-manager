export const SERVICE_FAMILIES = [
  {
    slug: "design",
    name: "Web design services",
    short: "Design",
    kicker: "Make it unmistakably yours",
    title: "Identity and experiences with one clear direction.",
    intro:
      "Brand thinking, visual communication, and responsive interfaces connected across every useful touchpoint.",
    image: "brand-cards.webp",
    icon: "ph-palette",
    children: [
      {
        slug: "graphic-design",
        name: "Graphic design",
        outcome: "Give every communication a stronger visual point of view.",
        summary:
          "Brand-consistent digital and print communication, from campaign assets to the everyday materials people see and use.",
        capabilities: [
          "Campaign design",
          "Business materials",
          "Digital asset systems",
        ],
      },
      {
        slug: "brand-development",
        name: "Brand development and corporate branding",
        outcome: "Build an identity that stays coherent as the business grows.",
        summary:
          "Brand strategy, identity direction, visual systems, guidance, and a practical rollout across touchpoints.",
        capabilities: [
          "Brand strategy",
          "Visual identity",
          "Guidelines and rollout",
        ],
      },
      {
        slug: "web-and-app-design",
        name: "Web design and application development",
        outcome: "Make complex digital journeys feel clear and considered.",
        summary:
          "UX and UI, responsive design, implementation, usability testing, and ongoing experience improvement.",
        capabilities: [
          "UX direction",
          "Interface systems",
          "Responsive implementation",
        ],
      },
    ],
  },
  {
    slug: "development",
    name: "Development services",
    short: "Development",
    kicker: "Make the idea work",
    title: "Digital products built around the result.",
    intro:
      "From requirements and architecture to tested implementation, launch, and considered iteration.",
    image: "brand-tablet.webp",
    icon: "ph-code",
    children: [
      {
        slug: "web-development",
        name: "Web development and programming",
        outcome:
          "Turn a clear idea into a fast, dependable digital experience.",
        summary:
          "Requirements, architecture, frontend implementation, integrations, testing, deployment planning, and support.",
        capabilities: [
          "Technical architecture",
          "Frontend implementation",
          "Testing and launch",
        ],
      },
      {
        slug: "custom-app-development",
        name: "Custom app development",
        outcome:
          "Shape a focused application around the way your business works.",
        summary:
          "Product discovery, UX and UI, tailored application development, integrations, testing, launch, and iteration.",
        capabilities: [
          "Product discovery",
          "Application UX",
          "Iterative delivery",
        ],
      },
    ],
  },
  {
    slug: "marketing",
    name: "Marketing services",
    short: "Marketing",
    kicker: "Make the story travel",
    title: "Turn attention into meaningful momentum.",
    intro:
      "Strategy, campaigns, search, and content shaped around the people your business needs to reach.",
    image: "brand-glass.webp",
    icon: "ph-megaphone",
    children: [
      {
        slug: "social-media-marketing",
        name: "Social media marketing",
        outcome: "Build a social presence people recognize and want to follow.",
        summary:
          "Channel strategy, content planning, publishing, community care, campaign management, and useful performance reporting.",
        capabilities: [
          "Channel strategy",
          "Content systems",
          "Community and campaign care",
        ],
      },
      {
        slug: "digital-advertising-switzerland",
        name: "Digital advertising Switzerland",
        outcome:
          "Make every campaign clearer, more focused, and easier to improve.",
        summary:
          "Paid campaign planning for Swiss audiences, from targeting and creative through budget control and measured optimization.",
        capabilities: [
          "Audience planning",
          "Campaign creative",
          "Performance optimization",
        ],
      },
      {
        slug: "seo-services",
        name: "SEO services",
        outcome: "Help the right people find you when the need is real.",
        summary:
          "Technical and on-page improvements, search-led content, local relevance, and a sustainable measurement rhythm.",
        capabilities: [
          "Technical foundations",
          "Content and keywords",
          "Local search visibility",
        ],
      },
    ],
  },
  {
    slug: "it-support",
    name: "IT support",
    short: "IT support",
    kicker: "Keep the work moving",
    title: "Reliable support for the systems behind the day.",
    intro:
      "Ongoing care, troubleshooting, and thoughtful improvements for the digital tools your team depends on.",
    image: "brand-phone.webp",
    icon: "ph-lifebuoy",
    children: [
      {
        slug: "website-management",
        name: "Website management",
        outcome:
          "Keep your website current, secure, and ready for what comes next.",
        summary:
          "Content changes, maintenance, backups, monitoring, performance care, and practical day-to-day support.",
        capabilities: [
          "Content updates",
          "Performance care",
          "Maintenance and monitoring",
        ],
      },
      {
        slug: "software-support",
        name: "Software support and error fixing",
        outcome:
          "Find the cause, restore stability, and reduce repeat problems.",
        summary:
          "Diagnosis, bug fixing, compatibility work, maintenance, and responsive technical support for existing software.",
        capabilities: [
          "Issue diagnosis",
          "Stability fixes",
          "Ongoing maintenance",
        ],
      },
    ],
  },
  {
    slug: "hosting",
    name: "OrgTik hosting",
    short: "Hosting",
    kicker: "Keep it online",
    title: "A dependable home for your digital presence.",
    intro:
      "Managed hosting, monitoring, backups, and performance care connected to the people who already understand your website.",
    image: "brand-glass.webp",
    icon: "ph-hard-drives",
    children: [
      {
        slug: "managed-hosting",
        name: "Managed website hosting",
        outcome:
          "Keep the website available, maintained, and ready to perform.",
        summary:
          "A managed hosting relationship with monitoring, backup routines, performance care, and direct support—without unsupported uptime promises.",
        capabilities: [
          "Managed hosting",
          "Monitoring and backups",
          "Performance care",
        ],
      },
    ],
  },
];

export function getServiceChoices(department = "all") {
  return SERVICE_FAMILIES.filter(
    (family) => department === "all" || family.slug === department,
  ).flatMap((f) =>
    f.children.map((c) => ({ id: `${f.slug}/${c.slug}`, f, c })),
  );
}

export function getServiceDepartment(selectionId) {
  return SERVICE_FAMILIES.find(
    (family) =>
      family.slug === selectionId ||
      family.children.some(
        (service) => `${family.slug}/${service.slug}` === selectionId,
      ),
  );
}

export function getServicePlanSelection(familySlug, serviceSlug = "all") {
  const family = SERVICE_FAMILIES.find((entry) => entry.slug === familySlug);
  if (!family) return null;
  const service = family.children.find((entry) => entry.slug === serviceSlug);
  return {
    family,
    service: service || null,
    id: service ? `${family.slug}/${service.slug}` : family.slug,
    // A department overview covers every service in that department.
    ids: service
      ? [`${family.slug}/${service.slug}`]
      : family.children.map((entry) => `${family.slug}/${entry.slug}`),
    name: service ? service.name : family.name,
    capabilities: service
      ? service.capabilities
      : family.children.map((entry) => entry.name),
  };
}

// Plan prices are per service; savings apply to the whole selection.
export const SERVICE_PLAN_PRICES = {
  starter: 1800,
  complete: 4200,
  ongoing: 1450,
};

export const SERVICE_BUNDLES = [
  {
    id: "launch",
    name: "Launch bundle",
    ids: [
      "design/brand-development",
      "development/web-development",
      "marketing/seo-services",
    ],
  },
  {
    id: "visibility",
    name: "Visibility bundle",
    ids: [
      "design/graphic-design",
      "marketing/social-media-marketing",
      "marketing/digital-advertising-switzerland",
    ],
  },
  {
    id: "care",
    name: "Care bundle",
    ids: [
      "it-support/website-management",
      "it-support/software-support",
      "hosting/managed-hosting",
    ],
  },
];

export const SERVICE_BUNDLE_RATE = 0.12;
export const SERVICE_COUNT_RATES = [
  { min: 2, rate: 0.05 },
  { min: 3, rate: 0.1 },
  { min: 5, rate: 0.15 },
];

// Services that naturally run as a monthly rhythm.
export const ONGOING_SERVICE_IDS = [
  "it-support/website-management",
  "it-support/software-support",
  "hosting/managed-hosting",
  "marketing/social-media-marketing",
];

const SERVICE_IDS = SERVICE_FAMILIES.flatMap((family) =>
  family.children.map((service) => `${family.slug}/${service.slug}`),
);

export function getServiceEntry(id) {
  for (const f of SERVICE_FAMILIES)
    for (const c of f.children)
      if (`${f.slug}/${c.slug}` === id) return { id, f, c };
  return null;
}

// Expand department slugs, drop unknown IDs and keep catalogue order.
export function resolveServiceIds(ids = []) {
  const wanted = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    const family = SERVICE_FAMILIES.find((entry) => entry.slug === id);
    if (family)
      family.children.forEach((c) => wanted.add(`${family.slug}/${c.slug}`));
    else if (SERVICE_IDS.includes(id)) wanted.add(id);
  }
  return SERVICE_IDS.filter((id) => wanted.has(id));
}

export function getServiceBundle(ids) {
  const list = resolveServiceIds(ids);
  return (
    SERVICE_BUNDLES.find(
      (bundle) =>
        bundle.ids.length === list.length &&
        bundle.ids.every((id) => list.includes(id)),
    ) || null
  );
}

export function getContainedServiceBundles(ids) {
  const list = resolveServiceIds(ids);
  return SERVICE_BUNDLES.filter((bundle) =>
    bundle.ids.every((id) => list.includes(id)),
  );
}

function countRate(count) {
  return SERVICE_COUNT_RATES.reduce(
    (rate, tier) => (count >= tier.min ? tier.rate : rate),
    0,
  );
}

// Adding a service can never lower the saving.
export function getServiceSavingRate(ids) {
  const list = resolveServiceIds(ids);
  return Math.max(
    countRate(list.length),
    getContainedServiceBundles(list).length ? SERVICE_BUNDLE_RATE : 0,
  );
}

export function priceServices(ids, planId = "starter") {
  const list = resolveServiceIds(ids);
  const plan = SERVICE_PLAN_PRICES[planId] ? planId : "starter";
  const unit = SERVICE_PLAN_PRICES[plan];
  const subtotal = list.length * unit;
  const rate = getServiceSavingRate(list);
  const estimate = Math.round(subtotal * (1 - rate));
  return {
    ids: list,
    count: list.length,
    planId: plan,
    unit,
    subtotal,
    rate,
    saving: subtotal - estimate,
    estimate,
    billing: plan === "ongoing" ? "monthly" : "project",
    bundle: getServiceBundle(list),
  };
}

const percent = (rate) => `${Math.round(rate * 100)}%`;

export function getServiceSavingHint(ids) {
  const list = resolveServiceIds(ids);
  if (!list.length) return null;
  const rate = getServiceSavingRate(list);
  for (const bundle of SERVICE_BUNDLES) {
    const missing = bundle.ids.filter((id) => !list.includes(id));
    if (missing.length !== 1) continue;
    const next = getServiceSavingRate([...list, missing[0]]);
    if (next <= rate) continue;
    const service = getServiceEntry(missing[0]).c;
    return {
      addId: missing[0],
      rate: next,
      label: `Add ${service.name}`,
      text: `Add ${service.name} to complete the ${bundle.name} and save ${percent(next)}${rate ? ` instead of ${percent(rate)}` : ""}.`,
    };
  }
  const tier = SERVICE_COUNT_RATES.find((entry) => entry.rate > rate);
  if (!tier) return null;
  const more = tier.min - list.length;
  return {
    addId: null,
    rate: tier.rate,
    label: "",
    text: `Add ${more} more service${more === 1 ? "" : "s"} to save ${percent(tier.rate)}.`,
  };
}

export function recommendServicePlan(ids) {
  const list = resolveServiceIds(ids);
  if (!list.length) return null;
  const first = getServiceEntry(list[0]).c.name;
  const ongoing = list.filter((id) => ONGOING_SERVICE_IDS.includes(id)).length;
  if (list.length === 1 ? ongoing === 1 : ongoing * 2 > list.length)
    return {
      planId: "ongoing",
      why:
        list.length === 1
          ? `${first} runs every month, so steady monthly help fits best.`
          : "Most of what you picked runs every month, so steady monthly help fits best.",
    };
  if (list.length > 1) {
    const bundle = getServiceBundle(list);
    return {
      planId: "complete",
      why: bundle
        ? `The ${bundle.name} services work best planned and delivered together.`
        : `Your ${list.length} services work best planned and delivered together on one roadmap.`,
    };
  }
  return {
    planId: "starter",
    why: `One clear priority for ${first} is a focused, low-risk start.`,
  };
}

export function nameServiceSelection(ids) {
  const list = resolveServiceIds(ids);
  if (!list.length) return "";
  if (list.length === 1) return getServiceEntry(list[0]).c.name;
  const bundle = getServiceBundle(list);
  if (bundle) return bundle.name;
  const family = SERVICE_FAMILIES.find(
    (entry) =>
      entry.children.length === list.length &&
      list.every((id) => id.startsWith(`${entry.slug}/`)),
  );
  return family ? family.name : "Custom service bundle";
}

// Each plan keeps everything below it; Ongoing swaps the fixed window for a monthly rhythm.
const SERVICE_PLAN_EXTRAS = {
  starter: ["Clear brief and success criteria", "Defined delivery window"],
  complete: [
    "Clear brief and success criteria",
    "Defined delivery window",
    "Connected delivery roadmap",
  ],
  ongoing: [
    "Clear brief and success criteria",
    "Monthly delivery rhythm",
    "Connected delivery roadmap",
    "Ongoing support",
    "Improvement roadmap",
  ],
};

// How each higher plan introduces its additions on cards.
export const SERVICE_PLAN_LEADS = {
  complete: "Everything in Starter, plus",
  ongoing: "Everything in Complete as a monthly rhythm, plus",
};

// What each service includes on a plan: Starter covers the first capability.
export function getServicePlanScope(planId, ids) {
  const plan = SERVICE_PLAN_EXTRAS[planId] ? planId : "starter";
  const services = resolveServiceIds(ids).map((id) => {
    const { f, c } = getServiceEntry(id);
    const count = plan === "starter" ? 1 : c.capabilities.length;
    return {
      id,
      name: c.name,
      department: f.short,
      included: c.capabilities.slice(0, count),
      excluded: c.capabilities.slice(count),
    };
  });
  return { planId: plan, services, extras: SERVICE_PLAN_EXTRAS[plan] };
}

// Flat, cumulative feature list for plan cards and the cart.
export function getServicePlanFeatures(planId, ids) {
  const scope = getServicePlanScope(planId, ids);
  const lines =
    scope.services.length === 1
      ? scope.services[0].included
      : scope.services.map(
          (service) => `${service.name}: ${service.included.join(", ")}`,
        );
  return lines.concat(scope.extras);
}

// What the next plan adds, for factual upgrade hints.
export function getServicePlanAdditions(planId, ids) {
  const next =
    planId === "starter"
      ? "complete"
      : planId === "complete"
        ? "ongoing"
        : null;
  if (!next) return null;
  const current = getServicePlanFeatures(planId, ids);
  const scope = getServicePlanScope(next, ids);
  const added =
    next === "complete" && scope.services.length > 1
      ? [`the remaining parts of all ${scope.services.length} services`]
      : scope.services.flatMap((service) =>
          service.included.filter(
            (capability) =>
              !getServicePlanScope(planId, [
                service.id,
              ]).services[0].included.includes(capability),
          ),
        );
  return {
    planId: next,
    items: added.concat(
      scope.extras.filter(
        (extra) =>
          !current.includes(extra) && extra !== "Monthly delivery rhythm",
      ),
    ),
  };
}

// Rows for the shared plan comparison, in Starter, Complete, Ongoing order.
export function getServicePlanMatrix(ids) {
  const list = resolveServiceIds(ids);
  const entries = list.map((id) => getServiceEntry(id));
  const included =
    entries.length === 1
      ? entries[0].c.capabilities.map((capability, index) => ({
          label: capability,
          values: [index === 0, true, true],
        }))
      : // One summary row per service; its parts open underneath to show the difference.
        entries.map(({ c }) => {
          const total = c.capabilities.length;
          return {
            label: c.name,
            values: [
              `1 of ${total} parts`,
              `All ${total} parts`,
              `All ${total} parts`,
            ],
            children: c.capabilities.map((capability, index) => ({
              label: capability,
              values: [index === 0, true, true],
            })),
          };
        });
  return [
    { title: "What's included", rows: included },
    {
      title: "How it runs",
      rows: [
        {
          label: "Clear brief and success criteria",
          values: [true, true, true],
        },
        {
          label: "Delivery",
          values: [
            "Defined delivery window",
            "Defined delivery window",
            "Monthly delivery rhythm",
          ],
        },
        { label: "Connected delivery roadmap", values: [false, true, true] },
        { label: "Ongoing support", values: [false, false, true] },
        { label: "Improvement roadmap", values: [false, false, true] },
      ],
    },
    {
      title: "Billing",
      rows: [
        {
          label: "Billed",
          values: ["Per project", "Per project", "Per month"],
        },
        {
          label: "Timeline",
          values: [
            "Agreed in your brief",
            "Agreed in your brief",
            "1, 3, 6 or 12 months",
          ],
        },
      ],
    },
  ];
}
