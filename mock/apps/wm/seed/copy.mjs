// Reads the copy the website writes straight into its page components (JSX text, and the
// alt / aria-label / placeholder / title attributes), without running or changing the website.
//
// Each string becomes a slot in a region of the page: the header, the footer, or a <section>
// (keyed by its id, "closing" for the closing call to action, "hero" for the first one without
// an id). A heading or paragraph whose text carries inline marks (<em>, <strong>, a styled
// <span>, <br>) stays one slot with the marks kept as tags ("Build <em>better</em> systems";
// a mark with attributes is <m1>, <m2>...), so an editor changes words, never the styling.
// Text built from data (class fields, props) isn't a literal and isn't here: fields.mjs has it.
import fs from "node:fs";
import { parse } from "@babel/parser";

const INLINE = new Set(["em", "strong", "b", "i", "span", "br", "sup", "sub", "small", "mark", "u"]);
const ATTRS = { alt: "imageAlt", "aria-label": "ariaLabel", placeholder: "placeholder", title: "tooltip" };
const HAS_LETTER = /\p{L}/u;

const nameOf = (el) => (el.openingElement.name.type === "JSXIdentifier" ? el.openingElement.name.name : null);
const attr = (el, name) => el.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
/** A literal attribute value: "x", {"x"} or {toSiteHref("x")} (a link). */
function literal(a) {
  if (!a?.value) return null;
  const v = a.value;
  if (v.type === "StringLiteral") return v.value;
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression;
    if (e.type === "StringLiteral") return e.value;
    if (e.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0].value.cooked;
    if (e.type === "CallExpression" && e.callee.name === "toSiteHref" && e.arguments[0]?.type === "StringLiteral") return e.arguments[0].value;
  }
  return null;
}
const squash = (s) => s.replace(/\s+/g, " ");

// Serialises an element's children as one string with marks, or null if a child isn't text or
// an inline mark (then each child is visited on its own).
function inlineText(children, marks) {
  let out = "";
  for (const c of children) {
    if (c.type === "JSXText") out += squash(c.value);
    else if (c.type === "JSXExpressionContainer") {
      const e = c.expression;
      if (e.type === "JSXEmptyExpression") continue;
      if (e.type === "StringLiteral") out += e.value;
      else return null;
    } else if (c.type === "JSXElement") {
      const n = nameOf(c);
      if (!n || !INLINE.has(n)) return null;
      if (n === "br") {
        out += "<br/>";
        continue;
      }
      const inner = inlineText(c.children, marks);
      if (inner === null) return null;
      const plain = c.openingElement.attributes.length === 0 && n !== "span";
      const tag = plain ? n : `m${++marks.n}`;
      out += `<${tag}>${inner}</${tag}>`;
    } else return null;
  }
  return out;
}

// Makes a slot's text readable for an editor without losing what the site needs: marks with no
// letters in them (icons, arrows drawn in CSS) go, since they carry no words; a mark that only
// wraps another mark folds into it; a mark around the whole text is dropped; the marks left are
// renumbered m1, m2... The untouched serialisation stays in the layout as `source`.
export function tidy(text) {
  // Parse into a tree: strings, { tag, kids } for marks and plain tags, and "<br/>".
  const root = { tag: null, kids: [] };
  const stack = [root];
  for (const part of text.split(/(<\/?[a-z][a-z0-9]*\/?>)/)) {
    if (!part) continue;
    const top = stack[stack.length - 1];
    if (part === "<br/>") top.kids.push(part);
    else if (part.startsWith("</")) stack.pop();
    else if (/^<[a-z]/.test(part)) {
      const el = { tag: part.slice(1, -1), kids: [] };
      top.kids.push(el);
      stack.push(el);
    } else top.kids.push(part);
  }
  const words = (n) => (typeof n === "string" ? (n === "<br/>" ? "" : n) : n.kids.map(words).join(""));
  const isMark = (n) => typeof n === "object" && /^m\d+$/.test(n.tag);
  const clean = (kids) =>
    kids
      .map((k) => (typeof k === "object" ? { ...k, kids: clean(k.kids) } : k))
      // A mark with nothing written in it (an icon, a drawn arrow) goes.
      .filter((k) => !(isMark(k) && words(k).trim() === ""))
      // A mark whose whole content is one other element folds into it.
      .map((k) => {
        if (!isMark(k)) return k;
        const inner = k.kids.filter((c) => !(typeof c === "string" && c.trim() === ""));
        return inner.length === 1 && typeof inner[0] === "object" ? inner[0] : k;
      })
      // Neighbouring text runs (left when a mark between them went) join up.
      .reduce((acc, k) => (typeof k === "string" && k !== "<br/>" && typeof acc[acc.length - 1] === "string" && acc[acc.length - 1] !== "<br/>" ? [...acc.slice(0, -1), acc[acc.length - 1] + k] : [...acc, k]), []);
  let kids = clean(root.kids);
  const solid = kids.filter((c) => !(typeof c === "string" && c.trim() === ""));
  if (solid.length === 1 && isMark(solid[0])) kids = solid[0].kids;
  const names = new Map();
  const out = (list, inMark) =>
    list
      .map((k, i) => {
        if (typeof k === "string") {
          let t = k.replace(/\s+/g, " ");
          if (inMark && i === 0) t = t.trimStart();
          if (inMark && i === list.length - 1) t = t.trimEnd();
          return t;
        }
        let tag = k.tag;
        if (isMark(k)) {
          if (!names.has(tag)) names.set(tag, `m${names.size + 1}`);
          tag = names.get(tag);
        }
        return `<${tag}>${out(k.kids, true)}</${tag}>`;
      })
      .join("");
  return out(kids, false).replace(/\s+/g, " ").trim();
}

/** The tags in a slot's text, in order: the marks an editor must keep. */
export const marksOf = (text) => (String(text).match(/<\/?[a-z][a-z0-9]*\/?>/g) ?? []).join("");

/**
 * A literal array the page's view model holds, e.g. footExplore: [["Software", "Software.dc.html"], ...]
 * (with or without the `.map` after it), as plain data.
 */
export function viewArray(file, name) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
  let found = null;
  (function walk(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === "ObjectProperty" && (n.key.name === name || n.key.value === name)) {
      let v = n.value;
      if (v.type === "CallExpression" && v.callee.type === "MemberExpression" && v.callee.property.name === "map") v = v.callee.object;
      if (v.type === "ArrayExpression") return (found = new Function(`"use strict"; return (${src.slice(v.start, v.end)});`)());
    }
    for (const [k, v] of Object.entries(n)) if (k !== "loc" && v && typeof v === "object") walk(v);
  })(ast.program);
  if (!found) throw new Error(`${name} not found in ${file}`);
  return found;
}

const KIND = { h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading", p: "paragraph", a: "link", button: "button", li: "listItem", label: "formLabel", figcaption: "caption", blockquote: "quote", option: "option", legend: "formLabel", dt: "term", dd: "definition" };

/**
 * { regions: [{ key, kind: "header"|"footer"|"section", slots: [{ key, kind, tag, text, href? }] }] }
 * for one page component file.
 */
export function extractCopy(file) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  const regions = new Map();
  let hero = false;
  let siteHeader = false;
  let anon = 0;
  const regionFor = (el) => {
    const n = nameOf(el);
    // The first <header> is the site header; a later one (Legal, Contact) opens the page itself.
    if (n === "header" && !siteHeader) return (siteHeader = true), { key: "header", kind: "header" };
    if (n === "footer") return { key: n, kind: n };
    const id = literal(attr(el, "id"));
    const cls = literal(attr(el, "className")) ?? "";
    if (cls.includes("closing-cta")) return { key: "closing", kind: "section" };
    if (id) return { key: id, kind: "section" };
    if (!hero) return (hero = true), { key: "hero", kind: "section" };
    return { key: `section-${++anon}`, kind: "section" };
  };
  // Each slot keeps the AST node it came from and its form (not enumerable: the seed's JSON never
  // sees them), so the site's codemod can put the lookup exactly where the text was.
  const slot = (region, s, node, form) => {
    if (!regions.has(region.key)) regions.set(region.key, { ...region, slots: [], counts: {} });
    const r = regions.get(region.key);
    const n = (r.counts[s.tag] = (r.counts[s.tag] ?? 0) + 1);
    const text = tidy(s.text);
    const out = { key: n === 1 ? s.tag : `${s.tag}-${n}`, ...s, text, ...(text !== s.text ? { source: s.text } : {}) };
    Object.defineProperty(out, "node", { value: node, enumerable: false });
    Object.defineProperty(out, "form", { value: form, enumerable: false });
    r.slots.push(out);
  };

  // Depth-first over the JSX, carrying the current region and the nearest block element.
  function visit(node, region, block) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, region, block));
    if (node.type === "JSXElement") {
      const n = nameOf(node);
      // New functional headers, account controls and compact page introductions can live
      // outside a section. Give their copy a stable region as well.
      let r = region ?? { key: "intro", kind: "section" };
      if (n === "header" || n === "footer" || n === "section") r = regionFor(node);
      if (r) {
        for (const [a, kind] of Object.entries(ATTRS)) {
          const v = literal(attr(node, a));
          if (v && HAS_LETTER.test(v)) slot(r, { kind, tag: `${n}@${a}`, text: v }, attr(node, a), "attribute");
        }
      }
      const b = n && !INLINE.has(n) ? node : block;
      // A block whose content is only text and marks is one slot.
      if (r && n && !INLINE.has(n)) {
        const marks = { n: 0 };
        const text = inlineText(node.children, marks);
        if (text !== null && HAS_LETTER.test(text.replace(/<[^>]+>/g, ""))) {
          const href = n === "a" ? literal(attr(node, "href")) : null;
          slot(r, { kind: KIND[n] ?? "text", tag: n, level: /^h\d$/.test(n) ? Number(n[1]) : undefined, text: text.trim(), ...(href ? { href } : {}) }, node, "block");
          return;
        }
      }
      visit(node.openingElement.attributes, r, b);
      return visit(node.children, r, b);
    }
    if (node.type === "JSXText" && region && HAS_LETTER.test(node.value)) {
      const tag = block ? nameOf(block) ?? "text" : "text";
      slot(region, { kind: KIND[tag] ?? "text", tag, text: squash(node.value).trim() }, node, "text");
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "loc" || k === "start" || k === "end" || k === "extra" || k === "leadingComments" || k === "trailingComments") continue;
      if (v && typeof v === "object") visit(v, region, block);
    }
  }
  visit(ast.program, null, null);
  return { regions: [...regions.values()].map(({ counts, ...r }) => r), source: fs.readFileSync(file, "utf8") };
}
