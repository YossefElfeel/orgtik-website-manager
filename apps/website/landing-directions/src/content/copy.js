// The pages' copy, from the Website Manager (D-035). A page asks for one text run of one slot
// (`run("pg_home|closing|h2", 2)`) or one attribute (`attr("gl_header|header|img@alt")`).
//
// copy-templates.js holds, per slot, the English it was published with and every run's exact
// original text. While a slot's part is unchanged, the run renders that original, so the page is
// the same to the pixel; once edited, it renders the new words with the original spacing around
// them. A slot's marks (the <m1>…</m1> the site styles) can't change in the Website Manager, so
// the page keeps its elements; if they ever don't line up, the page keeps its original text.
import snapshot from "./snapshot.js";
import templates from "./copy-templates.js";
import { wordsOf } from "./locale.js";

const TAG = /<\/?[a-z][a-z0-9]*\/?>/;
const entries = new Map(
  [...(snapshot.entries.page ?? []), ...(snapshot.entries.global ?? [])].map(
    (e) => [e.id, e],
  ),
);

/** The slot's published text, in the site's language (English until more go public, S5). */
function published(key) {
  const [id, region, slot] = key.split("|");
  // The page's language, else English (S5).
  const v = wordsOf(entries.get(id)?.locales)?.[region]?.[slot];
  return typeof v === "string" ? v : null;
}

export function run(key, i, values = []) {
  return textRun(key, i).replace(/\{(\d+)\}/g, (token, index) =>
    values[index] === undefined ? token : String(values[index]),
  );
}

function textRun(key, i) {
  const t = templates[key];
  const r = t?.runs?.[i];
  if (!r) return "";
  if (r.s === null) return r.o;
  const now = published(key);
  if (now === null || now === t.seed) return r.o;
  const parts = now.split(TAG);
  const seed = t.seed.split(TAG);
  if (parts.length !== seed.length || parts[r.s] === seed[r.s]) return r.o;
  if (!r.f) return "";
  const lead = r.o.match(/^\s*/)[0];
  const trail = r.o.match(/\s*$/)[0];
  return lead + parts[r.s].trim() + trail;
}

export function attr(key) {
  const t = templates[key];
  const now = published(key);
  return now === null || now === t?.seed ? t?.o : now;
}
