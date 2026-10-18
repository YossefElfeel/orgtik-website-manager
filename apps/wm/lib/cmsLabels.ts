import type { Node } from "./caseStudySchema";

// Older published layouts carry English display labels. Translate their editor
// controls without changing content keys, values or the published layout.
const aliases: Record<string, string> = {
  "Partners introduction and controls": "partnersIntro",
  "Partner profiles": "partnerProfiles",
  "Partners": "partners",
  "Partner": "partner",
  "Anchor ID": "partnerId",
  "Name": "name",
  "Category": "category",
  "Profile description": "partnerSummary",
  "Logo asset path": "partnerLogo",
  "Website URL": "partnerWebsite",
  "Show partner": "partnerVisible",
  "Mock partner": "partnerMock",
  "Social profiles (optional)": "partnerAccounts",
  "Social profile": "partnerAccount",
  "Platform name": "partnerPlatform",
  "Profile URL": "partnerProfileUrl",
  "Mock website link label": "exampleWebsiteLabel",
  "Mock social profile label prefix": "exampleAccountLabel",
  "External link accessibility hint": "externalLabel",
  "Offer and payment states": "offerPaymentStates",
};

export const cmsLabelKey = (label: string) => aliases[label] ?? label;

export function cmsNodeLabels(node: Node): Node {
  if (node.kind === "text" && node.label === "icon") return { ...node, kind: "icon" };
  const translated = { ...node, ...(node.label ? { label: cmsLabelKey(node.label) } : {}) };
  if (translated.kind === "group") return { ...translated, fields: Object.fromEntries(Object.entries(translated.fields).map(([key, child]) => [key, cmsNodeLabels(child)])) };
  if (translated.kind === "list") return { ...translated, itemLabel: cmsLabelKey(translated.itemLabel), item: cmsNodeLabels(translated.item) };
  return translated;
}
