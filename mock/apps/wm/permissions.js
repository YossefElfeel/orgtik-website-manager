// Website Manager roles and permissions (plan, Phase 2 "Product"; D-034 for who holds them).
// A permission is "<module>:<action>" (view, edit, create, approve, delete) or a named special.
const MODULES = ["overview", "content", "pages", "media", "seo", "marketing", "localization", "settings"];
// pricing:edit changes a number the website shows; pricing:approve publishes it (four eyes).
const SPECIALS = ["legal:approve", "claims:approve", "pricing:edit", "pricing:approve", "leads:pii", "site:visibility", "locales:enable", "seo:custom-jsonld", "users:view", "users:manage", "roles:manage"];

const all = (actions) => MODULES.flatMap((m) => actions.map((a) => `${m}:${a}`));
const view = all(["view"]);

const ROLES = {
  wm_owner: { label: "Owner", permissions: [...all(["view", "edit", "approve"]), ...SPECIALS] },
  wm_super_admin: { label: "Super admin", permissions: [...all(["view", "edit", "approve"]), ...SPECIALS] },
  wm_admin: { label: "Admin", permissions: [...all(["view", "edit", "approve"]), ...SPECIALS] },
  wm_approver: {
    label: "Manager",
    permissions: [...view, "content:edit", "content:approve", "pages:edit", "pages:approve", "media:edit", "media:approve", "localization:edit", "localization:approve", "legal:approve", "claims:approve", "pricing:edit"],
  },
  wm_editor: { label: "Support manager", permissions: [...view, "content:edit", "pages:edit", "media:edit", "localization:edit"] },
  wm_seo: { label: "SEO manager", permissions: [...view, "seo:edit", "seo:approve", "seo:custom-jsonld", "pages:edit"] },
  wm_marketing: { label: "Marketing manager", permissions: [...view, "marketing:edit", "marketing:approve", "leads:pii", "media:edit"] },
  wm_viewer: { label: "Viewer", permissions: view.filter((p) => p !== "settings:view") },
};

// Keep existing collection access while separating creation/deletion from editing.
for (const role of Object.values(ROLES)) {
  for (const group of ["content", "media", "seo"]) {
    if (role.permissions.includes(`${group}:edit`)) role.permissions.push(`${group}:create`, `${group}:delete`);
  }
}
const PERMISSIONS = [...new Set(Object.values(ROLES).flatMap(role => role.permissions))];
function permissionsFor(roleNames, overrides = {}) {
  const set = new Set();
  for (const r of roleNames) for (const p of overrides[r] ?? ROLES[r]?.permissions ?? []) set.add(p);
  return [...set].sort();
}

module.exports = { MODULES, SPECIALS, ROLES, PERMISSIONS, permissionsFor };
