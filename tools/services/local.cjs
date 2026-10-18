const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { createLocalRouter } = require("./local-router.cjs");
const { apps, clientEnvironment } = require("./config.cjs");
const root = path.resolve(__dirname, "../..");
const origin = "http://localhost:3000";
const stateFile = path.join(root, ".vercel/local-suite/running.json");
const children = new Set();
let stopping = false, server;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server?.close();
  server?.closeAllConnections();
  for (const child of children) {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
  }
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

function freePort(port = 0) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => { const value = probe.address().port; probe.close(() => resolve(value)); });
  });
}
async function main() {
  if (!fs.existsSync(path.join(root, "node_modules", ".modules.yaml"))) throw new Error("Install dependencies first: pnpm install --frozen-lockfile");
  try { await freePort(3000); }
  catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    let state;
    try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); if (!Number.isInteger(state.pid) || state.pid < 1) throw new Error("Invalid process marker"); process.kill(state.pid, 0); }
    catch { throw new Error("Port 3000 is occupied. The existing process was left running."); }
    if (state.url !== origin || state.runtime !== "native") throw new Error("A previous local launcher is running on port 3000. Stop that run before restarting.");
    const response = await fetch(`${origin}/sos/api/backend/wm/v2/public/site`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok || response.headers.get("x-orgtik-local-runtime") !== "native") throw new Error("The existing local suite needs attention; no second copy was started.");
    console.log(`OrgTik is already running at ${origin}\nSign in: ${origin}/sos/auth/login`);
    return;
  }
  for (const key of Object.keys(process.env)) if (/^(KV_|UPSTASH_|REDIS_|VERCEL|MOCK_|ORGTIK_MOCK_|NEXT_PUBLIC_|VITE_|SUITE_)/i.test(key)) delete process.env[key];
  Object.assign(process.env, {
    SUITE_SERVICES_PUBLIC_URL: origin, ORGTIK_SERVICES: "1", ORGTIK_SERVICES_DEV: "1", VERCEL_ENV: "development",
    MOCK_AUTH_STORE: "file", MOCK_JOURNAL: "file", MOCK_SANDBOX: "services-local",
    NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "development",
  });
  // Build the injected library once, rather than once per frontend.
  const build = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@orgtik/ui", "run", "build"], { cwd: root, env: process.env, stdio: "inherit", windowsHide: true, shell: process.platform === "win32" });
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error("Shared UI build failed.");
  const launcherEnv = { ...process.env, SUITE_SOS_URL: `${origin}/sos`, SUITE_SOS_API: `${origin}/sos/api/backend/sos/api` };
  for (const key of apps) {
    const result = spawnSync(process.execPath, [path.join(root, "tools/vercel-prebuild.cjs")], { cwd: path.join(root, "apps", key), env: launcherEnv, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Could not configure ${key}'s local launcher.`);
  }
  const mock = require(path.join(root, "mock/index.js"));
  await require(path.join(root, "mock/server.js")).ready();
  async function startService(key) {
    const cwd = path.join(root, key === "website" ? "apps/website/landing-directions" : `apps/${key}`);
    const port = await freePort();
    const env = { ...process.env, ...clientEnvironment(key), PORT: String(port) };
    const script = key === "website" ? path.join(path.dirname(require.resolve("vite/package.json", { paths: [cwd] })), "bin/vite.js") : require.resolve("next/dist/bin/next", { paths: [cwd] });
    // Next normalizes loopback IPs to localhost in middleware URLs. Use that
    // same hostname for its listener and proxy so locale rewrites stay internal.
    const args = key === "website" ? ["--host", "localhost", "--port", String(port), "--strictPort"] : ["dev", "--turbopack", "--hostname", "localhost", "--port", String(port)];
    console.log(`[local] Starting ${key} on demand`);
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    children.add(child);
    child.on("exit", code => { children.delete(child); if (!stopping) { console.error(`${key} exited (${code}); restart the local suite.`); stop(code || 1); } });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${key} startup timed out`)), 60000);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      for (const stream of [child.stdout, child.stderr]) {
        let pending = "";
        stream.on("data", data => {
          pending += data;
          const lines = pending.split(/\r?\n/); pending = lines.pop();
          for (const line of lines) {
            console.log(`[${key}] ${line}`);
            const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
            if ((key === "website" ? /Local:\s+http/ : /Ready in/).test(clean)) { clearTimeout(timeout); resolve(port); }
          }
        });
      }
    });
  }
  server = createLocalRouter({ startService, mock });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3000, "127.0.0.1", resolve); });
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ pid: process.pid, url: origin, runtime: "native", config: "tools/services/config.cjs" }, null, 2));
  console.log(`OrgTik local prototype ready: ${origin}\nApps start when opened; mock data stays in .vercel/dev/mock.\nCtrl+C stops this run.`);
}
main().catch(error => { console.error(error.message); if (server || children.size) stop(1); else process.exitCode = 1; });
