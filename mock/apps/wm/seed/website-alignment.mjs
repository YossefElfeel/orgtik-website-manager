import fs from "node:fs";
const approved = JSON.parse(fs.readFileSync(new URL("./website-alignment.json", import.meta.url), "utf8"));
const copy = value => JSON.parse(JSON.stringify(value));
export const websiteAlignmentRedirects = () => copy(approved.redirects);

/** Approved current-site additions to the archived extraction source. Seed only. */
export function applyWebsiteAlignment(entries) {
  const entry = id => { const value = entries.find(row => row.id === id); if (!value) throw new Error(`Missing website entry ${id}`); return value; };
  const partners = entries.findIndex(row => row.id === approved.partners.id);
  if (partners === -1) entries.push(copy(approved.partners)); else entries[partners] = copy(approved.partners);
  for (const current of approved.strings) {
    const index = entries.findIndex(row => row.id === current.id);
    if (index === -1) entries.push(copy(current)); else entries[index] = copy(current);
  }
  const commerce = entry("st_commerce");
  commerce.layout = commerce.layout.filter(section => section.key !== "b21");
  commerce.layout.push(copy(approved.accountSetup.layout));
  commerce.locales.en.b21 = copy(approved.accountSetup.words);
  entry("gl_footer").locales.en.start = copy(approved.footerStart);
  entry("pg_legal").locales.en.hero["p-2"] = approved.legalIntro;
  Object.assign(entry("st_legal").locales.en.b1, approved.legalLabels);
}
