import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function inspectFunctions(output) {
  const files = fs.readdirSync(output, { recursive: true }).filter(file => file.endsWith(".vc-config.json"));
  const counts = {};
  const deferred = {};
  const seen = new Set();
  let dedicated = 0;
  for (const file of files) {
    const target = fs.realpathSync(path.join(output, file));
    if (seen.has(target)) continue;
    seen.add(target);
    const config = JSON.parse(fs.readFileSync(target, "utf8"));
    if (config.runtime === "edge") throw new Error(`Services cannot deploy Edge output: ${file}`);
    const service = file.split(path.sep)[0];
    counts[service] = (counts[service] || 0) + 1;
    // The Next.js adapter emits route artifacts for Vercel's deployment-time
    // bundler. These are not dedicated functions; the provider determines their
    // final bundle count. Function aliases also share the same config file.
    if (config.framework?.slug === "nextjs" && config.experimentalAllowBundling === true) {
      deferred[service] = (deferred[service] || 0) + 1;
    } else dedicated++;
  }
  return { counts, total: seen.size, dedicated, deferred };
}
export function assertHobbyLimit(result) {
  const dedicated = result.dedicated ?? result.total;
  if (dedicated > 12) throw new Error(`Hobby permits 12 functions per deployment; this project has ${dedicated} dedicated functions: ${JSON.stringify(result.counts)}. Upload was stopped.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inspectFunctions(path.resolve(".vercel/output/services"));
  console.log(`Function inventory: ${JSON.stringify(result)}`);
  assertHobbyLimit(result);
  if (Object.keys(result.deferred).length) console.log("Next.js route bundling is deferred to Vercel; deployment must pass its final Hobby function-limit check before promotion.");
}
