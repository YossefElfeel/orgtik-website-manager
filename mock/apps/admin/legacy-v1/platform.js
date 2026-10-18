// Platform mock for Phase E (orgtik-program/phase-e/README.md): the SaaS core the specs describe
// (OrgTik_02 ADM, OrgTik_03 pricing, OrgTik_05 USR, OrgTik_06 state tables) on API :4008.
//   /v1/admin/*  staff back office (orgtik-admin, web :3008), guarded by the 8-role matrix
//   /v1/app/*    the customer's workspace (USR, grown in SOS); also mounted on the SOS API (:4000)
//   /v1/__mock/* test controls: fail the next payment, run the lifecycle now
// Envelope as the Website Manager's v2: { data, meta } / { error: { code, message, ... } }.
// One store per reset, shared by both mounts, so a change in ADM shows in USR at once.
const crypto = require("crypto");
const { makeStore } = require("./admin/store");
const { GRANTS } = require("./admin/permissions");
const { advance } = require("./admin/lifecycle");
const adminApi = require("./admin/admin-api");
const appApi = require("./admin/app-api");

const SCOPE = "platform_admin";
let S = null;
const store = (ctx) => (S ??= makeStore({ identity: ctx.identity }));

function helpers() {
  const rid = () => crypto.randomUUID();
  const ok = (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta });
  const fail = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, requestId: rid(), ...extra } });
  // page/pageSize (25 by default, 100 at most), as the Website Manager's lists.
  const page = (req, res, list, meta = {}) => {
    const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    ok(res, list.slice((p - 1) * size, p * size), { page: p, pageSize: size, total, pages, ...meta });
  };
  return { ok, fail, page };
}

function controls(app, S, H) {
  app.post("/v1/__mock/fail-next-payment", (req, res) => {
    S.failNext = Math.max(0, Math.min(10, Number(req.body?.count ?? 1)));
    H.ok(res, { failNext: S.failNext });
  });
  app.post("/v1/__mock/advance", (req, res) => {
    advance(S);
    H.ok(res, { at: S.iso(S.now()) });
  });
}

module.exports = {
  scopes: [
    {
      name: SCOPE,
      displayName: "OrgTik Admin",
      description: "OrgTik's back office: tools, plans, pricing, customers, billing, services and support.",
      metadata: { icon: "solar:shield-user-bold", color: "#3B1E59" },
      web: "admin",
    },
  ],
  // Staff roles (spec 02): the SOS launcher shows the app to anyone holding one.
  grants: { [SCOPE]: GRANTS },

  routes(app, ctx) {
    // A reset re-requires this module, so S starts empty; the SOS mount (built first) may have made it.
    const s = store(ctx);
    const H = helpers();
    // Someone who signs up on the website lands in their own workspace (USR).
    ctx.identity.onRegister?.((u, { company }) => {
      // A fixed id, so the same workspace is rebuilt if another hosted instance rebuilds the person.
      const wsId = `ws_${u.key}`;
      if (s.db.workspaces.some((w) => w.id === wsId)) return;
      const ws = s.createWorkspace({ wsId, ownerKey: u.key, name: company || `${u.firstName}'s workspace`, email: u.email, createdAt: u.createdAt });
      s.log(u.key, "sign_up", ws.id);
    });
    adminApi(app, ctx, s, H);
    appApi(app, ctx, s, H);
    controls(app, s, H);
  },
  // USR grows in SOS (D-011): the same customer API on the SOS origin, sharing this store.
  mounts: {
    sos(app, ctx) {
      appApi(app, ctx, store(ctx), helpers());
    },
  },
};
