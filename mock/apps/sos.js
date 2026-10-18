// Mock backend for the SOS dashboard (somion-sos-frontend-main, web :3013) on the shared SOS/identity API (:4000).
// The identity core (lib/identity.js) already serves /api/auth/{login,me,my-scopes,refresh,logout}; this module adds:
//   auth extras   profile, avatar, change/forgot/reset password (OTP 123456), invites, "Login as" impersonation
//   people/RBAC   /api/users*, /api/rbac/*          -> identity.users / identity.grants
//   systems       /api/scopes*                      -> identity.scopes (what the SoSBar launcher lists)
//   dashboard     /api/dashboard/stats
//   CMS           /api/cms-instances*, /api/cms-accounts*  (+ local placeholder CMS pages under /local-cms/*)
//   chat          /api/conversations* + socket.io namespace "/chat"
// Code lives in apps/sos/*.js.
//
// Scopes: SOS registers none of its own. "website_manager" (the SOS Content area + the Content dashboard on :3006)
// is owned and granted by apps/content.js; SOS only reads/assigns it at runtime through identity.grants.
const { createHelpers } = require("./sos/common");
const { createRoles } = require("./sos/roles");
const { ensureSeedAssets } = require("./sos/assets");
const authExtras = require("./sos/auth-extras");
const people = require("./sos/people");
const systems = require("./sos/systems");
const cms = require("./sos/cms");
const { createChat } = require("./sos/chat");

// Shared state for the SOS sub-modules (filled in routes()).
const S = { deletedUserIds: new Set(), nsp: null, assets: {}, invites: [], people: null, cms: null, chat: null, log: (...a) => console.log("[api:sos]", ...a) };

module.exports = {
  scopes: [],

  grants: {
    global: { admin: ["super_admin"] }, // everyone else is added as a plain global member by identity
  },

  routes(app, ctx) {
    Object.assign(S, { ctx, identity: ctx.identity, util: ctx.util, config: ctx.config, log: ctx.log });
    const { identity } = ctx;

    S.assets = ensureSeedAssets(ctx.uploadsDir, ctx.fileUrl);
    const H = createHelpers(S);
    const R = createRoles(S);

    people.register(app, S, H, R);
    authExtras.register(app, S, H, R);
    systems.register(app, S, H, R);
    cms.register(app, S, H);
    S.chat = createChat(S, H);
    S.chat.register(app);

    const c = S.chat.stats();
    ctx.log(`SOS mock ready: ${identity.users.length} people, ${identity.scopes.length} systems, ${c.conversations} conversations / ${c.messages} messages, pending invites: ${S.invites.filter((i) => !i.acceptedAt).map((i) => i.token).join(", ")}`);
  },

  sockets(io) {
    S.chat.attach(io);
  },
};
