// Checks an app's message catalogs: every language has the same keys as English, and every
// message uses the same {placeholders} as its English source. Works with every layout in the
// suite: messages/<locale>.json, messages/<locale>/<area>.json, messages/<group>/<locale>/<area>.json.
//   node tools/i18n/check-catalogs.mjs [appDir]      (default: the current directory)
// Exits 1 on any missing or extra key or placeholder mismatch.
import fs from "node:fs";
import path from "node:path";

export const LOCALES = ["en", "ar", "de", "fr", "it"];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".json") ? [p] : [];
  });
}

const flatten = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

// The ICU argument names a message uses, at any depth: {name}, {count, plural, ...}, {x, select, ...}
// and arguments inside plural/select branches. Branches themselves may differ between languages
// (Arabic has more plural forms; a translation may move an argument into each branch), so only the
// set of names is compared. A small ICU parser tells arguments from branch bodies ("{Files}").
function placeholders(text) {
  if (typeof text !== "string") return [];
  const names = new Set();
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  // A message body, up to the "}" that closes it (or the end at depth 0).
  function message(depth) {
    while (i < text.length) {
      const c = text[i];
      if (c === "'" && (text[i + 1] === "{" || text[i + 1] === "}" || text[i + 1] === "'")) {
        const end = text.indexOf("'", i + 1);
        i = end === -1 ? text.length : end + 1;
      } else if (c === "{") {
        i++;
        argument();
      } else if (c === "}") {
        if (depth > 0) return;
        i++;
      } else i++;
    }
  }
  function argument() {
    ws();
    const name = /^[^\s,{}]+/.exec(text.slice(i))?.[0] ?? "";
    i += name.length;
    if (name) names.add(name);
    ws();
    if (text[i] === "}") { i++; return; }
    if (text[i] !== ",") { skipTo(); return; }
    i++;
    ws();
    const type = /^\w+/.exec(text.slice(i))?.[0] ?? "";
    i += type.length;
    ws();
    if (!["plural", "select", "selectordinal"].includes(type)) { skipTo(); return; }
    if (text[i] === ",") i++;
    for (;;) {
      ws();
      if (i >= text.length) return;
      if (text[i] === "}") { i++; return; }
      const selector = /^[^\s{}]+/.exec(text.slice(i))?.[0] ?? "";
      i += selector.length;
      ws();
      if (text[i] !== "{") { skipTo(); return; }
      i++;
      message(1);
      i++; // the branch's closing "}"
    }
  }
  function skipTo() {
    let depth = 1;
    while (i < text.length && depth) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
  }
  message(0);
  names.delete("offset:0");
  return [...names].sort();
}

export function checkApp(appDir) {
  const root = path.join(appDir, "messages");
  if (!fs.existsSync(root)) return { groups: 0, problems: [] };
  const groups = new Map(); // "group pattern" -> {locale: file}
  for (const file of walk(root)) {
    const rel = path.relative(root, file).split(path.sep);
    const idx = rel.findIndex((seg) => LOCALES.includes(seg) || LOCALES.includes(seg.replace(/\.json$/, "")));
    if (idx === -1) continue;
    const locale = rel[idx].replace(/\.json$/, "");
    const pattern = rel.map((seg, i) => (i === idx ? seg.replace(locale, "{L}") : seg)).join("/");
    if (!groups.has(pattern)) groups.set(pattern, {});
    groups.get(pattern)[locale] = file;
  }
  const problems = [];
  for (const [pattern, files] of groups) {
    if (!files.en) continue;
    const en = flatten(JSON.parse(fs.readFileSync(files.en, "utf8")));
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      if (!files[locale]) { problems.push(`${pattern}: no ${locale} catalog`); continue; }
      const other = flatten(JSON.parse(fs.readFileSync(files[locale], "utf8")));
      const missing = Object.keys(en).filter((k) => !(k in other));
      const extra = Object.keys(other).filter((k) => !(k in en));
      if (missing.length) problems.push(`${pattern} [${locale}]: ${missing.length} missing (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""})`);
      if (extra.length) problems.push(`${pattern} [${locale}]: ${extra.length} extra (${extra.slice(0, 5).join(", ")}${extra.length > 5 ? ", ..." : ""})`);
      const mismatched = Object.keys(en).filter((k) => k in other && placeholders(en[k]).join() !== placeholders(other[k]).join());
      if (mismatched.length) problems.push(`${pattern} [${locale}]: ${mismatched.length} placeholder mismatch (${mismatched.slice(0, 5).join(", ")}${mismatched.length > 5 ? ", ..." : ""})`);
    }
  }
  return { groups: groups.size, problems };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("check-catalogs.mjs")) {
  const appDir = path.resolve(process.argv[2] || process.cwd());
  const { groups, problems } = checkApp(appDir);
  if (!groups) {
    console.log(`${path.basename(appDir)}: no message catalogs`);
  } else if (problems.length) {
    console.error(`${path.basename(appDir)}: ${problems.length} catalog problem(s) in ${groups} catalog group(s)`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  } else {
    console.log(`${path.basename(appDir)}: ${groups} catalog group(s), 5 languages, keys and placeholders match`);
  }
}
