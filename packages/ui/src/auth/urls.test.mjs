import test from "node:test";
import assert from "node:assert/strict";
import { appPath, appRelativePath, appUrl, pathInApp } from "../../dist/auth/urls.js";
test("native browser URLs retain one base path while Next navigation receives an app-relative path", () => {
  const before = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = "/wm";
    assert.equal(appPath("/en/auth"), "/wm/en/auth");
    assert.equal(appPath("/wm/en/auth"), "/wm/en/auth");
    assert.equal(appRelativePath("/wm/en/content?tab=pages"), "/en/content?tab=pages");
    assert.equal(appPath("https://external.invalid/"), "https://external.invalid/");
    assert.equal(appUrl("https://suite.invalid/sos", "/auth/login").href, "https://suite.invalid/sos/auth/login");
    assert.equal(pathInApp(new URL("https://suite.invalid/tasks/en/projects"), "https://suite.invalid/tasks"), "/en/projects");
    assert.equal(pathInApp(new URL("https://suite.invalid/tasks-else/en/projects"), "https://suite.invalid/tasks"), null);
    assert.equal(pathInApp(new URL("https://suite.invalid/wm/en/content"), "https://suite.invalid/tasks"), null);
    assert.equal(pathInApp(new URL("https://outside.invalid/tasks"), "https://suite.invalid/tasks"), null);
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    assert.equal(appPath("/en/auth"), "/en/auth");
  } finally { if (before === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH; else process.env.NEXT_PUBLIC_BASE_PATH = before; }
});

test("customer and staff app bundles sharing one origin retain separate tab sessions", async () => {
  const envBefore = process.env.NEXT_PUBLIC_BASE_PATH, windowBefore = globalThis.window;
  const storage = new Map(), events = new EventTarget();
  globalThis.window = { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, dispatchEvent: events.dispatchEvent.bind(events) };
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = "/sos";
    const customer = await import("../../dist/auth/session.js?service=sos");
    process.env.NEXT_PUBLIC_BASE_PATH = "/wm";
    const staff = await import("../../dist/auth/session.js?service=wm");
    const envelope = token => ({ user: { id: 1 }, tokens: { accessToken: token, refreshToken: token, expiresIn: 60 }, scopes: [], workspaceContext: null, staffAccess: null });
    customer.setClientSession(envelope("customer-fixture"));
    staff.setClientSession(envelope("staff-fixture"));
    assert.equal(customer.readClientSession().tokens.accessToken, "customer-fixture");
    assert.equal(staff.readClientSession().tokens.accessToken, "staff-fixture");
    staff.clearClientSession();
    assert.equal(customer.readClientSession().tokens.accessToken, "customer-fixture");
    assert.equal(staff.readClientSession(), null);
  } finally { globalThis.window = windowBefore; if (envBefore === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH; else process.env.NEXT_PUBLIC_BASE_PATH = envBefore; }
});
