// The media library seed: every image, logo and video the website ships (public/assets), read
// without changing anything. Fonts and manifests aren't media and stay out.
//
// For each file: kind, size, pixel size (webp header, svg viewBox), and where the page code uses
// it directly (`templateUses`: the hero video, logos, placeholder client logos). Where content
// uses it (a case study's image, a module's picture) is worked out live from the entries.
// Nothing on the site says who owns an image or what its licence is, so rights start "unknown",
// and descriptions start empty: both show up as media issues until someone fills them in.
import fs from "node:fs";
import path from "node:path";

const KIND = { webp: "image", png: "image", jpg: "image", jpeg: "image", svg: "vector", mp4: "video", webm: "video" };

function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  return null;
}
function svgSize(text) {
  const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(text);
  return vb ? { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) } : null;
}

export function buildMedia({ site, ref, pages, SEEDED_AT }) {
  const assets = path.join(site, "landing-directions", "public", "assets");
  const files = [];
  (function walk(dir) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full);
      else if (KIND[d.name.split(".").pop().toLowerCase()]) files.push(full);
    }
  })(assets);
  files.sort();
  const code = Object.fromEntries(pages.map(([key, file]) => [key, fs.readFileSync(path.join(ref, file), "utf8")]));
  return files.map((full, i) => {
    const rel = path.relative(assets, full).split(path.sep).join("/");
    const ext = rel.split(".").pop().toLowerCase();
    const buf = fs.readFileSync(full);
    const size = ext === "webp" ? webpSize(buf) : ext === "svg" ? svgSize(buf.toString("utf8")) : null;
    return {
      id: `md_${String(i + 1).padStart(2, "0")}`,
      file: rel,
      kind: KIND[ext],
      bytes: buf.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      alt: {},
      rights: { status: "unknown", holder: "", expires: null, note: "" },
      focal: { x: 50, y: 50 },
      // A numbered file (logo-ph-3.svg) may be named in code as "logo-ph-" + n.
      templateUses: Object.entries(code)
        .filter(([, src]) => src.includes(rel) || (/-\d+\.\w+$/.test(rel) && src.includes(`/assets/${rel.replace(/\d+\.\w+$/, "")}"`)))
        .map(([k]) => k),
      source: "website",
      addedAt: SEEDED_AT,
      version: 1,
    };
  });
}
