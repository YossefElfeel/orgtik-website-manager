// Convert the supplied standalone export to editable React source and local assets.
// Usage: node tools/import-reference.mjs "C:/path/OrgTik Website3.html"
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parse as parseJS } from "@babel/parser";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(process.argv[2], "utf8");
const island = (name) =>
  JSON.parse(
    html.match(
      new RegExp(
        `<script[^>]*type="__bundler/${name}"[^>]*>([\\s\\S]*?)<\\/script>`,
      ),
    )[1],
  );
const manifest = island("manifest");
const resources = island("ext_resources");
const bytes = (id) => {
  const entry = manifest[id];
  const data = Buffer.from(entry.data, "base64");
  return entry.compressed ? zlib.gunzipSync(data) : data;
};
const write = (name, contents) => {
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) throw Error("Invalid output path");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
};
const decode = (s) =>
  s.replace(
    /&(#x[\da-f]+|#\d+|quot|amp|lt|gt|apos|nbsp);/gi,
    (_, e) =>
      ({ quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: "\u00a0" })[
        e
      ] ??
      String.fromCodePoint(
        e[1]?.toLowerCase() === "x"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10),
      ),
  );
const voids = new Set(
  "area base br col embed hr img input link meta param source track wbr".split(
    " ",
  ),
);
function parse(source) {
  const rootNode = { tag: "fragment", attrs: {}, children: [] };
  const stack = [rootNode];
  for (const match of source.matchAll(
    /<!--[\s\S]*?-->|<\/?[\w-]+\b(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g,
  )) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      const tag = token.match(/^<\/([\w-]+)/)[1].toLowerCase();
      const index = stack.findLastIndex((n) => n.tag === tag);
      if (index > 0) stack.length = index;
    } else if (token.startsWith("<")) {
      const tag = token.match(/^<([\w-]+)/)[1].toLowerCase();
      const attrs = {};
      for (const a of token
        .slice(tag.length + 1, -1)
        .matchAll(
          /([^\s=<>"'\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
        ))
        attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
      const node = { tag, attrs, children: [] };
      stack.at(-1).children.push(node);
      if (!voids.has(tag) && !token.endsWith("/>")) stack.push(node);
    } else stack.at(-1).children.push(decode(token));
  }
  return rootNode;
}
let rules = [],
  sequence = 0;
const expression = (s, scope) => {
  const e = s.replace(/^\s*{{\s*|\s*}}\s*$/g, "").trim();
  return /^(true|false|null|\d+)$/.test(e) || scope.includes(e.split(".")[0])
    ? e
    : `v.${e}`;
};
function value(s, scope) {
  if (/^{{[^}]+}}$/.test(s)) return expression(s, scope);
  const pieces = s.split(/({{.*?}})/g).filter(Boolean);
  return (
    pieces
      .map((p) =>
        p.startsWith("{{") ? `(${expression(p, scope)})` : JSON.stringify(p),
      )
      .join(" + ") || '""'
  );
}
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function style(s, scope) {
  const entries = s
    .split(/;(?![^()]*\))/)
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(":");
      if (i < 0) return null;
      let key = p.slice(0, i).trim(),
        val = p.slice(i + 1).trim();
      key = key.startsWith("--") ? key : camel(key);
      if (key.startsWith("Webkit")) key = key;
      // Dynamic numeric style values need their original CSS units, not React's implicit px.
      const out = /^{{[^}]+}}$/.test(val)
        ? `String(${expression(val, scope)})`
        : value(val, scope);
      return `${JSON.stringify(key)}:${out}`;
    })
    .filter(Boolean);
  return `{${entries.join(",")}}`;
}
const aliases = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  autoplay: "autoPlay",
  playsinline: "playsInline",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  novalidate: "noValidate",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  colspan: "colSpan",
  rowspan: "rowSpan",
};
const eventNames = Object.fromEntries(
  "Click Submit Change Input KeyDown KeyUp Focus Blur MouseEnter MouseLeave MouseMove PointerEnter PointerLeave PointerMove PointerDown PointerUp TouchStart TouchEnd Scroll DragEnter DragOver DragLeave Drop"
    .split(" ")
    .map((x) => ["on" + x.toLowerCase(), "on" + x]),
);
const bools = new Set(
  "muted loop autoPlay playsInline required disabled checked selected multiple readOnly noValidate autoFocus controls".split(
    " ",
  ),
);
function render(node, scope = []) {
  if (typeof node === "string")
    return node.trim() ? `{${value(node, scope)}}` : "\n";
  const { tag, attrs: a, children } = node;
  if (tag === "fragment") return children.map((n) => render(n, scope)).join("");
  if (tag === "sc-if")
    return `{(${expression(a.value, scope)}) && <>${children.map((n) => render(n, scope)).join("")}</>}`;
  if (tag === "sc-for") {
    const name = a.as,
      key = `${name}Index`;
    return `{(${expression(a.list, scope)} || []).map((${name}, ${key}) => <React.Fragment key={${key}}>${children.map((n) => render(n, [...scope, name])).join("")}</React.Fragment>)}`;
  }
  let attrs = [],
    className = a.class || "";
  for (const [key, val] of Object.entries(a)) {
    if (key.startsWith("hint-") || key === "class" || key === '"') continue;
    if (key.startsWith("style-")) {
      const cls = `reference-state-${++sequence}`;
      className += " " + cls;
      const pseudo = key.slice(6),
        selector =
          pseudo === "before" || pseudo === "after"
            ? `::${pseudo}`
            : `:${pseudo}`;
      rules.push(
        `.${cls}${selector}{${val
          .replace(/[\w-]+:\s*{{[^}]+}};?/g, "")
          .replace(/;?$/, ";")
          .replace(/;/g, " !important;")}}`,
      );
      if (pseudo === "hover")
        rules.push(
          `.${cls}:focus-visible{${val.replace(/;?$/, ";").replace(/;/g, " !important;")}}`,
        );
      continue;
    }
    const name = aliases[key] || eventNames[key] || key;
    if (name === "style") attrs.push(`style={${style(val, scope)}}`);
    else if (name === "href")
      attrs.push(`href={toSiteHref(${value(val, scope)})}`);
    else if (bools.has(name))
      attrs.push(`${name}={${val ? value(val, scope) : "true"}}`);
    else if (/^[\w:-]+$/.test(name))
      attrs.push(`${name}={${value(val, scope)}}`);
  }
  if (className) attrs.push(`className={${value(className.trim(), scope)}}`);
  return `<${tag} ${attrs.join(" ")}${voids.has(tag) ? " />" : `>${children.map((n) => render(n, scope)).join("")}</${tag}>`}`;
}

for (const r of resources.filter((r) => r.id.startsWith("assets/")))
  write("public/" + r.id, bytes(r.uuid));
// Retain only local WOFF2 icon fonts and the source icon mappings.
for (const weight of ["regular", "fill", "light"]) {
  const r = resources.find((r) => r.id.includes(`/src/${weight}/style.css`));
  let css = bytes(r.uuid).toString();
  const font = css.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/);
  write(
    `public/assets/fonts/phosphor-${weight}.woff2`,
    Buffer.from(font[1], "base64"),
  );
  css = css.replace(
    /@font-face\s*{[\s\S]*?}/,
    `@font-face{font-family:"Phosphor${weight === "regular" ? "" : "-" + weight[0].toUpperCase() + weight.slice(1)}";src:url('/assets/fonts/phosphor-${weight}.woff2') format('woff2');font-display:block}`,
  );
  write(`src/reference/icons-${weight}.css`, css);
}
const seen = new Set();
for (const resource of resources.filter((r) => r.id.endsWith(".dc.html"))) {
  if (seen.has(resource.uuid)) continue;
  seen.add(resource.uuid);
  const name = decodeURIComponent(resource.id)
    .replace("./", "")
    .replace(".dc.html", "")
    .replace("OrgTik ", "");
  let source = bytes(resource.uuid).toString();
  let script = source.match(
    /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/,
  )[1];
  const template = source
    .match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1]
    .replace(/<helmet>[\s\S]*?<\/helmet>/g, "")
    .replace(/(\w+="[^"]*")"(?=>)/g, "$1");
  // The export contains duplicate class helpers; keep the final definition.
  const ast = parseJS(script, { sourceType: "script" });
  const klass = ast.program.body.find((n) => n.type === "ClassDeclaration");
  const methods = new Set(),
    removals = [];
  for (const method of [...klass.body.body].reverse()) {
    if (methods.has(method.key.name)) removals.push([method.start, method.end]);
    methods.add(method.key.name);
  }
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0]))
    script = script.slice(0, start) + script.slice(end);
  script = script.replace(/bundle: g\[3\], /g, "");
  const jsx = render(parse(template));
  let code = script.replace(
    "class Component extends DCLogic",
    `export default class ${name} extends React.Component`,
  );
  code =
    code.slice(0, code.lastIndexOf("}")) +
    `\nrender() { const v=this.renderVals(); return <>${jsx}</>; }\n}\n`;
  // All referenced assets resolve on nested routes, too.
  code = code.replace(/(['"`])assets\//g, "$1/assets/");
  write(
    `src/reference/${name}.jsx`,
    `import React from 'react';\nimport { toSiteHref } from './navigation';\n${code}`,
  );
  console.log(`Imported ${name}`);
}
write(
  "src/reference/states.css",
  rules
    .join("\n")
    .replace(/[\w-]+:\s*{{[^}]+}}\s*!important;/g, "")
    .replace(/\{\s*!important;\}/g, "{}"),
);
console.log("Imported reference assets and hover/focus styles.");
