import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { apps } from "./config.cjs";

export const baseProject = "orgtik-suite-services";
export const frontendProjects = [...apps];
export const projectKeys = [...frontendProjects, "website"];
export const publicOrigin = `https://${baseProject}.vercel.app`;
export function projectName(key) {
  if (!projectKeys.includes(key)) throw new Error(`Unknown deployment project: ${key}`);
  return key === "website" ? baseProject : `${baseProject}-${key}`;
}
export function configFilename(key) {
  projectName(key);
  return key === "website" ? "vercel.json" : `vercel.${key}.json`;
}
const root = fileURLToPath(new URL("../../", import.meta.url));
export function configurationFor(key) {
  projectName(key);
  const development = JSON.parse(fs.readFileSync(path.join(root, "vercel.dev.json"), "utf8"));
  return {
    $schema: development.$schema,
    regions: development.regions,
    services: key === "website"
      ? { website: development.services.website }
      : { [key]: development.services[key], mock: development.services.mock },
    rewrites: key === "website"
      ? [...frontendProjects.map(app => ({ source: `/${app}/:path*`, destination: `https://${projectName(app)}.vercel.app/${app}/:path*` })), { source: "/(.*)", destination: { service: "website" } }]
      : [{ source: `/${key}/:path*`, destination: { service: key } }],
  };
}
export function generatedConfigurations() {
  return projectKeys.map(key => ({ key, filename: configFilename(key), config: configurationFor(key) }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  for (const { filename, config } of generatedConfigurations()) {
    const content = JSON.stringify(config, null, 2) + "\n", target = path.join(root, filename);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== content) throw new Error(`Stale split project config: ${filename}`);
    } else fs.writeFileSync(target, content);
  }
  console.log(check ? "Split project configs are current." : "Generated the website gateway and nine isolated frontend project configs.");
}
