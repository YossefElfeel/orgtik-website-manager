// Restore the existing byte-preserving mock runtime in the Services artifact.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const output = path.resolve(".vercel/output/services/mock");
const functions = path.join(output, "functions");
if (!fs.existsSync(functions)) throw new Error("Mock Services function artifact is missing.");
const files = fs.readdirSync(functions, { recursive: true }).filter(file => file.endsWith(".vc-config.json"));
const candidates = files.map(file => ({ folder: path.dirname(path.join(functions, file)), config: JSON.parse(fs.readFileSync(path.join(functions, file), "utf8")) }));
if (candidates.length !== 1) throw new Error("Expected one mock Express function artifact.");
const { folder, config } = candidates[0];
const runtime = fs.realpathSync(".vercel/mock-runtime");
const entry = path.resolve(folder, config.handler);
const relative = path.relative(folder, entry);
if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Mock handler leaves its artifact.");
// Express builders can flatten the handler or retain its repository path. Keep
// the declared handler and transplant the reviewed runtime beneath that root.
const handlerPath = config.handler.replaceAll("\\", "/");
const mockPrefix = handlerPath.startsWith("mock/") ? "mock" : path.dirname(handlerPath);
const mockRoot = path.resolve(folder, mockPrefix);
if (path.relative(folder, mockRoot).startsWith("..")) throw new Error("Mock runtime root leaves the function.");
fs.mkdirSync(mockRoot, { recursive: true });
fs.cpSync(runtime, mockRoot, { recursive: true, dereference: false, verbatimSymlinks: true });
// The config imports the shared public-origin helper relative to mock/config.js.
const shared = path.resolve(mockRoot, "../tools/services");
if (path.relative(folder, shared).startsWith("..")) {
  // A flattened handler needs its helper within the function rather than ../.
  const configFile = path.join(mockRoot, "config.js");
  const source = fs.readFileSync(configFile, "utf8").replace('require("../tools/services/config.cjs")', 'require("./services-config.cjs")');
  fs.writeFileSync(configFile, source);
  fs.copyFileSync("tools/services/config.cjs", path.join(mockRoot, "services-config.cjs"));
} else {
  fs.mkdirSync(shared, { recursive: true });
  fs.copyFileSync("tools/services/config.cjs", path.join(shared, "config.cjs"));
}
if (!fs.existsSync(entry)) throw new Error("Packaged Express handler is missing.");
const load = createRequire(path.join(mockRoot, "index.js"));
for (const dependency of ["express", "cors", "multer", "socket.io", "@iconify/utils"]) {
  const resolved = fs.realpathSync(load.resolve(dependency));
  if (path.relative(folder, resolved).startsWith("..")) throw new Error(`Packaged ${dependency} resolves outside the function.`);
  load(dependency);
}
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for (const tree of ["apps", "lib"]) {
  for (const file of fs.readdirSync(path.join("mock", tree), { recursive: true }).filter(file => fs.statSync(path.join("mock", tree, file)).isFile())) {
    const source = path.join("mock", tree, file), packaged = path.join(mockRoot, tree, file);
    if (!fs.existsSync(packaged) || digest(source) !== digest(packaged)) throw new Error(`Mock source/asset differs in Services artifact: ${tree}/${file}`);
  }
}
console.log("Services mock: isolated dependencies and original runtime/asset bytes verified.");
