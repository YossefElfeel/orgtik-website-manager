import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaginatedTable } from "../../dist/table/PaginatedTable.js";

function render(count, grouped = false) {
  const rows = Array.from({ length: count }, (_, index) =>
    h(
      "tr",
      { key: index },
      h(
        "td",
        null,
        h("input", {
          defaultValue: `Value ${index}`,
          "aria-label": `Line ${index}`,
        }),
      ),
    ),
  );
  const head = h(
    "thead",
    { className: "sticky top-0" },
    h("tr", null, h("th", { rowSpan: 2, scope: "col" }, "Invoice line")),
  );
  const foot = h(
    "tfoot",
    null,
    h("tr", null, h("td", null, "Invoice total stays visible")),
  );
  const bodies = grouped
    ? [
        h("tbody", { key: "first" }, h(Fragment, null, rows.slice(0, 6))),
        h("tbody", { key: "second" }, rows.slice(6)),
      ]
    : h("tbody", null, rows);
  return renderToStaticMarkup(
    h(
      PaginatedTable,
      null,
      h(
        "table",
        { "aria-label": "Invoice" },
        h("caption", null, "Invoice"),
        head,
        bodies,
        foot,
      ),
    ),
  );
}

for (const count of [0, 1, 10, 11, 101]) {
  test(`specialized tables show at most ten of ${count} editable rows and retain invoice structure`, () => {
    const html = render(count);
    const body = (html.match(/<tbody[\s\S]*?<\/tbody>/g) ?? []).join("");
    assert.equal((body.match(/<input /g) ?? []).length, Math.min(10, count));
    assert.match(html, /<caption>Invoice<\/caption>/);
    assert.match(html, /<thead class="sticky top-0 bg-sunken">/);
    assert.match(html, /rowSpan="2" scope="col"/);
    assert.match(html, /<tfoot><tr><td>Invoice total stays visible/);
    assert.ok(
      html.includes(
        `${count === 0 ? 0 : 1}–${Math.min(10, count)} of ${count}`,
      ),
    );
  });
}
test("multiple bodies and fragments share one ten-row page", () => {
  const html = render(11, true);
  const body = (html.match(/<tbody[\s\S]*?<\/tbody>/g) ?? []).join("");
  assert.equal((body.match(/<input /g) ?? []).length, 10);
  assert.match(html, /value="Value 9"/);
  assert.doesNotMatch(html, /value="Value 10"/);
});
