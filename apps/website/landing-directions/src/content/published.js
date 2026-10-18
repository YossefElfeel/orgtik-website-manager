import snapshot from "./snapshot.js";

export const CONTENT_TYPES = Object.keys(snapshot.entries);
const API = import.meta.env?.VITE_CMS_API;
const copy = value => JSON.parse(JSON.stringify(value));
const dataOf = value => ({ entries: value.entries, ideas: value.ideas, site: value.site, redirects: value.redirects, robots: value.robots });
const fixed = Object.fromEntries(["page", "global", "strings", "pricing", "serviceFamily", "service", "softwareModule"].map(type => [type, copy(snapshot.entries[type])]));
const routed = new Set(["page", "serviceFamily", "service", "softwareModule", "caseStudy", "article", "legalDocument"]);

function renderShape(value, sample) {
  if (sample === null) return true;
  if (Array.isArray(sample)) return Array.isArray(value) && (!sample.length || value.every(row => renderShape(row, sample[0])));
  if (typeof sample === "object") return value && typeof value === "object" && !Array.isArray(value) && Object.entries(sample).every(([key, child]) => key in value && renderShape(value[key], child));
  return typeof value === typeof sample;
}

export function validPublished(value) {
  if (!value || !value.entries || !Array.isArray(value.ideas) || !Array.isArray(value.redirects) || typeof value.robots !== "string" || !value.site || !Array.isArray(value.site.publicLocales)) return false;
  if (!value.site.publicLocales.every(locale => typeof locale === "string")) return false;
  if (!["siteName", "titleTemplate", "defaultDescription", "canonicalHost"].every(key => value.site[key] == null || typeof value.site[key] === "string")) return false;
  return CONTENT_TYPES.every(type => {
    const rows = value.entries[type];
    if (!Array.isArray(rows) || new Set(rows.map(row => row?.id)).size !== rows.length || !rows.every(row => typeof row?.id === "string" && row.id && row.locales?.en && typeof row.locales.en === "object" && !Array.isArray(row.locales.en) && (!routed.has(type) || typeof row.slug?.en === "string"))) return false;
    return (fixed[type] || []).every(template => { const row = rows.find(item => item.id === template.id); return row && renderShape(row.locales.en, template.locales.en); });
  });
}

// Preserve the objects referenced by copy/strings/head readers. Only public
// content enters this model; draft preview uses its separate existing loader.
export function applyPublished(value) {
  if (!validPublished(value)) throw new Error("Invalid published website content");
  const next = copy(value);
  for (const type of CONTENT_TYPES) {
    const list = snapshot.entries[type], byId = new Map(list.map(row => [row.id, row]));
    const rows = next.entries[type].map(row => {
      const existing = byId.get(row.id); if (!existing) return row;
      for (const key of Object.keys(existing)) delete existing[key];
      return Object.assign(existing, row);
    });
    list.splice(0, list.length, ...rows);
  }
  for (const key of ["ideas", "redirects"]) snapshot[key].splice(0, snapshot[key].length, ...next[key]);
  for (const key of Object.keys(snapshot.site)) delete snapshot.site[key];
  Object.assign(snapshot.site, next.site); snapshot.robots = next.robots;
}

/** Refresh before creating page instances; reopening the website reads a new publication. */
export async function loadPublishedContent({ api = API, fetcher = globalThis.fetch, storage, timeoutMs = 1500 } = {}) {
  if (!api) return { source: "packaged" };
  const origin = api.replace(/\/$/, ""), key = "orgtik:published-content:" + origin;
  let cache; try { cache = storage ?? globalThis.localStorage; } catch {}
  let fallback = "packaged";
  try {
    const saved = JSON.parse(cache?.getItem(key) || "null");
    if (validPublished(saved)) { applyPublished(saved); fallback = "cached"; }
  } catch { /* The packaged copy remains available. */ }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const get = async (path, text = false) => {
      const response = await fetcher(origin + "/public/" + path, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Published content unavailable");
      return text ? response.text() : (await response.json()).data;
    };
    const [rows, ideas, site, redirects, robots] = await Promise.all([
      Promise.all(CONTENT_TYPES.map(async type => [type, await get("entries/" + type)])),
      get("ideas"), get("site"), get("redirects"), get("robots.txt", true),
    ]);
    const candidate = { entries: Object.fromEntries(rows), ideas, site, redirects, robots };
    if (!validPublished(candidate)) throw new Error("Incomplete published content");
    applyPublished(candidate);
    try { cache?.setItem(key, JSON.stringify(dataOf(candidate))); } catch { /* Storage is optional. */ }
    return { source: "published" };
  } catch { return { source: fallback }; }
  finally { clearTimeout(timer); }
}
