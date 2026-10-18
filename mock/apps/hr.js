// Local mock backend for somion-hr-dashboard (HR system, scope "hr_system").
// Frontend: NEXT_PUBLIC_API_URL=http://localhost:4004/api  (socket.io namespace /notifications on the same origin)
const identity = require("../lib/identity");
const util = require("../lib/util");
const config = require("../config");
const L = require("./hr/lib");
const F = require("./hr/files");
const { buildDb } = require("./hr/seed");
const makeViews = require("./hr/views");
const makeCalc = require("./hr/calc");

let legacy;
function createState(ctx, db = buildDb({ identity: ctx.identity, config: ctx.config })) {
  const V = makeViews(db, ctx.identity);
  return { db, V, C: makeCalc(db, V), state: { nsp: null } };
}
function legacyState(ctx) { return legacy || (legacy = createState(ctx)); }

const STAFF_KEYS = ["admin", "manager", "employee", "sales", "finance", "u7", "u8", "u9", "u10", "u11", "u12", "u13", "u14", "u15", "u16"];
const HR_ROLES = { admin: ["super_admin"], manager: ["manager"], u15: ["manager"], u10: ["hr"], finance: ["finance_manager"] };

function helpers(ctx, runtime) {
  const { db, V, C, state } = runtime;
  const identity = ctx.identity, util = ctx.util;
  const h = { db, V, C, L, F, identity, util, ctx, state };
  h.command = async (req, kind, payload) => {
    if (typeof ctx.services?.lifecycle?.execute !== "function") throw Object.assign(new Error("A shared workspace command is required"), { status: 501, code: "workspace_command_required" });
    return ctx.services.lifecycle.execute(kind, payload, { actor: req.workspaceContext?.actor || { userId: req.user.id, effectiveUserId: req.user.id }, workspaceId: ctx.workspaceId, operationId: req.operationId || req.get("idempotency-key") });
  };
  h.me = (req) => V.empByUser(req.user.id);
  h.guard = (req, res, ...roles) => {
    if (V.has(req.user, ...roles)) return true;
    L.err(res, 403, "You don't have permission to perform this action.");
    return false;
  };
  h.log = (action, entityType, entityId, userId, metadata = {}) =>
    db.logs.insert({ action, entityType, entityId: String(entityId), performedBy: userId, metadata });
  // Creates notification rows and pushes them over socket.io ("notification.created").
  h.notify = ({ to, actor = null, action, title, body = "", priority = "normal", entityType = null, entityId = null, data = null, includeActor = false }) => {
    const ids = [...new Set([].concat(to || []).filter((x) => x != null).map(Number))].filter((id) => includeActor || id !== actor);
    const rows = [];
    for (const id of ids) {
      if (!identity.findUser(id)) continue;
      const row = db.notifications.insert({ recipientUserId: id, actorUserId: actor, action, title, body, priority, channels: ["websocket"], deliveredChannels: ["websocket"], failedChannels: [], entityType, entityId: entityId != null ? String(entityId) : null, data, readAt: null });
      rows.push(row);
      state.nsp?.to(`user:${id}`).emit("notification.created", V.notificationView(row));
    }
    return rows;
  };
  h.usersWithRole = (...roles) => identity.users.filter((u) => V.rolesOf(u).some((r) => roles.includes(r))).map((u) => u.id);
  // multer file -> stored attachment metadata
  h.fileMeta = (f) => ({ fileName: f.originalname, filePath: `uploads/${f.filename}`, url: ctx.fileUrl(f.filename), mimeType: f.mimetype || "application/octet-stream", fileSize: f.size });
  h.anyFiles = ctx.upload.any();
  h.body = (req) => req.body || {};
  h.sendFile = (res, buf, { type, name, inline = false }) => {
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.end(buf);
  };
  if (identity.workspaceMode) h.leave = require('./hr/leave').createLeaveService({ db, V, C, L, identity, workspace: ctx.workspace, context: () => identity.currentContext(), notify: h.notify, log: h.log });
  return h;
}

module.exports = {
  scopes: [
    {
      name: "hr_system",
      displayName: "HR",
      description: "People, attendance, time off, payroll and hiring.",
      metadata: { icon: "solar:users-group-two-rounded-bold", color: "#16A34A" },
    },
  ],
  grants: {
    hr_system: Object.fromEntries(STAFF_KEYS.map((k) => [k, HR_ROLES[k] || ["employee"]])),
  },

  createState, helpers,
  createWorkspaceRuntime(input) { return require("../lib/tool-adapters/hr").createWorkspaceRuntime(input, module.exports); },
  routes(app, ctx, runtime = legacyState(ctx)) {
    const { db } = runtime;
    const h = helpers(ctx, runtime);
    // Generated sample files (CVs, seeded attachments, avatars). Real uploads are served by the framework's /uploads static.
    require("./hr/routes/files")(app, h);
    // Everything under /api needs a valid SOS token.
    app.use("/api", (req, res, next) => {
      const u = ctx.identity.requireUser(req, res);
      if (!u) return;
      req.user = u;
      next();
    });
    require("./hr/routes/people")(app, h);
    require("./hr/routes/attendance")(app, h);
    require("./hr/routes/payroll")(app, h);
    require("./hr/routes/recruitment")(app, h);
    require("./hr/routes/tickets")(app, h);
    require("./hr/routes/misc")(app, h);
    require("./hr/routes/workspace-v3")(app, h);
    ctx.log(`seeded ${db.employees.rows.length} employees, ${db.sessions.length} Discord sessions, ${db.runs.rows.length} payroll runs, ${db.applications.rows.length} candidates`);
  },

  sockets(io, ctx) {
    const { db, V, state } = legacyState(ctx);
    // Default namespace: accept so stray clients don't retry forever.
    io.on("connection", () => {});
    const nsp = io.of("/notifications");
    state.nsp = nsp;
    nsp.on("connection", (socket) => {
      const hs = socket.handshake || {};
      let token = hs.auth?.token || hs.query?.token || hs.headers?.authorization || "";
      if (typeof token === "string" && token.toLowerCase().startsWith("bearer ")) token = token.slice(7);
      if (typeof token === "string" && token.startsWith('"')) token = token.replace(/^"|"$/g, "");
      const user = identity.userFromToken(token);
      if (!user) {
        socket.emit("notifications.error", { message: "Unauthorized - connected without a user room" });
        return;
      }
      socket.join(`user:${user.id}`);
      socket.emit("notifications.ready", { userId: user.id, unread: db.notifications.rows.filter((n) => n.recipientUserId === user.id && !n.readAt).length });
    });
  },

  mounts: {
    sos(app, ctx) { return require("./hr/mounts")({ ...legacyState(ctx), L, identity: ctx.identity, util: ctx.util }).sos(app, ctx); },
    tasks(app, ctx) { return require("./hr/mounts")({ ...legacyState(ctx), L, identity: ctx.identity, util: ctx.util }).tasks(app, ctx); },
  },
};
