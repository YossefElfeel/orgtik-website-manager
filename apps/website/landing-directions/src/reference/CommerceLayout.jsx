import React from "react";
import { SiteHeader } from "./SiteHeader";
import { bare } from "../content/locale";
import { attr, run } from "../content/copy";
import { faqLabel, SharedMedia } from "../content/managed-page";

export function CommerceLayout({
  checkout = false,
  complete = false,
  steps = true,
  className = "",
  children,
}) {
  const path = bare(window.location.pathname);
  const prefix = path === "/checkout" ? "purchaseCheckout-" : path === "/cart" ? "purchaseCart-" : "purchasePlans-";
  return (
    <div className={`commerce-page ${className}`}>
      <SiteHeader />
      <main id="top" className="commerce-main">
        {steps && (
          <nav
            aria-label={attr("gl_commerce|commerceLayout-intro|nav@aria-label")}
            className="commerce-steps"
          >
            <a href="/cart" aria-current={!checkout ? "step" : undefined}>
              <span>{run("gl_commerce|commerceLayout-intro|a", 1)}</span>
              {run("gl_commerce|commerceLayout-intro|a", 2)}
            </a>
            <i className="ph ph-arrow-right" aria-hidden="true" />
            <span aria-current={checkout && !complete ? "step" : undefined}>
              <span>2</span>
              {run("gl_commerce|commerceLayout-intro|nav", 0)}
            </span>
            <i className="ph ph-arrow-right" aria-hidden="true" />
            <span aria-current={complete ? "step" : undefined}>
              <span>3</span>
              {run("gl_commerce|commerceLayout-intro|nav-2", 0)}
            </span>
          </nav>
        )}
        {children}
        <SharedMedia id="gl_commerce" prefixes={[prefix, "purchaseUI-", "purchaseControls-", "commerceLayout-intro", ...(path === "/checkout" ? ["paymentDetails-"] : [])]} />
      </main>
      <footer className="commerce-footer">
        <a href="/" className="commerce-footer__logo">
          <img
            src="/assets/logo/orgtik-mark-white.svg"
            alt=""
            className="commerce-brand__mark"
          />
          <img
            src="/assets/logo/orgtik-wordmark-white.svg"
            alt={attr("gl_commerce|commerceLayout-footer|img@alt")}
            className="commerce-brand__wordmark"
          />
        </a>
        <p>{run("gl_commerce|commerceLayout-footer|p", 0)}</p>
        <div>
          <a href="/faq">{faqLabel()}</a>
          <a href="/plans">{run("gl_commerce|commerceLayout-footer|a", 0)}</a>
          <a href="/contact">
            {run("gl_commerce|commerceLayout-footer|a-2", 0)}
          </a>
          <a href="/legal#/privacy">
            {run("gl_commerce|commerceLayout-footer|a-3", 0)}
          </a>
        </div>
        <SharedMedia id="gl_footer" />
        <SharedMedia id="gl_socials" />
        <SharedMedia id="gl_commerce" prefixes={["commerceLayout-footer"]} />
      </footer>
    </div>
  );
}
