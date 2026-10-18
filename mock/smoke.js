// Boot and access check for the whole local suite.
//
//   node smoke.js                 check the running mocks and web apps
//   node smoke.js --no-web        skip the web apps (APIs and identities only)
//   MOCK_PORT_OFFSET=100 node smoke.js   check a mock started with the same offset
//
// 1. Every mock API answers /__health, and every web app answers HTTP (under 500).
// 2. Every test person signs in, loads their profile and their launcher scopes.
// 3. For every app a person has access to (from their scopes), one real screen endpoint
//    answers 2xx with their token. People without access are probed too, and the status
//    is recorded: the mocks don't gate by scope; the web apps do that themselves.
//
// Writes logs/readiness.json and prints a summary. Exits 1 if anything that should work doesn't.

const fs = require("fs");
const path = require("path");
const config = require("./config");
const identity = require("./lib/identity");

const checkWeb = !process.argv.includes("--no-web");

// One screen endpoint per app, the kind of call its first screen makes (path from the API port).
const PROBES = {
  sos: "/api/auth/my-scopes",
  tasks: "/api/analytics/user-dashboard",
  files: "/api/v1/archive/navigation/root",
  sales: "/api/activity-feed",
  hr: "/api/attendance/summary",
  marketing: "/analytics/reports/overview",
  content: "/api/analytics/dashboard",
};

const apiApps = Object.keys(config.apps).filter((k) => config.apps[k].api != null && !config.apps[k].reserved);
const webApps = Object.keys(config.apps).filter((k) => !config.apps[k].reserved);
const appByWebPort = Object.fromEntries(Object.entries(config.apps).map(([k, a]) => [String(a.web), k]));

async function get(url, token, opts = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(opts.timeout || 15000),
      ...opts,
    });
    let body = null;
    if ((res.headers.get("content-type") || "").includes("json")) body = await res.json().catch(() => null);
    else await res.arrayBuffer().catch(() => null);
    return { status: res.status, ms: Date.now() - started, body };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, error: e.name === "TimeoutError" ? "timeout" : e.cause?.code || e.message };
  }
}

async function post(url, data) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (e) {
    return { status: 0, error: e.cause?.code || e.message };
  }
}

(async () => {
  const report = { at: new Date().toISOString(), apis: {}, web: {}, people: [], problems: [] };

  // 1a. APIs
  for (const k of apiApps) {
    const r = await get(`${config.apiUrl(k)}/__health`);
    report.apis[k] = { url: config.apiUrl(k), status: r.status, ms: r.ms, generation: r.body?.generation ?? null };
    if (r.status !== 200) report.problems.push(`API ${k} (${config.apiUrl(k)}) is not answering: ${r.error || r.status}`);
  }
  const mockStatus = await get(`${config.apiUrl("sos")}/__mock/status`);
  report.clock = mockStatus.body?.data?.clock || null;

  // 1b. Web apps (a cold Next.js route can take a while to compile, hence the long timeout)
  if (checkWeb) {
    await Promise.all(
      webApps.map(async (k) => {
        const r = await get(config.webUrl(k), null, { timeout: 120000 });
        report.web[k] = { url: config.webUrl(k), status: r.status, ms: r.ms, error: r.error };
        if (!(r.status > 0 && r.status < 500)) report.problems.push(`Web app ${k} (${config.webUrl(k)}) is not answering: ${r.error || r.status}`);
      }),
    );
  }

  // 2 + 3. People
  const people = identity.users.map((u) => ({ key: u.key, email: u.email, name: `${u.firstName} ${u.lastName}` }));
  for (const p of people) {
    const row = { ...p, login: null, me: null, apps: {}, noAccess: {} };
    const login = await post(`${config.apiUrl("sos")}/api/auth/login`, { email: p.email, password: identity.LOCAL_PASSWORD });
    row.login = login.status;
    const token = login.body?.data?.tokens?.accessToken;
    if (!token) {
      report.problems.push(`${p.name} can't sign in (${login.error || login.status})`);
      report.people.push(row);
      continue;
    }
    row.me = (await get(`${config.apiUrl("sos")}/api/auth/me`, token)).status;
    if (row.me !== 200) report.problems.push(`${p.name}: /api/auth/me answered ${row.me}`);

    const scopes = (await get(`${config.apiUrl("sos")}/api/auth/my-scopes`, token)).body?.data || [];
    const granted = new Set(
      scopes
        .map((s) => {
          try {
            return appByWebPort[new URL(s.domain).port];
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );
    row.launcher = scopes.map((s) => s.displayName || s.name);

    for (const k of apiApps) {
      const probe = PROBES[k];
      if (!probe) continue;
      const r = await get(`${config.apiUrl(k)}${probe}`, token);
      if (k === "sos" || granted.has(k)) {
        row.apps[k] = r.status;
        if (!(r.status >= 200 && r.status < 300)) report.problems.push(`${p.name} has access to ${k} but ${probe} answered ${r.error || r.status}`);
      } else {
        row.noAccess[k] = r.status;
      }
    }
    if (granted.has("chats")) row.apps.chats = "web only";
    report.people.push(row);
  }

  // Output
  const outFile = path.join(__dirname, "logs", "readiness.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  const cell = (v) => (v == null ? "·" : v === "web only" ? "web" : v >= 200 && v < 300 ? "ok" : String(v));
  console.log(`\nClock: ${report.clock ? `${report.clock.mode} at ${report.clock.now}` : "unknown"}`);
  console.log("\nAPIs:     " + apiApps.map((k) => `${k} ${cell(report.apis[k].status)}`).join(" · "));
  if (checkWeb) console.log("Web apps: " + webApps.map((k) => `${k} ${report.web[k].status || report.web[k].error}`).join(" · "));
  const cols = [...apiApps, "chats"];
  console.log(`\n| Person | login | ${cols.join(" | ")} |`);
  console.log(`|---|---|${cols.map(() => "---").join("|")}|`);
  for (const r of report.people) {
    console.log(`| ${r.name} | ${cell(r.login)} | ${cols.map((k) => (k in r.apps ? cell(r.apps[k]) : "—")).join(" | ")} |`);
  }
  console.log("\nok = has access and the screen endpoint answered 2xx · — = no access in the launcher · web = web-only app");
  console.log(report.problems.length ? `\n${report.problems.length} problem(s):\n- ${report.problems.join("\n- ")}` : "\nNo problems.");
  console.log(`\nFull report: ${outFile}`);
  process.exit(report.problems.length ? 1 : 0);
})();
