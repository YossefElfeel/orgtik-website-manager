// Local replacement for api.iconify.design, serving icon sets from the @iconify-json/* packages.
// Implements the two request shapes the apps use:
//   GET /{prefix}.json?icons=a,b,c   (what @iconify/react requests)
//   GET /{prefix}/{name}.svg?color=  (what the SoSBar launcher requests)
const express = require("express");
const cors = require("cors");
const { getIcons, getIconData, iconToSVG, iconToHTML, replaceIDs } = require("@iconify/utils");

const cache = new Map();
function loadSet(prefix) {
  if (!/^[a-z0-9-]+$/.test(prefix)) return null;
  if (cache.has(prefix)) return cache.get(prefix);
  let set = null;
  try {
    set = require(`@iconify-json/${prefix}/icons.json`);
  } catch {
    set = null;
  }
  cache.set(prefix, set);
  return set;
}

// staticMounts: [{ path, dir }] extra folders to serve, e.g. Excalidraw's fonts for the HQ whiteboard.
function start(port, staticMounts = []) {
  const app = express();
  app.use(cors());
  for (const m of staticMounts) app.use(m.path, express.static(m.dir, { maxAge: "7d" }));

  app.get("/:prefix.json", (req, res) => {
    const set = loadSet(req.params.prefix);
    if (!set) return res.status(404).json({ error: `Icon set "${req.params.prefix}" is not installed in local-dev` });
    const names = String(req.query.icons || "").split(",").map((s) => s.trim()).filter(Boolean);
    const data = getIcons(set, names, true) || { prefix: set.prefix, icons: {} };
    const missing = names.filter((n) => !data.icons?.[n] && !data.aliases?.[n]);
    if (missing.length) data.not_found = missing;
    res.set("Cache-Control", "public, max-age=604800").json(data);
  });

  app.get("/:prefix/:name.svg", (req, res) => {
    const set = loadSet(req.params.prefix);
    const icon = set && getIconData(set, req.params.name);
    if (!icon) return res.status(404).type("text/plain").send("Icon not found");
    const size = { height: req.query.height || "1em" };
    if (req.query.width) size.width = req.query.width;
    const r = iconToSVG(icon, size);
    let body = replaceIDs(r.body);
    if (req.query.color) body = body.replace(/currentColor/g, String(req.query.color));
    res.set("Cache-Control", "public, max-age=604800").type("image/svg+xml").send(iconToHTML(body, r.attributes));
  });

  app.listen(port, () => console.log(`[icons] local icon API on http://localhost:${port}`));
}

module.exports = { start };
