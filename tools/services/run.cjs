// Vercel builds/dev starts one service at a time. Do not read bindings here.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apps, packages, clientEnvironment, publicOrigin } = require("./config.cjs");
const [mode, key] = process.argv.slice(2);
if (!["build", "dev"].includes(mode) || ![...apps, "website"].includes(key)) throw new Error("Usage: run.cjs build|dev <service>");
const root = path.resolve(__dirname, "../..");
const env = { ...process.env, ORGTIK_SERVICES: "1", ...clientEnvironment(key) };
env.SUITE_SOS_URL = `${publicOrigin()}/sos`;
env.SUITE_SOS_API = `${publicOrigin()}/${key === "website" ? "sos" : key}/api/backend/sos/api`;
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", shell: process.platform === "win32" && command !== process.execPath });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
if (mode === "build") {
  if (key !== "website") run(process.execPath, [path.join(root, "tools/vercel-prebuild.cjs")], path.join(root, "apps", key));
  run("pnpm", ["--filter", `${packages[key]}...`, "run", "build"]);
} else {
  if (key !== "website") run("pnpm", ["--filter", "@orgtik/ui", "run", "build"]);
  const cwd = key === "website" ? path.join(root, "apps/website/landing-directions") : path.join(root, "apps", key);
  const command = key === "website" ? "vite" : "next";
  const args = key === "website" ? ["--host", "127.0.0.1", "--port", process.env.PORT || "3000"] : ["dev", "--port", process.env.PORT || "3000"];
  run("pnpm", ["exec", command, ...args], cwd);
}
