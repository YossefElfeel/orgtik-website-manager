// Checks the chart palette (viz-1…8) in both themes:
//   - every series colour against the surfaces charts sit on (raised and canvas): at least 3:1,
//     the WCAG minimum for graphics
//   - the first four series against each other under simulated protanopia, deuteranopia and
//     tritanopia (Machado et al. 2009, full severity): far enough apart to tell (CIE76 ΔE ≥ 15;
//     with every colour kept at 3:1 on both light surfaces, about 17 is the best reachable);
//     series 5–8 are for charts that also label their series, so they're reported, not required
//
//   node scripts/check-viz.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = JSON.parse(fs.readFileSync(path.join(root, "tokens", "color-and-scale.json"), "utf8"));
const resolve = (v) => {
  const m = /^\{color\.(\w+)\.(\w+)\}$/.exec(v);
  return m ? src.color[m[1]][m[2]].$value : v;
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const MACHADO = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const simulate = (hex, m) => {
  const c = rgb(hex).map(lin);
  return m.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
};
const lab = (linRgb) => {
  const [r, g, b] = linRgb;
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const dE = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

let failed = 0;
for (const theme of ["light", "dark"]) {
  const s = src.semantic[theme];
  const series = Array.from({ length: 8 }, (_, i) => resolve(s[`viz-${i + 1}`].$value));
  const surfaces = { raised: resolve(s["bg-raised"].$value), canvas: resolve(s["bg-canvas"].$value) };
  console.log(`\n${theme}`);
  series.forEach((c, i) => {
    const rs = Object.entries(surfaces).map(([k, bg]) => [k, ratio(c, bg)]);
    const low = rs.filter(([, r]) => r < 3);
    if (low.length) failed += 1;
    console.log(`  viz-${i + 1} ${c}  ${rs.map(([k, r]) => `${k} ${r.toFixed(2)}:1`).join("  ")}${low.length ? "  ✗ below 3:1" : ""}`);
  });
  for (const [kind, m] of Object.entries(MACHADO)) {
    let worst = Infinity, pair = "";
    let worstAll = Infinity, pairAll = "";
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const d = dE(lab(simulate(series[i], m)), lab(simulate(series[j], m)));
        if (i < 4 && j < 4 && d < worst) [worst, pair] = [d, `viz-${i + 1}/viz-${j + 1}`];
        if (d < worstAll) [worstAll, pairAll] = [d, `viz-${i + 1}/viz-${j + 1}`];
      }
    const bad = worst < 15;
    if (bad) failed += 1;
    console.log(`  ${kind.padEnd(12)} first four: closest ${pair} ΔE ${worst.toFixed(1)}${bad ? "  ✗ below 15" : ""}   all eight: closest ${pairAll} ΔE ${worstAll.toFixed(1)}`);
  }
}
console.log(failed ? `\n${failed} problems` : "\nThe chart palette passes.");
process.exitCode = failed ? 1 : 0;
