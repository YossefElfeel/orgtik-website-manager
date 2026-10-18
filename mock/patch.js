// Points the installed @somion/sos-bar and @iconify/react packages at local servers instead of
// sos.orgtik.xyz / sosback.orgtik.xyz / api.iconify.design, and turns off the on-disk Turbopack
// cache of the Next 16 dev servers (it grows by hundreds of MB per app as routes compile, which
// the audit sweeps can't afford on a small disk; restarts are just slower without it).
// Keeps a backup of every file it changes.
//   node patch.js            apply (safe to run repeatedly)
//   node patch.js --restore  put the original files back
// Re-run after any `npm install` / `npm ci` in an app, since that restores the originals.
const fs = require("fs");
const path = require("path");
const config = require("./config");

const ROOT = path.resolve(__dirname, "..");
const RESTORE = process.argv.includes("--restore");
const BACKUP = ".local-dev-orig";
const ICONS = `http://localhost:${config.icons.port}`;
const SOS_WEB = config.webUrl("sos");
const SOS_API = `${config.apiUrl("sos")}/api`;

const edits = [
  {
    file: "@somion/sos-bar/dist/constants/index.js",
    replace: [
      [/export const SOS_URL = [^\n]*/, `export const SOS_URL = "${SOS_WEB}"; // [local-dev patch]`],
      [/export const API_URL = [^\n]*/, `export const API_URL = "${SOS_API}"; // [local-dev patch]`],
    ],
  },
  { file: "@somion/sos-bar/dist/components/SoSBar/ScopeItem.js", replace: [[/https:\/\/api\.iconify\.design\//g, `${ICONS}/`]] },
  {
    file: "@somion/sos-bar/dist/components/SoSBar/ErrorHandler.js",
    replace: [[/https:\/\/api\.iconify\.design\//g, `${ICONS}/`]],
  },
  {
    // All local apps share the hostname "localhost"; compare host:port so only the current tile is active.
    file: "@somion/sos-bar/dist/utils/is-current-dashboard.js",
    replace: [[/urlObj\.hostname\.toLowerCase\(\)/g, "urlObj.host.toLowerCase()"]],
  },
  {
    file: "@somion/sos-bar/dist/components/SoSBar/index.js",
    replace: [
      [/https:\/\/www\.svgrepo\.com\/show\/521898\/unpin\.svg/g, `${ICONS}/mdi/pin-off.svg`],
      [/https:\/\/www\.svgrepo\.com\/show\/525473\/pin\.svg/g, `${ICONS}/mdi/pin.svg`],
    ],
  },
  // Next 16 only; Next 15 has no such default, so these report "no change" there.
  ...["next/dist/server/config-shared.js", "next/dist/esm/server/config-shared.js"].map((file) => ({
    file,
    label: `next ${file.includes("/esm/") ? "esm" : "cjs"} config`,
    replace: [[/turbopackFileSystemCacheForDev: true,/, "turbopackFileSystemCacheForDev: false, // [local-dev patch]"]],
  })),
];
const iconifyEdits = [
  [/\["https:\/\/api\.simplesvg\.com", "https:\/\/api\.unisvg\.com"\]/g, "[]"],
  [/"https:\/\/api\.iconify\.design"/g, `"${ICONS}"`],
];

// Every copy of @iconify/react: top level, nested inside another package, or in pnpm's .pnpm store.
function iconifyCopies(nm) {
  const out = [];
  const add = (p) => fs.existsSync(p) && !out.includes(fs.realpathSync(p)) && out.push(fs.realpathSync(p));
  add(path.join(nm, "@iconify", "react", "dist"));
  for (const entry of fs.existsSync(nm) ? fs.readdirSync(nm) : []) {
    if (entry === ".pnpm") continue;
    const dirs = entry.startsWith("@") ? fs.readdirSync(path.join(nm, entry)).map((s) => path.join(nm, entry, s)) : [path.join(nm, entry)];
    for (const d of dirs) add(path.join(d, "node_modules", "@iconify", "react", "dist"));
  }
  const store = path.join(nm, ".pnpm");
  for (const entry of fs.existsSync(store) ? fs.readdirSync(store) : []) {
    if (entry.startsWith("@iconify+react@")) add(path.join(store, entry, "node_modules", "@iconify", "react", "dist"));
  }
  return out;
}

function patchFile(file, replacements) {
  if (!fs.existsSync(file)) return "missing";
  const backup = file + BACKUP;
  // pnpm hard-links installed files to its shared store, so every write replaces the file
  // (unlink first) instead of writing through the link and changing the store for everyone.
  const replace = (target, data) => {
    fs.unlinkSync(target);
    fs.writeFileSync(target, data);
  };
  if (RESTORE) {
    if (!fs.existsSync(backup)) return "not patched";
    replace(file, fs.readFileSync(backup));
    fs.unlinkSync(backup);
    return "restored";
  }
  const original = fs.existsSync(backup) ? fs.readFileSync(backup, "utf8") : fs.readFileSync(file, "utf8");
  let text = original;
  for (const [re, to] of replacements) text = text.replace(re, to);
  if (text === original) return "no change";
  if (fs.readFileSync(file, "utf8") === text) return "already patched";
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
  replace(file, text);
  return "patched";
}

for (const [key, app] of Object.entries(config.apps)) {
  if (app.reserved) continue; // ports held for an app that isn't built yet
  const nm = path.join(ROOT, app.dir, "node_modules");
  // Only apps that use the shared launcher need patching (the website doesn't).
  if (fs.existsSync(nm) && !fs.existsSync(path.join(nm, "@somion", "sos-bar"))) continue;
  if (!fs.existsSync(nm)) {
    console.log(`[${key}] no node_modules yet, skipped (run npm ci in ${app.dir} first)`);
    continue;
  }
  const results = [];
  for (const e of edits) results.push(`${e.label || `${path.basename(path.dirname(e.file))}/${path.basename(e.file)}`}: ${patchFile(path.join(nm, e.file), e.replace)}`);
  for (const dist of iconifyCopies(nm)) {
    for (const f of ["iconify.js", "iconify.cjs", "iconify.mjs"]) {
      const r = patchFile(path.join(dist, f), iconifyEdits);
      if (r !== "missing") results.push(`${path.relative(nm, path.join(dist, f))}: ${r}`);
    }
  }
  // Compiled copies of the old files live in .next; clear it so the dev server picks up the change.
  const nextDir = path.join(ROOT, app.dir, ".next");
  if (results.some((r) => /: (patched|restored)$/.test(r)) && fs.existsSync(nextDir)) fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(`[${key}] ${results.join(" | ")}`);
}
