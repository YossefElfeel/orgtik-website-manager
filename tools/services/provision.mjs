// Runs in GitHub Actions using the existing deployment secret. Never prints or
// exports store credentials; only the new, confirmed project is modified.
import fs from "node:fs";
import path from "node:path";
import { projectName, publicOrigin } from "./projects.mjs";
const key = process.argv[2] || "website";
const team = "team_Ypx8oiLDZi3PBNi8ht8fYPsm", name = projectName(key);
const sourceProject = "prj_74P0VeIbDAIyUy8u5r6h91mwai1o";
const token = process.env.VERCEL_TOKEN;
if (process.env.GITHUB_ACTIONS !== "true" || !token || !process.env.RUNNER_TEMP) throw new Error("Use the reviewed Services deployment workflow with its existing CI credentials.");

async function api(endpoint, method = "GET", body, allow404 = false) {
  const url = new URL(endpoint, "https://api.vercel.com");
  url.searchParams.set("teamId", team);
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const error = (await response.json().catch(() => null))?.error;
    const code = typeof error?.code === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(error.code) ? ` ${error.code}` : "";
    throw new Error(`Vercel ${method} ${url.pathname} failed (${response.status}${code}); provider values are omitted.`);
  }
  const payload = await response.text();
  if (!payload.trim()) return null;
  try { return JSON.parse(payload); }
  catch { throw new Error(`Vercel ${method} ${url.pathname} returned malformed JSON; provider values are omitted.`); }
}

let project = await api(`/v9/projects/${name}`, "GET", undefined, true);
// nodeVersion is an update field, not accepted by the create-project endpoint.
if (!project) project = await api("/v11/projects", "POST", { name, framework: null });
if (project.name !== name || project.accountId !== team || !project.id?.startsWith("prj_")) throw new Error("New Services project ownership does not match the confirmed target.");
if (project.rootDirectory && project.rootDirectory !== ".") throw new Error("Services project must use the repository root.");
if (project.nodeVersion !== "22.x") await api(`/v9/projects/${project.id}`, "PATCH", { nodeVersion: "22.x" });

const copy = [];
if (key !== "website") {
  const source = await api(`/v10/projects/${sourceProject}/env`);
  const rows = Array.isArray(source) ? source : source.envs || [];
  const keys = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  const inEnvironment = (row, target) => !row.gitBranch && (Array.isArray(row.target) ? row.target.includes(target) : row.target === target);
  const hasPair = values => [["KV_REST_API_URL", "KV_REST_API_TOKEN"], ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]].some(pair => pair.every(key => values.some(row => row.key === key)));
  const managed = rows.filter(row => keys.includes(row.key) && inEnvironment(row, "production") && row.contentHint?.type === "integration-store-secret");
  const stores = [...new Set(managed.map(row => row.contentHint.storeId))];
  if (hasPair(managed)) {
    if (stores.length !== 1 || !/^store_[a-zA-Z0-9]+$/.test(stores[0])) throw new Error("The existing Redis integration is ambiguous.");
    const storeId = stores[0];
    const resource = await api(`/v1/storage/stores/${storeId}`);
    if (resource.store?.id !== storeId) throw new Error("The existing Redis resource identity does not match.");
    // The CLI uses projectsMetadata here; the connections endpoint instead
    // returns display rows with nested project details.
    const connections = resource.store.projectsMetadata || [];
    const origins = connections.filter(row => row.projectId === sourceProject && row.environments?.includes("production"));
    if (origins.length !== 1) throw new Error("The Redis store is not uniquely connected to the existing Production mock.");
    const destinations = connections.filter(row => row.projectId === project.id);
    if (destinations.length === 0) {
      // Same API and prefix option as Vercel CLI connectResourceToProject. Vercel
      // provisions its managed Secrets directly; no credential is read or copied.
      await api(`/v1/storage/stores/${storeId}/connections`, "POST", {
        projectId: project.id, type: "integration", envVarEnvironments: ["production", "preview"],
        ...(typeof origins[0].envVarPrefix === "string" ? { envVarPrefix: origins[0].envVarPrefix } : {}),
      });
    } else if (!["production", "preview"].every(target => destinations.some(row => row.environments?.includes(target)))) {
      throw new Error("The new project's existing Redis connection does not cover both confirmed environments.");
    }
    const target = await api(`/v10/projects/${project.id}/env`);
    const targetRows = Array.isArray(target) ? target : target.envs || [];
    if (!["production", "preview"].every(env => hasPair(targetRows.filter(row => inEnvironment(row, env))))) throw new Error("The connected Redis integration did not provide both required credential pairs.");
    console.log(`Connected the existing Redis integration ${storeId} to the confirmed new project; managed Secrets remain private.`);
  } else {
    // Legacy manually configured variables can use the effective Production-only
    // export. Do not copy branch overrides or a provider's redacted placeholder.
    const exported = await api(`/v3/env/pull/${sourceProject}/production?source=vercel-cli:env:pull`);
    for (const key of keys) {
      const value = exported.env?.[key];
      if (typeof value === "string" && value && value !== "[SENSITIVE]") copy.push({ key, value, type: "encrypted", target: ["production", "preview"] });
    }
    if (!hasPair(copy)) throw new Error("The existing Production Redis configuration is unavailable; no replacement store was created.");
  }
}
copy.push(
  { key: "MOCK_SANDBOX", value: "services-production", type: "plain", target: ["production"] },
  { key: "MOCK_SANDBOX", value: "services-preview", type: "plain", target: ["preview"] },
  { key: "SUITE_SERVICES_PUBLIC_URL", value: publicOrigin, type: "plain", target: ["production"] },
);
await api(`/v10/projects/${project.id}/env?upsert=true`, "POST", copy);
fs.mkdirSync(".vercel", { recursive: true });
fs.writeFileSync(".vercel/project.json", JSON.stringify({ orgId: team, projectId: project.id, projectName: name }));

// Vercel's CLI consumes auth.json; put it in a private temporary directory,
// rather than passing --token through OS arguments or build manifests.
const authDirectory = path.join(process.env.RUNNER_TEMP, "orgtik-services-cli", "com.vercel.cli");
fs.mkdirSync(authDirectory, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(authDirectory, "auth.json"), JSON.stringify({ token }), { mode: 0o600 });
fs.appendFileSync(process.env.GITHUB_ENV, `ORGTIK_VERCEL_CONFIG=${authDirectory}\n`);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Services project: ${name} (${project.id})\n\nProduction dataset: services-production; Preview dataset: services-preview.\n`);
console.log(`Configured ${name} in the confirmed team; existing Redis credentials remain private.`);
