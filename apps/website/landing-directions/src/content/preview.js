// Preview (D-035): the Website Manager shows this site in frames with unpublished drafts. A frame
// opens the site with ?preview; the site asks its parent for a preview token (postMessage, never in
// the address: D-017), reads the drafts with it, and lays them over the published snapshot before
// the first render. Outside such a frame nothing here runs, and the site renders from the snapshot
// as always.
import snapshot from "./snapshot.js";

const WM = import.meta.env?.VITE_WM_ORIGIN ?? "http://localhost:3007";
const API = import.meta.env?.VITE_CMS_API ?? "http://localhost:4007/v2";
// Only the Website Manager may hand a token (as localhost or 127.0.0.1, the same local app).
const TRUSTED = new Set([
  WM,
  WM.replace("//localhost", "//127.0.0.1"),
  WM.replace("//127.0.0.1", "//localhost"),
]);
let parentOrigin = null;

export const isPreview = () =>
  new URLSearchParams(window.location.search).has("preview") &&
  window.parent !== window;

function askToken() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no token")), 5000);
    window.addEventListener("message", function listen(event) {
      if (
        event.source !== window.parent ||
        !TRUSTED.has(event.origin) ||
        event.data?.type !== "orgtik:preview-token"
      )
        return;
      window.removeEventListener("message", listen);
      clearTimeout(timer);
      parentOrigin = event.origin;
      resolve(event.data.token);
    });
    // Saying "ready" carries nothing; the answer is what's checked.
    window.parent.postMessage({ type: "orgtik:preview-ready" }, "*");
  });
}

// Replaces each type's entries in place: copy.js and strings.js keep references to the entry
// objects they were built with, so the objects are refilled rather than swapped.
function lay(type, drafts) {
  const list = (snapshot.entries[type] ??= []);
  const byId = new Map(list.map((e) => [e.id, e]));
  const next = drafts.map((d) => {
    const e = byId.get(d.id);
    if (!e) return d;
    for (const k of Object.keys(e)) delete e[k];
    return Object.assign(e, d);
  });
  list.splice(0, list.length, ...next);
}

/** Loads the drafts into the snapshot; resolves false when the preview couldn't open. */
export async function loadPreview() {
  try {
    const token = await askToken();
    const types = Object.keys(snapshot.entries);
    const got = await Promise.all(
      types.map(async (t) => {
        const res = await fetch(`${API}/preview/entries/${t}`, {
          headers: { authorization: `Preview ${token}` },
        });
        if (!res.ok) throw new Error(`${t}: ${res.status}`);
        return [t, (await res.json()).data];
      }),
    );
    for (const [t, drafts] of got) lay(t, drafts);
    // Tell the frame what the page came out as: its address and whether it fits its width.
    // Checked every second, sent when it changes (the visitor may click around inside the frame).
    let last = "";
    setInterval(() => {
      const state = {
        type: "orgtik:preview-state",
        path: window.location.pathname,
        title: document.title,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
      const key = JSON.stringify(state);
      if (key !== last) window.parent.postMessage(state, parentOrigin);
      last = key;
    }, 1000);
    return true;
  } catch (e) {
    window.parent.postMessage(
      { type: "orgtik:preview-error", message: String(e.message) },
      parentOrigin ?? "*",
    );
    return false;
  }
}
