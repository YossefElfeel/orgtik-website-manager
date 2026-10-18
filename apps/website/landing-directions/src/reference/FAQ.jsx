import React from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { FAQAccordion } from "./FAQSection";
import snapshot from "../content/snapshot";
import { wordsOf } from "../content/locale";
import { managedPageTree } from "../content/managed-page";
import "./cms-content.css";
import "./faq.css";

export default function FAQ() {
  const words = wordsOf(
    snapshot.entries.page.find((entry) => entry.id === "pg_faq")?.locales,
  )?.hero;
  return (
    <div className="faq-page">
      <SiteHeader />
      {managedPageTree(
        <main id="top" className="faq-content">
          <section data-cms-section="hero" className="faq-intro">
            <p className="faq-kicker">
              <span aria-hidden="true" />
              FAQ
            </p>
            <h1>{words?.title ?? "Frequently asked questions"}</h1>
            <p>{words?.intro}</p>
          </section>
          <section data-cms-section="questions" className="faq-questions">
            <FAQAccordion />
          </section>
        </main>,
        "pg_faq",
      )}
      <SiteFooter />
    </div>
  );
}
