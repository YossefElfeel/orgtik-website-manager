import React, { useEffect, useRef, useState } from "react";
import { cartTotals, formatCHF, formatItemEstimate } from "./cart-store";
import { getServicePeriodEstimate } from "./service-duration";
import "./plan-picker.css";

// Briefly highlight a total when it changes, and say what changed for screen readers.
function useTotalsFeedback(totals) {
  const previous = useRef(totals);
  const [changed, setChanged] = useState([]);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const before = previous.current;
    previous.current = totals;
    const keys = ["monthly", "project", "periodTotal"].filter(
      (key) => before[key] !== totals[key],
    );
    if (!keys.length) return undefined;
    setChanged(keys);
    setAnnouncement(
      [
        totals.monthly ? `Monthly from ${formatCHF(totals.monthly)}` : "",
        totals.project ? `one-off from ${formatCHF(totals.project)}` : "",
        `total for your chosen periods from ${formatCHF(totals.periodTotal)}`,
      ]
        .filter(Boolean)
        .join(", ") + ".",
    );
    const timer = setTimeout(() => setChanged([]), 900);
    return () => clearTimeout(timer);
  }, [totals.monthly, totals.project, totals.periodTotal]);
  return { changed, announcement };
}

function periodLabel(item) {
  if (item.billing !== "monthly" || item.estimate === null) return "";
  const total =
    item.kind === "service"
      ? getServicePeriodEstimate(item)
      : item.commitmentMonths > 1
        ? item.estimate * item.commitmentMonths
        : null;
  return total && item.commitmentMonths > 1
    ? `${item.duration}: ${item.kind === "service" ? "from " : ""}${formatCHF(total)}`
    : "";
}

export function CartSummary({
  items,
  children,
  showItems = false,
  cart = false,
}) {
  const totals = cartTotals(items);
  const { changed, announcement } = useTotalsFeedback(totals);
  const hasService = (billing) =>
    items.some(
      (item) =>
        item.kind === "service" &&
        item.billing === billing &&
        item.estimate !== null,
    );
  if (cart)
    return (
      <aside
        id="cart-estimate"
        className="commerce-summary cart-estimate"
        aria-label="Selection summary"
      >
        <h2>Estimate overview</h2>
        <p>
          All {items.length} {items.length === 1 ? "item is" : "items are"}{" "}
          included
        </p>
        <p className="plan-sr-only" aria-live="polite">
          {announcement}
        </p>
        <div className="cart-estimate__totals">
          {[
            {
              billing: "monthly",
              key: "monthly",
              label: "Monthly",
              suffix: "/ month",
              total: totals.monthly,
            },
            {
              billing: "project",
              key: "project",
              label: "One-off projects",
              suffix: "one-off",
              total: totals.project,
            },
          ].map((period) => {
            const selected = items.filter(
              (item) =>
                item.billing === period.billing && item.estimate !== null,
            );
            if (!selected.length) return null;
            return (
              <section
                className="cart-estimate__period"
                key={period.billing}
                aria-label={period.label}
              >
                <dl>
                  <dt>{period.label}</dt>
                  <dd
                    className={changed.includes(period.key) ? "is-updated" : ""}
                  >
                    {hasService(period.billing) && <small>From</small>}
                    {formatCHF(period.total)}
                    <span>{period.suffix}</span>
                  </dd>
                </dl>
                <ul>
                  {[
                    { kind: "software", label: "Software" },
                    { kind: "service", label: "Services" },
                  ].map((group) => {
                    const entries = selected.filter(
                      (item) => item.kind === group.kind,
                    );
                    return entries.length ? (
                      <li key={group.kind}>
                        <span>
                          {group.label}
                          <small>
                            {entries.length}{" "}
                            {entries.length === 1 ? "item" : "items"}
                          </small>
                        </span>
                        <b>
                          {group.kind === "service" && "From "}
                          {formatCHF(
                            entries.reduce(
                              (sum, item) => sum + item.estimate,
                              0,
                            ),
                          )}
                        </b>
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            );
          })}
          <section
            className="cart-estimate__period cart-estimate__period--total"
            aria-label="Total for your chosen periods"
          >
            <dl>
              <dt>Total for your chosen periods</dt>
              <dd
                className={changed.includes("periodTotal") ? "is-updated" : ""}
              >
                {items.some((item) => item.kind === "service") && (
                  <small>From</small>
                )}
                {formatCHF(totals.periodTotal)}
              </dd>
            </dl>
            <p className="cart-estimate__explain">
              Monthly items × their commitment or billing term, plus one-off
              projects.
            </p>
            {totals.savings > 0 && (
              <p className="cart-estimate__savings">
                <i className="ph ph-seal-percent" aria-hidden="true" />
                Includes {formatCHF(totals.savings)} in bundle and term savings
              </p>
            )}
          </section>
          {totals.onRequest && (
            <div className="cart-estimate__request">
              <span>Items priced on request</span>
              <strong>
                {items.filter((item) => item.estimate === null).length}
              </strong>
            </div>
          )}
        </div>
        {children}
        <p className="cart-estimate__note">
          Preview estimates. Final scope, pricing, taxes and terms will be
          confirmed with the team.
        </p>
      </aside>
    );
  return (
    <aside className="commerce-summary" aria-label="Selection summary">
      <h2>Your selection</h2>
      <p>
        {items.length} {items.length === 1 ? "item" : "items"} to discuss with
        OrgTik
      </p>
      {showItems && (
        <ul className="commerce-summary__items">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {[item.plan && `${item.plan} plan`, item.duration]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span>
                {item.selections.map((selection) => selection.name).join(", ")}
              </span>
              <span>{formatItemEstimate(item)}</span>
              {periodLabel(item) && <span>{periodLabel(item)}</span>}
            </li>
          ))}
        </ul>
      )}
      <dl className="commerce-totals">
        {totals.monthly > 0 && (
          <div>
            <dt>Monthly</dt>
            <dd>
              {hasService("monthly") && "From "}
              {formatCHF(totals.monthly)}
              <small> / month</small>
            </dd>
          </div>
        )}
        {totals.project > 0 && (
          <div>
            <dt>One-off projects</dt>
            <dd>From {formatCHF(totals.project)}</dd>
          </div>
        )}
        <div>
          <dt>Total for your chosen periods</dt>
          <dd>
            {items.some((item) => item.kind === "service") && "From "}
            {formatCHF(totals.periodTotal)}
          </dd>
        </div>
        {totals.savings > 0 && (
          <div>
            <dt>Savings included</dt>
            <dd>{formatCHF(totals.savings)}</dd>
          </div>
        )}
        {totals.onRequest && (
          <div>
            <dt>Additional items</dt>
            <dd>On request</dd>
          </div>
        )}
      </dl>
      <p className="commerce-summary__note">
        Prototype estimates. Final scope, pricing, taxes and terms will be
        confirmed with the team. Nothing is charged at checkout.
      </p>
      {children}
    </aside>
  );
}

export function EmptyCart({ checkout = false }) {
  return (
    <div className="commerce-empty">
      <i className="ph ph-shopping-cart" aria-hidden="true" />
      <h2>
        {checkout ? "Choose something to get started." : "Your cart is empty."}
      </h2>
      <p>
        Add a service bundle or software plan to your cart, then share your
        contact details with your selection.
      </p>
      <div className="commerce-empty__actions">
        <a href="/services#svc-builder" className="commerce-action">
          Explore service bundles{" "}
          <span className="commerce-action__arrow">
            <i className="ph ph-arrow-up-right" aria-hidden="true" />
          </span>
        </a>
        <a
          href="/software#plan-builder"
          className="commerce-action commerce-action--secondary"
        >
          Explore software plans{" "}
          <span className="commerce-action__arrow">
            <i className="ph ph-arrow-up-right" aria-hidden="true" />
          </span>
        </a>
      </div>
      <a href="/plans" className="commerce-empty__plans">
        Or compare every plan and price in one place
        <i className="ph ph-arrow-right" aria-hidden="true" />
      </a>
    </div>
  );
}
