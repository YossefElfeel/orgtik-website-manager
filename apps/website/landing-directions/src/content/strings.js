// The messages the pages build in code, from the Website Manager's Strings (D-035).
// msg("Services:14", [shown, total]) builds "Showing 3 of 11" the way the page always did while the
// message is unchanged; an edited message fills its {0}, {1}… with the same parts, keeping the
// spacing the page had around it.
import snapshot from "./snapshot.js";
import templates from "./strings-templates.js";
import { wordsOf } from "./locale.js";

const entries = new Map((snapshot.entries.strings ?? []).map((e) => [e.id, e]));

function published(key) {
  const [id, block, slot] = key.split("|");
  // The page's language, else English (S5).
  const v = wordsOf(entries.get(id)?.locales)?.[block]?.[slot];
  return typeof v === "string" ? v : null;
}

export function msg(id, args = []) {
  const t = templates[id];
  if (!t) return "";
  const now = published(t.k);
  if (now === null || now === t.seed)
    return t.shape
      .map((p) => (typeof p === "number" ? String(args[p]) : p))
      .join("");
  return (
    t.lead +
    now.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? "")) +
    t.trail
  );
}
