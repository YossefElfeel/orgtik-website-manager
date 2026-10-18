// Detail titles stay with the content, without a media hero or promotional actions.
export function ContentHeading({ title }) {
  return (
    <header className="content-heading">
      {title.eyebrow && <p>{title.eyebrow}</p>}
      <h1>{[title.l1, title.l2, title.acc].filter(Boolean).join(" ")}</h1>
    </header>
  );
}
