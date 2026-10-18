export const ROLE_ACTIONS = [
  "view",
  "edit",
  "create",
  "approve",
  "delete",
] as const;
export type RoleAction = (typeof ROLE_ACTIONS)[number];
export type CapabilityGroup = {
  key: string;
  actions: Partial<Record<RoleAction, string>>;
};
export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  ...[
    "overview",
    "content",
    "pages",
    "media",
    "seo",
    "marketing",
    "localization",
    "settings",
  ].map((key) => ({
    key,
    actions: {
      view: `${key}:view`,
      edit: `${key}:edit`,
      approve: `${key}:approve`,
      ...(["content", "media", "seo"].includes(key)
        ? { create: `${key}:create`, delete: `${key}:delete` }
        : {}),
    },
  })),
  { key: "legal", actions: { approve: "legal:approve" } },
  { key: "claims", actions: { approve: "claims:approve" } },
  {
    key: "pricing",
    actions: { edit: "pricing:edit", approve: "pricing:approve" },
  },
  { key: "leads", actions: { view: "leads:pii" } },
  { key: "site", actions: { edit: "site:visibility" } },
  { key: "locales", actions: { edit: "locales:enable" } },
  { key: "users", actions: { view: "users:view", edit: "users:manage" } },
  { key: "structuredData", actions: { edit: "seo:custom-jsonld" } },
  { key: "roles", actions: { edit: "roles:manage" } },
];
