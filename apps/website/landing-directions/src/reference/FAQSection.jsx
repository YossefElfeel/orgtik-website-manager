import React from "react";
import { content } from "../content";
import snapshot from "../content/snapshot";
import { wordsOf } from "../content/locale";
import "./faq.css";

export function FAQAccordion() {
  return content.FAQS().map(([question, answer], index) => (
    <details key={index} className="faq-item">
      <summary>
        <span className="faq-number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="faq-question">{question}</span>
        <span className="faq-toggle" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="faq-answer">{answer}</div>
    </details>
  ));
}
export function FAQSection(props) {
  const title = wordsOf(
    snapshot.entries.page.find((entry) => entry.id === "pg_faq")?.locales,
  )?.hero?.title;
  return (
    <section {...props} className="home-faq">
      <div className="home-faq-inner">
        <h2>{title}</h2>
        <div>
          <FAQAccordion />
        </div>
      </div>
    </section>
  );
}
