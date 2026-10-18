const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { registerRoles, validateRoleOverrides } = require("./roles");
const { permissionsFor } = require("./permissions");

test("Role edits enforce authority, versions and self-protection, and immediately change effective access", async (t) => {
  const overrides = {},
    audit = [];
  const actorRoles = {
    admin: ["wm_admin"],
    editor: ["wm_editor"],
    owner: ["wm_owner"],
  };
  const identity = {
    grants: { global: { owner: { roles: ["super_admin"] } } },
  };
  const app = express();
  app.use(express.json());
  const need = (permission) => (req, res, next) => {
    const key = req.get("actor") || "admin";
    req.who = {
      user: { key },
      roles: actorRoles[key],
      permissions: permissionsFor(actorRoles[key], overrides),
    };
    if (!req.who.permissions.includes(permission))
      return res.status(403).json({ code: "forbidden" });
    next();
  };
  registerRoles(app, {
    identity,
    store: { audit },
    overrides,
    need,
    ok: (res, data) => res.json({ data }),
    fail: (res, status, code) => res.status(status).json({ code }),
  });
  app.post("/create", need("content:create"), (_req, res) =>
    res.status(204).end(),
  );
  app.patch("/edit", need("content:edit"), (_req, res) =>
    res.status(204).end(),
  );
  app.delete("/delete", need("content:delete"), (_req, res) =>
    res.status(204).end(),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const call = async (method, url, body, version, actor = "admin") => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${url}`,
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
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  const roles = (await call("GET", "/v2/admin/roles")).body.data;
  assert.deepEqual(
    roles.slice(0, 3).map((r) => r.label),
    ["Owner", "Super admin", "Admin"],
  );
  const editor = roles.find((r) => r.key === "wm_editor");
  const permissions = editor.permissions.filter(
    (p) => !["content:create", "content:delete"].includes(p),
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_editor",
        { permissions },
        editor.version,
        "editor",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_owner",
        { permissions },
        roles[0].version,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_editor",
        { permissions: ["unknown:grant"] },
        editor.version,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_editor",
        { permissions: ["content:view", "content:view"] },
        editor.version,
      )
    ).status,
    422,
  );
  assert.equal(
    (await call("PATCH", "/v2/admin/roles/wm_editor", { permissions }, "stale"))
      .status,
    412,
  );
  const saved = await call(
    "PATCH",
    "/v2/admin/roles/wm_editor",
    { permissions },
    editor.version,
  );
  assert.equal(saved.status, 200);
  assert.notEqual(saved.body.data.version, editor.version);
  assert.equal(
    (await call("POST", "/create", {}, undefined, "editor")).status,
    403,
  );
  assert.equal(
    (await call("DELETE", "/delete", undefined, undefined, "editor")).status,
    403,
  );
  assert.equal(
    (await call("PATCH", "/edit", {}, undefined, "editor")).status,
    204,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_editor",
        { permissions },
        editor.version,
      )
    ).status,
    412,
  );
  assert.equal(audit[0].action, "role_permissions");
  const admin = roles.find((r) => r.key === "wm_admin");
  assert.equal(
    (
      await call(
        "PATCH",
        "/v2/admin/roles/wm_admin",
        { permissions: admin.permissions.filter((p) => p !== "roles:manage") },
        admin.version,
      )
    ).body.code,
    "self_lockout",
  );
  assert.deepEqual(validateRoleOverrides(overrides), overrides);
  assert.throws(() => validateRoleOverrides({ wm_editor: ["unknown:grant"] }));
});
