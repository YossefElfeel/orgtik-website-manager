const { test } = require("node:test");
const assert = require("node:assert/strict"),
  http = require("node:http"),
  express = require("express");
const { registerUsers } = require("./users"),
  { permissionsFor } = require("./permissions");
const { setPassword, passwordMatches } = require("../../lib/auth-store");

test("Website administrators respect central account permissions, internal membership, version checks and self-protection", async (t) => {
  const users = ["admin", "webadmin", "staff", "customer"].map(
    (key, index) => ({
      id: index + 1,
      key,
      firstName: key,
      lastName: "Fixture",
      email: `${key}@example.test`,
      isActive: true,
      updatedAt: "2026-10-09T00:00:00Z",
    }),
  );
  const identity = {
    users,
    grants: {
      global: { admin: { roles: ["super_admin"] } },
      website_manager: {
        admin: { roles: ["wm_admin"] },
        webadmin: { roles: ["wm_admin"] },
        staff: { roles: ["wm_editor"] },
      },
    },
    findUser: (id) => users.find((user) => user.id === id),
    fullName: (user) => `${user.firstName} ${user.lastName}`,
    setPassword,
  };
  const workspace = {
      members: users
        .slice(0, 3)
        .map((user) => ({
          userKey: user.key,
          role: "member",
          status: "active",
        })),
    },
    logs = [],
    audit = [];
  const platform = {
    db: {},
    workspace: () => workspace,
    id: () => "member-new",
    iso: (value) => new Date(value).toISOString(),
    now: () => Date.now(),
    log: (...event) => logs.push(event),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.who = {
      user: users.find((user) => user.key === (req.get("actor") ?? "webadmin")),
    };
    next();
  });
  registerUsers(app, {
    identity,
    platform: () => platform,
    store: { audit },
    need: (permission) => (req, res, next) =>
      permissionsFor(
        identity.grants.website_manager[req.who.user.key]?.roles ?? [],
      ).includes(permission)
        ? next()
        : res.status(403).end(),
    ok: (res, data, meta = {}, status = 200) =>
      res.status(status).json({ data, meta }),
    fail: (res, status, code) => res.status(status).json({ code }),
    page: (_req, rows) => ({ rows, meta: { total: rows.length } }),
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const call = async (method, route, body, version, actor = "webadmin") => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/v2/admin/users${route}`,
      {
        method,
        headers: {
          actor,
          "content-type": "application/json",
          ...(version ? { "if-match": version } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const text = await response.text();
    return { status: response.status, ...(text ? JSON.parse(text) : {}) };
  };
  const listed = await call("GET", "");
  assert.equal(listed.data.length, 3);
  assert.ok(!listed.data.some((user) => user.key === "customer"));
  assert.equal(
    (await call("GET", "", undefined, undefined, "staff")).status,
    403,
  );
  assert.equal(
    (
      await call("POST", "", {
        firstName: "New",
        lastName: "Account",
        email: "new@example.test",
        password: "FixturePassword!",
      })
    ).status,
    403,
  );
  const staff = listed.data.find((user) => user.key === "staff"),
    self = listed.data.find((user) => user.key === "webadmin");
  for (const role of ["wm_owner", "wm_super_admin"])
    assert.equal((await call("PATCH", "/3", { roles: [role] }, staff.version)).status, 403);
  assert.equal(
    (await call("PATCH", "/3", { active: false }, staff.version)).status,
    403,
  );
  assert.equal(
    (await call("PATCH", "/2", { roles: ["wm_editor"] }, self.version)).code,
    "self_lockout",
  );
  assert.equal(
    (await call("PATCH", "/3", { roles: ["super_admin"] }, staff.version))
      .status,
    422,
  );
  const changed = await call(
    "PATCH",
    "/3",
    { roles: ["wm_viewer"] },
    staff.version,
  );
  assert.equal(changed.status, 200);
  assert.equal(platform.db.staffAccessEpochs.staff, 1);
  assert.equal(
    (await call("PATCH", "/3", { roles: ["wm_seo"] }, staff.version)).status,
    412,
  );
  const unchanged = await call(
    "PATCH",
    "/3",
    { roles: ["wm_viewer"] },
    changed.data.version,
  );
  assert.equal(platform.db.staffAccessEpochs.staff, 1);
  workspace.members.find((member) => member.userKey === "staff").status =
    "inactive";
  assert.equal(
    (await call("PATCH", "/3", { roles: ["wm_seo"] }, unchanged.data.version))
      .code,
    "internal_member_required",
  );
  const created = await call(
    "POST",
    "",
    {
      firstName: "New",
      lastName: "Account",
      email: "NEW@example.test",
      password: "FixturePassword!",
    },
    undefined,
    "admin",
  );
  assert.equal(created.status, 201);
  const raw = users.find((user) => user.id === created.data.id);
  assert.equal(raw.password, undefined);
  assert.ok(passwordMatches(raw, "FixturePassword!"));
  assert.ok(audit.some((event) => event.action === "user_create"));
  assert.ok(audit.some((event) => event.action === "user_roles"));
  assert.ok(logs.length >= 2);
});
