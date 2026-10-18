// ADM staff roles (spec 02, specs/permission-matrix.csv): 8 roles × 17 modules, each F (full),
// E (edit), V (view) or none. A permission is "<module>:view" | "<module>:edit" | "<module>:full".
// E* (Service Team on Services) is edit on the requests assigned to them (checked per request).
const MODULES = ["overview", "tools", "plans", "pricing", "bundles", "workspaces", "billing", "tax", "services", "tickets", "content", "suggestions", "waitlist", "templates", "staff", "reports", "settings"];
const LABELS = {
  overview: "Overview", tools: "Tools & Status", plans: "Plans & Features", pricing: "Zones, Currencies & Pricing", bundles: "Bundles & Coupons",
  workspaces: "Workspaces", billing: "Billing", tax: "Tax & Gateways", services: "Services", tickets: "Support tickets", content: "Content",
  suggestions: "Suggestions & Roadmap", waitlist: "Waitlist", templates: "Templates", staff: "Staff & Roles", reports: "Reports", settings: "Settings",
};
// Columns in the matrix's order: Super Admin, Finance, Sales, Support, Service Mgr, Service Team, Content, Product Mgr.
const ROLE_KEYS = ["super_admin", "finance", "sales", "support", "service_mgr", "service_team", "content", "product_mgr"];
const ROLE_LABELS = { super_admin: "Super Admin", finance: "Finance", sales: "Sales", support: "Support", service_mgr: "Service Mgr", service_team: "Service Team", content: "Content", product_mgr: "Product Mgr" };
const MATRIX = {
  overview: "F V V V V - - V",
  tools: "F - V V - - - E",
  plans: "F V V V - - - E",
  pricing: "F E V - - - - -",
  bundles: "F E E - - - - -",
  workspaces: "F V E E V - - V",
  billing: "F F V V - - - -",
  tax: "F E - - - - - -",
  services: "F V E V F E* - -",
  tickets: "F V E F V - - V",
  content: "F - - - V - F E",
  suggestions: "F - V E - - - F",
  waitlist: "F - V - - - - F",
  templates: "F - - E - - E -",
  staff: "F - - - - - - -",
  reports: "F F V - V - V V",
  settings: "F V - - - - - -",
};
const LEVELS = { F: ["view", "edit", "full"], E: ["view", "edit"], "E*": ["view", "edit:assigned"], V: ["view"], "-": [] };

function permissionsFor(roles) {
  const set = new Set();
  for (const role of roles) {
    const col = ROLE_KEYS.indexOf(role);
    if (col < 0) continue;
    for (const m of MODULES) for (const a of LEVELS[MATRIX[m].split(" ")[col]] ?? []) set.add(`${m}:${a}`);
  }
  return [...set].sort();
}

// Who holds which staff role (local-dev identities; OrgTik's own people run the platform).
const GRANTS = {
  admin: ["super_admin"], // Mona Adel
  finance: ["finance"], // Hany Samir
  u16: ["finance"], // Aya Hamed
  sales: ["sales"], // Omar Farouk
  u13: ["sales"], // Tamer Wagdy
  u11: ["support"], // Mahmoud Gamal
  u10: ["support"], // Rana Saad
  u15: ["service_mgr"], // Sherif Magdy
  u8: ["service_team"], // Laila Mostafa
  u7: ["service_team"], // Youssef Ibrahim
  u14: ["content"], // Hoda Ashraf
  manager: ["product_mgr"], // Karim Hassan
};

module.exports = { MODULES, LABELS, ROLE_KEYS, ROLE_LABELS, MATRIX, permissionsFor, GRANTS };
