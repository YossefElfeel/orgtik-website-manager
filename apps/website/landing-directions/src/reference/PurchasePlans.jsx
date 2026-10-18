import React, { useState } from "react";
import { CommerceLayout } from "./CommerceLayout";
import {
  CATALOG,
  HOSTING_URL,
  groupFromIds,
  money,
  configurationHref,
  quoteGroup,
} from "./purchase-catalog.js";
import { BundleCollection, PreviewNote } from "./PurchaseUI";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";
import {
  DurationPicker,
  AddPackageButton,
  PurchaseAction,
} from "./PurchaseControls";
export default function PurchasePlans() {
  const [kind, setKind] = useState("service");
  const [department, setDepartment] = useState("all");
  const [months, setMonths] = useState(1);
  const entries = CATALOG.filter((i) => i.kind === kind);
  const departments = [
    ...new Map(entries.map((i) => [i.department, i.departmentName])).entries(),
  ];
  const visible = entries.filter(
    (i) => department === "all" || i.department === department,
  );
  return (
    <CommerceLayout steps={false}>
      <div className="purchase-surface purchase-plans">
        <div className="purchase-directory-intro">
          <div>
            <span className="purchase-eyebrow">
              {run("gl_commerce|purchasePlans-intro|div", 0)}
            </span>
            <h1>{run("gl_commerce|purchasePlans-intro|h1", 0)}</h1>
            <p>{run("gl_commerce|purchasePlans-intro|p", 0)}</p>
          </div>
          <PurchaseAction
            secondary
            href={
              kind === "service"
                ? "/services#svc-builder"
                : "/software#plan-builder"
            }
          >
            {run("gl_commerce|purchasePlans-intro|PurchaseAction", 0)}
          </PurchaseAction>
        </div>
        <div className="purchase-browse-toolbar">
          <div
            className="purchase-type-switch"
            role="group"
            aria-label={attr("gl_commerce|purchasePlans-intro|div@aria-label")}
          >
            <button
              type="button"
              aria-pressed={kind === "service"}
              onClick={() => {
                setKind("service");
                setDepartment("all");
              }}
            >
              {run("gl_commerce|purchasePlans-intro|button", 0)}
            </button>
            <button
              type="button"
              aria-pressed={kind === "software"}
              onClick={() => {
                setKind("software");
                setDepartment("all");
              }}
            >
              {run("gl_commerce|purchasePlans-intro|button-2", 0)}
            </button>
          </div>
          <div
            className="purchase-filters"
            role="group"
            aria-label={attr(
              "gl_commerce|purchasePlans-intro|div@aria-label-2",
            )}
          >
            <button
              type="button"
              aria-pressed={department === "all"}
              onClick={() => setDepartment("all")}
            >
              {run("gl_commerce|purchasePlans-intro|button-3", 0)}
            </button>
            {departments.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={department === id}
                onClick={() => setDepartment(id)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="purchase-collection-heading">
          <h2>{run("gl_commerce|purchasePlans-intro|h2", 0)}</h2>
          <p>{run("gl_commerce|purchasePlans-intro|p-2", 0)}</p>
        </div>
        <BundleCollection kind={kind} department={department} />
        <div className="purchase-heading purchase-individual-heading">
          <div>
            <span className="purchase-eyebrow">
              {run("gl_commerce|purchasePlans-intro|div-2", 0)}
            </span>
            <h2>{run("gl_commerce|purchasePlans-intro|h2-2", 0)}</h2>
          </div>
          <DurationPicker
            label={msg("PurchasePlans:1")}
            months={months}
            onChange={setMonths}
            showSavings
          />
        </div>
        <div className="purchase-directory">
          {visible.map((item) => {
            const group = groupFromIds(kind, [item.id], months);
            const quote = quoteGroup(group);
            return (
              <article className="purchase-directory-row" key={item.id}>
                <div>
                  <span className="purchase-eyebrow">
                    {item.departmentName}
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.capabilities.join(" · ")}</p>
                </div>
                <div>
                  <strong>{money(quote.total)}</strong>
                  <small>
                    {months} {months === 1 ? "month" : "months"}
                    {run("gl_commerce|purchasePlans-intro|div-3", 0)}
                  </small>
                  <small>
                    {money(Math.round(quote.monthlyEquivalent))}
                    {run("gl_commerce|purchasePlans-intro|div-4", 0)}
                  </small>
                </div>
                <div>
                  <AddPackageButton item={group} />
                  <a
                    href={configurationHref(group)}
                    aria-label={msg("PurchasePlans:2", [item.name])}
                  >
                    {run("gl_commerce|purchasePlans-intro|a", 0)}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
        <div className="purchase-directory-footer">
          <PurchaseAction
            href={
              kind === "service"
                ? "/services#svc-builder"
                : "/software#plan-builder"
            }
          >
            {run("gl_commerce|purchasePlans-intro|PurchaseAction-2", 0)}
          </PurchaseAction>
          <a href={HOSTING_URL}>
            {run("gl_commerce|purchasePlans-intro|a-2", 0)}
            {run("gl_commerce|purchasePlans-intro|a-2", 1)}
            <i className="ph ph-arrow-up-right" aria-hidden="true" />
          </a>
        </div>
        <PreviewNote />
      </div>
    </CommerceLayout>
  );
}
