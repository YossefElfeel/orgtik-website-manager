// Article sections remain compatible with the imported {heading, paragraphs} shape.
// Stable section/block IDs keep translated words attached to their content when English moves.
const asset = (value) =>
  typeof value === "string" &&
  value.length <= 2048 &&
  (!value ||
    /^(https?:)\/\//i.test(value) ||
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
const id = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const text = (value, limit) =>
  value === undefined || (typeof value === "string" && value.length <= limit);

function normalize(sections = []) {
  return sections.map((section, index) => ({
    id: section.id ?? `section-${index}`,
    heading: section.heading ?? "",
    blocks:
      section.blocks ??
      (section.paragraphs ?? []).map((value, n) => ({
        id: `paragraph-${n}`,
        kind: "text",
        text: value,
      })),
  }));
}
function validate(sections, { publishing = false } = {}) {
  if (!Array.isArray(sections) || sections.length > 100) return "invalid";
  const sectionIds = new Set();
  for (const section of sections) {
    if (!section || typeof section !== "object" || !text(section.heading, 500))
      return "invalid";
    if (
      section.id !== undefined &&
      (!id(section.id) || sectionIds.has(section.id))
    )
      return "invalid";
    sectionIds.add(section.id);
    if (section.blocks === undefined) {
      if (
        !Array.isArray(section.paragraphs) ||
        section.paragraphs.length > 200 ||
        section.paragraphs.some((value) => !text(value, 30000))
      )
        return "invalid";
      continue;
    }
    if (
      !id(section.id) ||
      !Array.isArray(section.blocks) ||
      section.blocks.length > 200
    )
      return "invalid";
    const blockIds = new Set();
    for (const block of section.blocks) {
      if (
        !block ||
        !id(block.id) ||
        blockIds.has(block.id) ||
        !["text", "image", "video"].includes(block.kind)
      )
        return "invalid";
      blockIds.add(block.id);
      if (block.kind === "text") {
        if (!text(block.text, 30000)) return "invalid";
      } else if (
        !asset(block.src) ||
        !text(block.alt, 2000) ||
        !text(block.caption, 2000) ||
        (publishing && !block.src?.trim())
      )
        return "invalid";
    }
  }
  return null;
}
function structure(sections) {
  return normalize(sections).map((section) => ({
    id: section.id,
    blocks: section.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      ...(block.kind !== "text" ? { src: block.src } : {}),
    })),
  }));
}
function synchronize(english, previousEnglish, translation) {
  const previous = normalize(previousEnglish);
  const translated = normalize(translation);
  return normalize(english).map((section) => {
    const beforeIndex = previous.findIndex((item) => item.id === section.id);
    const words =
      translated.find((item) => item.id === section.id) ??
      (beforeIndex >= 0 ? translated[beforeIndex] : undefined);
    return {
      id: section.id,
      heading: words?.heading ?? "",
      blocks: section.blocks.map((block) => {
        const original = words?.blocks.find(
          (item) => item.id === block.id && item.kind === block.kind,
        );
        return block.kind === "text"
          ? { id: block.id, kind: block.kind, text: original?.text ?? "" }
          : {
              id: block.id,
              kind: block.kind,
              src: block.src,
              alt: original?.alt ?? "",
              caption: original?.caption ?? "",
            };
      }),
    };
  });
}
module.exports = { normalize, validate, structure, synchronize };
