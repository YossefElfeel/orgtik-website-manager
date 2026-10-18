// The strings the website builds in code rather than writing into its markup: labels in a
// page's view model (`emptyTitle: "No systems yet"`), sentences put together from pieces
// ("Showing " + shown + " of " + total), aria labels made from data. Read without running or
// changing the website.
//
// A concatenation or a template literal is one message, its moving parts numbered placeholders:
// "Showing {0} of {1}". Each message keeps where it's used (method and property, e.g.
// "renderVals · plans.emptyTitle") so an editor knows what it is. Text that is already a page's
// copy (copy.mjs) or modelled data (fields.mjs) is left out, so nothing is edited in two places.
import fs from "node:fs";
import { parse } from "@babel/parser";

// Class fields and view-model arrays the seed models elsewhere.
export const MODELLED = new Set(
  "FAM MODS INS ART SVC RM IDEAS LG SOCIALS STEPS HERO_WORDS SVCS FAQS STORIES FLOW CTX JR CAPS TOPICS PATHS PACKS BUNDLES PLAN_OPTIONS PLAN_META DURATIONS REC QUICK CONNECT UC_IMGS PAL BX SITE SVC_FAM CONTACT HOME menuLinks footExplore footStart".split(" "),
);
// Attributes that never hold reader text; the copy ones (alt, aria-label...) are skipped only
// when they're a plain literal, which copy.mjs already has.
const CODE_ATTRS = new Set(["className", "style", "href", "src", "id", "key", "type", "role", "name", "htmlFor", "rel", "target", "fit", "loading", "decoding", "autoComplete", "inputMode", "method", "action", "viewBox", "d", "fill", "stroke", "xmlns", "preload", "poster", "value", "lang", "dir", "tabIndex", "sizes", "media"]);
const COPY_ATTRS = new Set(["alt", "aria-label", "placeholder", "title"]);

/** Reader text, not code: words, and none of the shapes CSS, selectors, paths and keys have. */
export function looksLikeText(s) {
  const t = s.replace(/\{\d+\}/g, " ").trim();
  if (!/\p{L}{2}/u.test(t)) return false;
  if (/^[a-z0-9_-]+$/.test(t)) return false; // a key, a class, a slug
  if (/^[a-z0-9_-]+$/.test(s.replace(/\{\d+\}/g, "").trim())) return false; // a generated DOM id
  if (/^[a-z]{2}(?:-[A-Z]{2})?$/.test(t)) return false; // a locale code
  if (/^[a-z]+[A-Z][A-Za-z]*$/.test(t)) return false; // camelCase
  if (['IntersectionObserver', 'ResizeObserver', 'CHF'].includes(t)) return false;
  if (/^orgtik\.[a-z0-9.-]+$/i.test(t) || /^ORG-\{\d+\}$/.test(s)) return false;
  if (/\b\d+ \/ span \d+\b|(?:px|rem|vw|vh|svh|deg|ms)\b|#[0-9a-f]{3,8}\b|var\(|rgba?\(|cubic-bezier|gradient\(|translate|scale[XY]?\(|blur\(|minmax\(|repeat\(/i.test(t)) return false;
  if (/\((?:prefers|hover|pointer|min-width|max-width)|^[.#[]|\bimg\b|\[data-|image-slot|:hover|:focus/.test(t)) return false;
  if (/\.(?:webp|svg|png|jpe?g|mp4|webm|html)\b|^\/|^https?:|^#\/|^ph(?:-fill)? ph-|^ph-/.test(t)) return false;
  return true;
}

// Where a message is used, for an editor: the view-model path ("card.price"); the method only
// when it says more than "the page's view" (render, renderVals).
const humanWhere = (method, props) => {
  const path = props.slice(-2).join(".");
  return (["render", "renderVals"].includes(method) ? path : [method, path].filter(Boolean).join(" · ")) || method || "";
};

/** [{ text, where, method, props, line }] for one component file, in source order, each text once. */
export function extractStrings(file) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  const out = [];
  const seen = new Set();
  let line = 0;
  // Every place a message is written, not just the first (the site's codemod replaces them all).
  // shape: the pieces in order, strings as they are and expressions as { expr: node }.
  const occurrences = [];
  const emit = (text, where, method, props, node, shape) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!looksLikeText(t)) return;
    occurrences.push({ text: t, node, shape });
    if (seen.has(t)) return;
    seen.add(t);
    out.push({ text: t, where, method, props, line });
  };
  // "a" + x + "b" → "a{0}b", and the non-literal parts to look into.
  const flatten = (n, parts) => {
    if (n.type === "BinaryExpression" && n.operator === "+") {
      flatten(n.left, parts);
      flatten(n.right, parts);
    } else parts.push(n);
    return parts;
  };
  function walk(n, method, props, inJsxChild) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, method, props, inJsxChild));
    if (n.loc) line = n.loc.start.line;
    if (n.type === "ImportDeclaration" || n.type === "JSXText") return;
    if ((n.type === "ClassProperty" || n.type === "ClassMethod") && MODELLED.has(n.key?.name)) return;
    if (n.type === "ClassMethod" || (n.type === "ClassProperty" && n.value?.type === "ArrowFunctionExpression")) {
      return walk(n.type === "ClassMethod" ? n.body : n.value, n.key?.name ?? method, [], false);
    }
    // `const head = { l1: ... }`: the variable names the block, like a property would.
    if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") return walk(n.init, method, [...props, n.id.name], false);
    if (n.type === "ObjectProperty") {
      const k = n.key?.name ?? n.key?.value;
      if (MODELLED.has(k) || k === "style") return;
      return walk(n.value, method, [...props, k], false);
    }
    if (n.type === "JSXAttribute") {
      const a = n.name?.name;
      if (CODE_ATTRS.has(a) || a?.startsWith?.("data-") || a?.startsWith?.("on")) return;
      const v = n.value;
      if (COPY_ATTRS.has(a) && (v?.type === "StringLiteral" || (v?.type === "JSXExpressionContainer" && v.expression.type === "StringLiteral"))) return;
      return walk(v, method, [...props, a], false);
    }
    if (n.type === "JSXElement") {
      walk(n.openingElement.attributes, method, props, false);
      // A plain {"text"} child is copy (copy.mjs); expressions in children are looked into.
      for (const c of n.children) {
        if (c.type === "JSXExpressionContainer" && c.expression.type === "StringLiteral") continue;
        walk(c, method, props, true);
      }
      return;
    }
    if (n.type === "BinaryExpression" && n.operator === "+") {
      const parts = flatten(n, []);
      if (parts.some((p) => p.type === "StringLiteral" && /\p{L}/u.test(p.value))) {
        let i = 0;
        emit(parts.map((p) => (p.type === "StringLiteral" ? p.value : `{${i++}}`)).join(""), humanWhere(method, props), method, props, n, parts.map((p) => (p.type === "StringLiteral" ? p.value : { expr: p })));
        for (const p of parts) if (p.type !== "StringLiteral") walk(p, method, props, false);
        return;
      }
    }
    if (n.type === "TemplateLiteral") {
      emit(n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? `{${i}}` : "")).join(""), humanWhere(method, props), method, props, n, n.quasis.flatMap((q, i) => [q.value.cooked, ...(i < n.expressions.length ? [{ expr: n.expressions[i] }] : [])]));
      return n.expressions.forEach((e) => walk(e, method, props, false));
    }
    if (n.type === "StringLiteral") return emit(n.value, humanWhere(method, props), method, props, n, [n.value]);
    // Calls whose string arguments are code: DOM queries, media queries, class toggles, timers.
    if (n.type === "CallExpression" || n.type === "OptionalCallExpression") {
      const callee = n.callee.property?.name ?? n.callee.name;
      if (["querySelector", "querySelectorAll", "matchMedia", "add", "remove", "toggle", "contains", "getAttribute", "setAttribute", "removeAttribute", "addEventListener", "removeEventListener", "setProperty", "closest", "toSiteHref", "getElementById", "startsWith", "endsWith", "includes", "split", "replace", "join", "padStart", "animate", "scrollTo", "dispatchEvent", "require", "import"].includes(callee)) {
        return walk(n.callee, method, props, false);
      }
    }
    if (n.type === "BinaryExpression" && ["===", "!==", "==", "!=", "in"].includes(n.operator)) return; // comparisons with keys and browser capabilities
    if (n.type === "SwitchCase") return walk(n.consequent, method, props, false);
    for (const [k, v] of Object.entries(n)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments" || k === "extra") continue;
      if (v && typeof v === "object") walk(v, method, props, inJsxChild);
    }
  }
  walk(ast.program, null, [], false);
  Object.defineProperty(out, "occurrences", { value: occurrences, enumerable: false });
  return out;
}
