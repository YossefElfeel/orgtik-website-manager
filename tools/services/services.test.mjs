import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { proxyBackend } from "./proxy.ts";
import { configurationFor, frontendProjects, projectName, configFilename } from "./projects.mjs";
import { assertHobbyLimit, inspectFunctions } from "./check-artifact.mjs";
const require = createRequire(import.meta.url);
const { apps, clientEnvironment, packages, servicesNextConfig, webUrls } = require("./config.cjs");
const config = JSON.parse(fs.readFileSync(new URL("../../vercel.dev.json", import.meta.url)));

test("each frontend project retains its private binding and the website gateway preserves every public prefix", () => {
  const gateway = configurationFor("website");
  assert.deepEqual(Object.keys(gateway.services), ["website"]);
  for (const app of frontendProjects) {
    const value = configurationFor(app);
    assert.deepEqual(Object.keys(value.services), [app, "mock"]);
    assert.deepEqual(value.services[app].bindings, [{ type: "service", service: "mock", format: "url", env: "ORGTIK_MOCK_URL" }]);
    assert.deepEqual(value.rewrites, [{ source: `/${app}/:path*`, destination: { service: app } }]);
    assert.equal(gateway.rewrites.find(rule => rule.source === `/${app}/:path*`).destination, `https://${projectName(app)}.vercel.app/${app}/:path*`);
    assert.equal(configFilename(app), `vercel.${app}.json`);
  }
  assert.deepEqual(gateway.rewrites.at(-1), { source: "/(.*)", destination: { service: "website" } });
  assert.throws(() => configurationFor("mock"), /Unknown deployment/);
});

test("public routes select every active frontend, including its bare base path, and never expose mock", () => {
  const route = path => config.rewrites.find(rule => rule.source === "/(.*)" || path === rule.source.split("/:")[0] || path.startsWith(rule.source.split("/:")[0] + "/"))?.destination.service;
  for (const app of apps) {
    assert.equal(route(`/${app}`), app);
    assert.equal(route(`/${app}/en/auth`), app);
    assert.equal(route(`/${app}/_next/static/chunk.js`), app);
    assert.equal(route(`/${app}/api/backend/sos/api/auth/login`), app);
    assert.equal(require(`../../apps/${app}/package.json`).name, packages[app]);
    assert.deepEqual(config.services[app].bindings, [{ type: "service", service: "mock", format: "url", env: "ORGTIK_MOCK_URL" }]);
    assert.ok(fs.existsSync(new URL(`../../apps/${app}/app/api/backend/[...path]/route.ts`, import.meta.url)));
  }
  assert.equal(route("/"), "website");
  assert.equal(route("/services/design"), "website");
  assert.equal(route("/mock/sos/api/auth/login"), "website");
  assert.ok(!config.rewrites.some(rule => rule.destination.service === "mock"));
  assert.ok(!config.services.ui && !config.services.content && !config.services.docs);
  for (const name of ["functions", "installCommand", "buildCommand", "devCommand", "ignoreCommand", "outputDirectory", "framework"]) assert.ok(!(name in config));
});

test("build URLs point at the same deployment and never require or publish a binding", () => {
  const env = { ORGTIK_SERVICES: "1", VERCEL: "1", VERCEL_URL: "suite-preview.example" };
  const urls = webUrls(env);
  assert.equal(urls.sos, "https://suite-preview.example/sos");
  assert.equal(urls.website, "https://suite-preview.example");
  for (const app of apps) {
    const value = servicesNextConfig(app, env);
    assert.equal(value.basePath, `/${app}`);
    assert.ok(!("ORGTIK_MOCK_URL" in value.env));
    assert.ok(value.env.NEXT_PUBLIC_API_URL.startsWith(`https://suite-preview.example/${app}/api/backend/${app}`));
    assert.equal(value.env.NEXT_PUBLIC_SOS_URL, urls.sos);
  }
  assert.equal(clientEnvironment("website", env).VITE_CMS_API, "https://suite-preview.example/sos/api/backend/wm/v2");
  // postMessage compares event.origin, which never includes the WM path prefix.
  assert.equal(clientEnvironment("website", env).VITE_WM_ORIGIN, "https://suite-preview.example");
  assert.deepEqual(servicesNextConfig("sos", {}), {});
  assert.throws(() => webUrls({ VERCEL: "1", SUITE_SERVICES_PUBLIC_URL: "http://localhost:3000" }), /HTTPS/);
});

test("the upload guard accepts twelve functions and blocks an oversized split project", () => {
  assert.doesNotThrow(() => assertHobbyLimit({ total: 12, counts: { sos: 11, mock: 1 } }));
  assert.throws(() => assertHobbyLimit({ total: 13, counts: { sos: 12, mock: 1 } }), /Upload was stopped/);
});

test("function inventory distinguishes deferred Next.js routes from dedicated functions and rejects Edge output", () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "services-functions-"));
  const write = (service, name, config) => {
    const folder = path.join(output, service, "functions", `${name}.func`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, ".vc-config.json"), JSON.stringify(config));
  };
  try {
    for (let i = 0; i < 20; i++) write("admin", `page-${i}`, { runtime: "nodejs22.x", framework: { slug: "nextjs" }, experimentalAllowBundling: true });
    write("mock", "index", { runtime: "nodejs22.x" });
    const inventory = inspectFunctions(output);
    assert.equal(inventory.total, 21);
    assert.equal(inventory.dedicated, 1);
    assert.deepEqual(inventory.deferred, { admin: 20 });
    assert.doesNotThrow(() => assertHobbyLimit(inventory));
    fs.symlinkSync(path.join(output, "admin/functions/page-0.func"), path.join(output, "admin/functions/alias.func"), process.platform === "win32" ? "junction" : "dir");
    assert.equal(inspectFunctions(output).total, 21, "function aliases must not increase the inventory");
    // An unknown framework cannot opt out of the dedicated-function guard.
    for (let i = 0; i < 12; i++) write("mock", `api-${i}`, { runtime: "nodejs22.x", experimentalAllowBundling: true });
    assert.throws(() => assertHobbyLimit(inspectFunctions(output)), /13 dedicated functions/);
    write("admin", "edge", { runtime: "edge" });
    assert.throws(() => inspectFunctions(output), /cannot deploy Edge/);
  } finally {
    const relative = path.relative(os.tmpdir(), output);
    assert.ok(relative.startsWith("services-functions-") && !relative.includes(path.sep));
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test("gateway uses the runtime binding, preserves authentication/body/query, and streams the response", async () => {
  const before = process.env.ORGTIK_MOCK_URL, fetchBefore = globalThis.fetch;
  const body = JSON.stringify({ mode: "staff", target: "wm" });
  process.env.ORGTIK_MOCK_URL = "https://private.invalid/service/mock/";
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url.href, "https://private.invalid/service/mock/sos/api/auth/login?mode=staff");
      assert.equal(init.headers.get("authorization"), "Bearer fixture-only");
      assert.equal(init.headers.get("content-length"), String(Buffer.byteLength(body)));
      assert.equal(init.headers.get("if-match"), '"fixture-version"');
      assert.equal(init.headers.get("x-workspace"), "w1");
      assert.equal(init.headers.get("idempotency-key"), "operation-1");
      assert.equal(init.headers.get("x-mock-replay"), null);
      assert.equal(init.headers.get("cookie"), null);
      assert.equal(init.redirect, "manual");
      assert.deepEqual(await new Response(init.body).json(), { mode: "staff", target: "wm" });
      return Response.json({ data: { result: "fixture" } }, { status: 401 });
    };
    const result = await proxyBackend(new Request("https://public.invalid/sos/api/backend/sos/api/auth/login?mode=staff", { method: "POST", headers: { authorization: "Bearer fixture-only", "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "if-match": '"fixture-version"', "x-workspace": "w1", "idempotency-key": "operation-1", "x-mock-replay": "1", cookie: "untrusted" }, body }));
    assert.equal(result.status, 401);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(await result.json(), { data: { result: "fixture" } });
  } finally { globalThis.fetch = fetchBefore; if (before === undefined) delete process.env.ORGTIK_MOCK_URL; else process.env.ORGTIK_MOCK_URL = before; }
});

test("local Services use isolated session persistence; production still fails closed without Redis", () => {
  const sessions = require("../../mock/lib/session-store.js"), local = { ORGTIK_SERVICES_DEV: "1", VERCEL_ENV: "development", VERCEL: "1", MOCK_SANDBOX: "services-test" };
  assert.equal(sessions.pickStore({ hosted: true, dataDir: ".vercel/dev/mock" }, { env: local }).kind, "file");
  assert.equal(sessions.pickStore({ hosted: true }, { env: { ...local, VERCEL_ENV: "production" } }).kind, "unavailable");
  assert.equal(sessions.pickStore({ hosted: true }, { env: { VERCEL: "1", MOCK_SANDBOX: "services-test" } }).kind, "unavailable");
});

test("gateway rejects arbitrary destinations and mock controls, and fails closed without its binding", async () => {
  const before = process.env.ORGTIK_MOCK_URL, fetchBefore = globalThis.fetch;
  try {
    delete process.env.ORGTIK_MOCK_URL;
    assert.equal((await proxyBackend(new Request("https://public.invalid/wm/api/backend/wm/v2/public/pages"))).status, 503);
    process.env.ORGTIK_MOCK_URL = "https://private.invalid/";
    globalThis.fetch = () => { throw new Error("Must not reach upstream"); };
    for (const path of ["https://outside.invalid", "content/api", "sos/__mock/reset", "wm/v2/__mock/forms-live", "sos/api/%2f%2fevil"]) assert.equal((await proxyBackend(new Request(`https://public.invalid/sos/api/backend/${path}`))).status, 404);
    globalThis.fetch = () => { throw new Error("private provider detail"); };
    const response = await proxyBackend(new Request("https://public.invalid/tasks/api/backend/tasks/api/projects"));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private provider detail"));
  } finally { globalThis.fetch = fetchBefore; if (before === undefined) delete process.env.ORGTIK_MOCK_URL; else process.env.ORGTIK_MOCK_URL = before; }
});

test("gateway rewrites private redirects and never leaks a binding host", async () => {
  const before = process.env.ORGTIK_MOCK_URL, fetchBefore = globalThis.fetch;
  process.env.ORGTIK_MOCK_URL = "https://private.invalid/";
  try {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "/files/uploads/sample.pdf" } });
    const response = await proxyBackend(new Request("https://public.invalid/files/api/backend/files/api/download"));
    assert.equal(response.headers.get("location"), "https://public.invalid/files/api/backend/files/uploads/sample.pdf");
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://unexpected.invalid/" } });
    assert.equal((await proxyBackend(new Request("https://public.invalid/files/api/backend/files/api/download"))).status, 502);
  } finally { globalThis.fetch = fetchBefore; if (before === undefined) delete process.env.ORGTIK_MOCK_URL; else process.env.ORGTIK_MOCK_URL = before; }
});
