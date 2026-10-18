// Isolation of owned CommonJS state; this is not a sandbox for untrusted code.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const ROOT = path.resolve(__dirname, "..");
const APPS = new Set(["tasks", "files", "hr", "sales", "marketing", "chats"]);
const failure = message => Object.assign(new Error(message), { status: 503, code: "workspace_runtime_unavailable" });

function createPrivateModuleGraph({ appKey, identity, config, util, Date: BusinessDate = Date, manifest, overrides = {} }) {
  if (!APPS.has(appKey) || !identity?.workspaceMode) throw failure("Invalid private workspace runtime");
  const allowed = new Set(manifest || []), cache = new Map();
  const roots = [`apps/${appKey}.js`, `apps/${appKey}/`];
  const context = vm.createContext({ Buffer, console, process, URL, URLSearchParams, AbortController, AbortSignal, Date: BusinessDate, Math: Object.create(Math), structuredClone, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate });
  vm.runInContext("globalThis.global = globalThis", context);
  const injected = new Map([
    [path.join(ROOT, "lib/identity.js"), identity],
    [path.join(ROOT, "config.js"), config],
    [path.join(ROOT, "lib/util.js"), util || require("./util")],
    ...Object.entries(overrides).map(([name, value]) => [path.resolve(ROOT, name), value]),
  ]);
  const localPath = (request, parent) => {
    const absolute = path.resolve(path.dirname(parent), request);
    const found = [absolute, `${absolute}.js`, `${absolute}.json`, path.join(absolute, "index.js")].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!found) throw failure(`Missing owned module: ${request}`);
    const relative = path.relative(ROOT, found).replace(/\\/g, "/");
    if (relative.startsWith("../") || path.isAbsolute(relative)) throw failure("Owned module escaped the mock directory");
    if (injected.has(found)) return { injected: injected.get(found) };
    if (!allowed.has(relative) || !roots.some(root => relative === root || relative.startsWith(root)) && !relative.startsWith("lib/")) throw failure(`Module is absent from workspace manifest: ${relative}`);
    return { filename: found };
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    try {
      if (filename.endsWith(".json")) module.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      else {
        const nativeRequire = Module.createRequire(filename);
        const requirePrivate = request => {
          if (!request.startsWith(".") && !path.isAbsolute(request)) return nativeRequire(request);
          const resolved = localPath(request, filename);
          return Object.hasOwn(resolved, "injected") ? resolved.injected : load(resolved.filename);
        };
        requirePrivate.resolve = request => request.startsWith(".") ? localPath(request, filename).filename : nativeRequire.resolve(request);
        const fn = new vm.Script(Module.wrap(fs.readFileSync(filename, "utf8")), { filename }).runInContext(context);
        fn(module.exports, requirePrivate, module, filename, path.dirname(filename));
      }
      return module.exports;
    } catch (error) { cache.delete(filename); throw error; }
  }
  return {
    load: () => load(localPath(`./apps/${appKey}.js`, path.join(ROOT, "entry.js")).filename),
    close() { cache.clear(); },
  };
}
module.exports = { createPrivateModuleGraph };
