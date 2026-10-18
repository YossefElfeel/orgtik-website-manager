import React from "react";

const source = (value) =>
  typeof value === "string" &&
  value &&
  !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)
    ? `/assets/${value.replace(/^\/+/, "")}`
    : /^https?:\/\//i.test(value ?? "")
      ? value
      : null;
const paragraphStyle = {
  fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
  marginTop: "14px",
  fontSize: "17px",
  lineHeight: "1.75",
  color: "#DCD0E6",
  whiteSpace: "pre-wrap",
};

/** The managed article body uses the existing editorial typography and can interleave media. */
export function ArticleBlocks({ blocks }) {
  return blocks.map((block) => {
    if (block.kind === "text")
      return (
        <p key={block.id} style={paragraphStyle}>
          {block.text}
        </p>
      );
    const src = source(block.src);
    if (!src) return null;
    const style = {
      display: "block",
      width: "100%",
      height: "auto",
      borderRadius: "16px",
    };
    return (
      <figure key={block.id} style={{ margin: "24px 0" }}>
        {block.kind === "video" ? (
          <video
            src={src}
            aria-label={block.alt || undefined}
            controls
            preload="metadata"
            style={style}
          />
        ) : (
          <img src={src} alt={block.alt ?? ""} loading="lazy" style={style} />
        )}
        {block.caption ? (
          <figcaption
            style={{
              marginTop: "10px",
              color: "#DCD0E6",
              fontSize: "14px",
              lineHeight: "1.6",
            }}
          >
            {block.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  });
}
