// One command for everything: patches packages, starts the mock APIs, then every app's dev server.
//   node start-all.js                 all apps
//   node start-all.js tasks,files     only these apps (the SOS login app always starts)
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const ROOT = path.resolve(__dirname, "..");
const wanted = (process.argv[2] || "").split(",").filter(Boolean);
const keys = Object.keys(config.apps).filter((k) => !config.apps[k].reserved && (!wanted.length || k === "sos" || wanted.includes(k)));
const children = [];

function run(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, shell: true, env: { ...process.env, ...env } });
  const prefix = `[${name}]`.padEnd(12);
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) if (l.trim()) out.write(`${prefix} ${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => console.log(`${prefix} exited (${code})`));
  children.push(child);
  return child;
}

spawnSync(process.execPath, [path.join(__dirname, "patch.js")], { stdio: "inherit" });
run("api", process.execPath, [path.join(__dirname, "server.js")], __dirname);

for (const key of keys) {
  const app = config.apps[key];
  const dir = path.join(ROOT, app.dir);
  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    console.log(`[${key}] skipped: dependencies not installed (npm ci in ${app.dir})`);
    continue;
  }
  const devScript = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).scripts?.dev || "";
  const args = app.devArgs || (/\s-p\s|--port/.test(devScript) ? ["run", "dev"] : ["run", "dev", "--", "-p", String(app.web)]);
  // Same cookie-size reason as the mock API: raise Node's 16 KB header limit for the dev servers.
  run(`web:${key}`, "npm", args, dir, { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --max-http-header-size=65536`.trim() });
}

console.log("\nOpen the login app: " + config.webUrl("sos") + "/auth/login");
for (const k of keys) console.log(`  ${k.padEnd(10)} ${config.webUrl(k)}`);
console.log("Press Ctrl+C to stop everything.\n");

function stopAll() {
  for (const c of children) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGINT");
  }
  process.exit(0);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
