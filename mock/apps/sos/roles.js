// Role catalogue per scope. Role ids are unique across scopes (DELETE /rbac/users/:id/roles/:roleId has no scope).
// Assignments live in identity.grants[scope][userKey].roles (role names), shared with every other mock app.
const { nowIso, daysFromNow } = require("../../lib/util");

const d = (description) => description;
const CATALOGUE = {
  global: [["super_admin", d("Full access to every Orgtik system and to SOS administration (People, Systems, CMS).")]],
  task_manager: [
    ["super_admin", d("Full control of the Task Manager: all projects, members and settings.")],
    ["project_manager", d("Creates projects, plans sprints and assigns tasks to the team.")],
    ["developer", d("Works on assigned tasks, updates status and logs time.")],
    ["viewer", d("Read-only access to projects and tasks.")],
  ],
  hr_system: [
    ["super_admin", d("Full control of the HR system and its configuration.")],
    ["hr", d("Manages employees, contracts, leave and onboarding.")],
    ["manager", d("Approves leave and reviews the performance of direct reports.")],
    ["employee", d("Self-service: profile, leave requests, payslips.")],
    ["finance_manager", d("Runs payroll and approves salary-related requests.")],
  ],
  sales: [
    ["admin", d("Full control of the Sales dashboard: pipelines, pricing and users.")],
    ["manager", d("Oversees the sales team, targets and approvals.")],
    ["salesman", d("Manages own leads, customers, offers and orders.")],
    ["customer", d("Customer portal access: orders, invoices and support.")],
  ],
  // Names match the grants of apps/files.js (the app checks super_admin, otherwise any role grants access).
  file_manager: [
    ["super_admin", d("Full control of the File Manager and storage settings.")],
    ["file_editor", d("Uploads, edits and shares files in permitted folders.")],
    ["file_guest", d("Limited access to files and folders shared with them.")],
  ],
  // Names match the grants of apps/marketing.js (checked by apps/marketing/roles.js and the app).
  digital_marketing: [
    ["super_admin", d("Full control of Digital Marketing: brands, campaigns and settings.")],
    ["marketing_manager", d("Plans campaigns, approves content and manages the marketing team.")],
    ["marketing_specialist", d("Runs campaigns and paid boosts, reports on results.")],
    ["content_writer", d("Writes and schedules posts for review.")],
    ["client_reviewer", d("Customer-side reviewer who approves content before it is published.")],
  ],
  website_manager: [["website_manager", d("Manages company websites and CMS dashboards from the SOS Content area.")]],
};
CATALOGUE.marketing = CATALOGUE.digital_marketing;
const DEFAULT_ROLES = [
  ["admin", d("Full access to this system.")],
  ["member", d("Standard access to this system.")],
  ["viewer", d("Read-only access to this system.")],
];

const label = (name) => name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

function createRoles(S) {
  const { identity } = S;
  const roles = []; // { id, name, scope, description, createdAt, updatedAt }
  const built = new Set();
  const assigned = new Map(); // `${userKey}|${scope}|${role}` -> ISO date
  let nextId = 1;
  let initialised = false;

  const add = (scope, name, description, createdAt) => {
    const r = { id: nextId++, name, scope, description, createdAt: createdAt || daysFromNow(-420), updatedAt: createdAt || daysFromNow(-420) };
    roles.push(r);
    return r;
  };
  const find = (scope, name) => roles.find((r) => r.scope === scope && r.name === name);

  function ensureScope(scopeName) {
    if (built.has(scopeName)) return;
    built.add(scopeName);
    const scope = identity.scopeByName(scopeName);
    const created = scope?.createdAt;
    for (const [name, desc] of CATALOGUE[scopeName] || DEFAULT_ROLES) if (!find(scopeName, name)) add(scopeName, name, desc, created);
    // Roles other app modules granted but that are not in the catalogue.
    for (const entry of Object.values(identity.grants[scopeName] || {}))
      for (const name of entry.roles || []) if (!find(scopeName, name)) add(scopeName, name, `${label(name)} role.`, created);
  }

  // Deterministic ids: build every registered scope in registry order on first use.
  function init() {
    if (initialised) return;
    initialised = true;
    for (const s of identity.scopes) ensureScope(s.name);
  }

  function forScope(scopeName) {
    init();
    ensureScope(scopeName);
    return roles.filter((r) => r.scope === scopeName);
  }
  function all() {
    init();
    for (const s of identity.scopes) ensureScope(s.name);
    return roles.filter((r) => identity.scopeByName(r.scope));
  }
  const byId = (id) => {
    init();
    return roles.find((r) => String(r.id) === String(id)) || null;
  };
  // Role object for a (scope, name) pair, created on the fly for names granted elsewhere.
  function ensureRole(scopeName, name) {
    init();
    ensureScope(scopeName);
    return find(scopeName, name) || add(scopeName, name, `${label(name)} role.`, nowIso());
  }
  function renameScope(from, to) {
    for (const r of roles) if (r.scope === from) r.scope = to;
    if (built.has(from)) {
      built.delete(from);
      built.add(to);
    }
    for (const [k, v] of [...assigned]) {
      const [user, scope, role] = k.split("|");
      if (scope === from) {
        assigned.delete(k);
        assigned.set(`${user}|${to}|${role}`, v);
      }
    }
  }

  const scopeSummary = (s) => (s ? { id: s.id, name: s.name, displayName: s.displayName, domain: s.domain, description: s.description, isActive: s.isActive, metadata: s.metadata } : null);

  // IRole (types/user.ts) + scopeEntity (read by the HR dashboard).
  function view(r) {
    const s = identity.scopeByName(r.scope);
    return {
      id: r.id,
      name: r.name,
      displayName: label(r.name),
      description: r.description,
      isActive: true,
      scopeId: s ? s.id : null,
      scope: r.scope,
      scopeEntity: scopeSummary(s),
      permissions: [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // ---- grants (identity.grants is the single source of truth) ----
  const entry = (scope, u) => identity.grants[scope]?.[u.key] || null;
  const hasScope = (u, scope) => !!entry(scope, u);
  function addScope(u, scope) {
    identity.grants[scope] = identity.grants[scope] || {};
    if (!identity.grants[scope][u.key]) identity.grants[scope][u.key] = { roles: [], permissions: [] };
    return identity.grants[scope][u.key];
  }
  function removeScope(u, scope) {
    if (identity.grants[scope]) delete identity.grants[scope][u.key];
    for (const k of [...assigned.keys()]) if (k.startsWith(`${u.key}|${scope}|`)) assigned.delete(k);
  }
  function addRole(u, role) {
    const e = addScope(u, role.scope);
    if (!e.roles.includes(role.name)) {
      e.roles.push(role.name);
      assigned.set(`${u.key}|${role.scope}|${role.name}`, nowIso());
    }
  }
  function removeRole(u, role) {
    const e = entry(role.scope, u);
    if (e) e.roles = e.roles.filter((n) => n !== role.name);
    assigned.delete(`${u.key}|${role.scope}|${role.name}`);
  }
  const hasRole = (u, role) => !!entry(role.scope, u)?.roles.includes(role.name);
  const assignedAt = (u, scope, name) => assigned.get(`${u.key}|${scope}|${name}`) || u.createdAt;
  function removeAllGrants(u) {
    for (const scope of Object.keys(identity.grants)) removeScope(u, scope);
  }

  return { forScope, all, byId, ensureRole, ensureScope, renameScope, view, scopeSummary, hasScope, addScope, removeScope, addRole, removeRole, hasRole, assignedAt, removeAllGrants, label };
}

module.exports = { createRoles };
