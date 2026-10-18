import React, { useSyncExternalStore } from "react";
import {
  getPricingSnapshot,
  loadPublicCatalog,
  subscribePricing,
} from "./purchase-catalog.js";
import { msg } from "../content/strings.js";

export function taxCaption(source) {
  const tax = source?.policy?.tax;
  if (!tax) return "—";
  const rate = new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(tax.rate / 100);
  return msg(
    tax.reverseCharge
      ? "PlatformPricing:9"
      : tax.rate === 0
        ? "PlatformPricing:10"
        : tax.inclusive
          ? "PlatformPricing:7"
          : "PlatformPricing:8",
    [rate],
  );
}

export function PurchasePriceStatus({ source }) {
  const pricing = useSyncExternalStore(
    subscribePricing,
    getPricingSnapshot,
    getPricingSnapshot,
  );
  if (!source && (pricing.status === "idle" || pricing.status === "loading"))
    return (
      <p className="purchase-caption" role="status">
        {msg("PlatformPricing:1")}
      </p>
    );
  if (!source && pricing.status === "error")
    return (
      <p className="purchase-caption" role="alert">
        {msg("PlatformPricing:2")}{" "}
        <button
          type="button"
          className="purchase-text-button"
          onClick={() => loadPublicCatalog({ force: true })}
        >
          {msg("PlatformPricing:3")}
        </button>
      </p>
    );
  const context = source || pricing;
  const country = context.region?.country;
  const name = country
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(country)
    : "—";
  return (
    <p className="purchase-caption">
      {msg(
        context.region?.source === "workspace"
          ? "PlatformPricing:14"
          : "PlatformPricing:13",
        [name, context.currency],
      )}{" "}
      {taxCaption(context)}
    </p>
  );
}
