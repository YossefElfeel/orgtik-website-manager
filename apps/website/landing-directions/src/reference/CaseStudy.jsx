import React, { useLayoutEffect, useRef, useState } from "react";
import { CASE_STUDIES, CASE_STUDY_FORMATS } from "./case-studies";
import "./case-study.css";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings.js";

// Project detail story: one shared brief, then a department-specific way of
// showing the steps, the delivered work and the results.
export function CaseStudy({ project }) {
  const headerRef = useRef(null);
  useChartReveal(headerRef);
  const candidate = CASE_STUDIES[project.slug];
  const study = candidate?.approved || candidate?.sample ? candidate : null;
  const dept = study?.department || project.service;
  const format = CASE_STUDY_FORMATS[dept];
  const view = DEPARTMENTS[dept];
  return (
    <>
      <header ref={headerRef} className={"cs-header cs--" + dept}>
        <p className="cs-header__eyebrow">
          {run("gl_components|caseStudy-header|p", 0)}
          {project.category}
        </p>
        <h1>{project.name}</h1>
        <ul
          className="cs-header__tags"
          aria-label={attr("gl_components|caseStudy-header|ul@aria-label")}
        >
          <li className="is-status">{project.status}</li>
          {format && <li>{format}</li>}
          <li>{project.sector}</li>
        </ul>
      </header>
      <Brief project={project} study={study} dept={dept} />
      {study && view && (
        <>
          <section
            className={"cs-section cs-approach cs--" + dept}
            aria-labelledby="cs-approach-title"
          >
            <div className="cs-inner">
              <SectionHead
                n="02"
                label={msg("CaseStudy:1")}
                format={format}
                id="cs-approach-title"
                block={study.approach}
              />
              <view.Approach study={study} />
            </div>
          </section>
          <section
            className={"cs-section cs-delivered cs--" + dept}
            aria-labelledby="cs-delivered-title"
          >
            <div className="cs-inner">
              <SectionHead
                n="03"
                label={msg("CaseStudy:2")}
                id="cs-delivered-title"
                block={study.delivered}
              />
              <view.Delivered study={study} />
            </div>
          </section>
          <section
            className={"cs-section cs-results cs--" + dept}
            aria-labelledby="cs-results-title"
          >
            <div className="cs-inner">
              <SectionHead
                n="04"
                label={msg("CaseStudy:3")}
                id="cs-results-title"
                block={study.results}
              />
              <view.Results study={study} />
              {study.sample && <SampleNote />}
            </div>
          </section>
        </>
      )}
    </>
  );
}

// Charts grow into place once visible; they render complete without motion.
function useChartReveal(anchor) {
  useLayoutEffect(() => {
    const scope = anchor.current?.parentElement;
    if (
      !scope ||
      !("IntersectionObserver" in window) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.dataset.csState = "in";
          io.unobserve(entry.target);
        }),
      { threshold: 0.2 },
    );
    scope.querySelectorAll("[data-cs-animate]").forEach((el) => {
      el.dataset.csState = "pending";
      io.observe(el);
    });
    return () => io.disconnect();
  }, [anchor]);
}

function Eyebrow({ n, label, format }) {
  return (
    <p className="cs-eyebrow" data-reveal="up">
      <span className="cs-eyebrow__n">({n})</span>
      <span className="cs-eyebrow__rule" aria-hidden="true" />
      <span>{label}</span>
      {format && <span className="cs-eyebrow__format">{format}</span>}
    </p>
  );
}

function SectionHead({ n, label, format, id, block }) {
  return (
    <div className="cs-head">
      <div>
        <Eyebrow n={n} label={label} format={format} />
        <h2 id={id} data-reveal="mask">
          <span data-line="">{block.title[0]}</span>
          <span data-line="" className="cs-acc">
            {block.title[1]}
          </span>
        </h2>
      </div>
      <p data-reveal="up">{block.intro}</p>
    </div>
  );
}

function SampleNote() {
  return (
    <p className="cs-sample">
      <i className="ph ph-info" aria-hidden="true" />
      {run("gl_components|caseStudy-intro|p", 1)}
    </p>
  );
}

function Tags({ items }) {
  return (
    <ul className="cs-tags">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Brief({ project, study, dept }) {
  const facts = [
    [msg("CaseStudy:4"), study?.client],
    [msg("CaseStudy:5"), project.sector],
    [msg("CaseStudy:6"), study?.timeline],
    [msg("CaseStudy:7"), study?.team],
    [msg("CaseStudy:8"), project.status],
  ].filter(([, value]) => value);
  return (
    <section
      id="story"
      className={"cs-section cs-brief cs--" + dept}
      aria-labelledby="cs-brief-title"
    >
      <div className="cs-inner">
        <Eyebrow n="01" label={msg("CaseStudy:9")} />
        <div className="cs-brief__grid">
          <div className="cs-brief__main">
            <h2 id="cs-brief-title" data-reveal="mask">
              <span data-line="">{project.transformation}</span>
            </h2>
            <p className="cs-brief__summary" data-reveal="up">
              {project.summary}
            </p>
            {study && (
              <div className="cs-brief__cols" data-reveal="stagger">
                {[
                  [msg("CaseStudy:10"), study.challenge],
                  [msg("CaseStudy:11"), study.goal],
                  [msg("CaseStudy:12"), study.role],
                ].map(([title, text]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside className="cs-brief__aside" data-reveal="up">
            {study?.highlight && (
              <div className="cs-highlight">
                <span className="cs-highlight__tag">
                  {run("gl_components|caseStudy-story|div", 0)}
                </span>
                <strong>{study.highlight.value}</strong>
                <span>{study.highlight.label}</span>
                {study.sample && (
                  <small>{run("gl_components|caseStudy-story|div-2", 0)}</small>
                )}
              </div>
            )}
            <dl className="cs-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ---------- Design: an editorial design journal ---------- */

const isLight = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
};

function DesignApproach({ study }) {
  return (
    <ol className="cs-journal" data-reveal="stagger">
      {study.approach.steps.map((step, i) => (
        <li key={step.title}>
          <span className="cs-journal__n" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="cs-journal__when">{step.when}</span>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
          <Tags items={step.outputs} />
        </li>
      ))}
    </ol>
  );
}

function DesignDelivered({ study }) {
  const d = study.delivered;
  return (
    <div className="cs-board">
      <figure className="cs-board__palette" data-reveal="up">
        <figcaption>
          {run("gl_components|caseStudy-intro|figcaption", 0)}
        </figcaption>
        <ul>
          {d.palette.map((c) => (
            <li
              key={c.hex}
              className={isLight(c.hex) ? "is-light" : undefined}
              style={{ "--swatch": c.hex }}
            >
              <span>{c.name}</span>
              <code>{c.hex}</code>
            </li>
          ))}
        </ul>
      </figure>
      <figure className="cs-board__type" data-reveal="up">
        <figcaption>
          {run("gl_components|caseStudy-intro|figcaption-2", 0)}
        </figcaption>
        <span className="cs-board__specimen" aria-hidden="true">
          {run("gl_components|caseStudy-intro|figure", 0)}
        </span>
        <strong>{d.typeface}</strong>
        <ul>
          {d.weights.map((w) => (
            <li key={w} style={{ fontWeight: w }}>
              {w}
              {run("gl_components|caseStudy-intro|li", 0)}
            </li>
          ))}
        </ul>
      </figure>
      <figure className="cs-board__mark" data-reveal="up">
        <figcaption>
          {run("gl_components|caseStudy-intro|figcaption-3", 0)}
        </figcaption>
        <div className="cs-board__lockups">
          <span className="is-dark is-wide">
            <span className="cs-lockup">
              <img src="/assets/logo/orgtik-mark-white.svg" alt="" />
              <img
                src="/assets/logo/orgtik-wordmark-white.svg"
                alt={attr("gl_components|caseStudy-intro|img@alt")}
              />
            </span>
          </span>
          <span className="is-light">
            <img
              className="cs-lockup-stacked"
              src="/assets/logo/orgtik-lockup-color.svg"
              alt={attr("gl_components|caseStudy-intro|img@alt-2")}
            />
          </span>
          <span className="is-violet">
            <img
              className="cs-lockup-mark"
              src="/assets/logo/orgtik-mark-white.svg"
              alt={attr("gl_components|caseStudy-intro|img@alt-3")}
            />
          </span>
        </div>
      </figure>
      <div className="cs-board__touch" data-reveal="stagger">
        {d.touchpoints.map((t) => (
          <figure key={t.label}>
            <img
              src={"/assets/" + t.image}
              alt={t.label + " application"}
              loading="lazy"
            />
            <figcaption>{t.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function DesignResults({ study }) {
  const r = study.results;
  return (
    <>
      <ul className="cs-numerals" data-reveal="stagger">
        {r.metrics.map((m) => (
          <li key={m.label}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </li>
        ))}
      </ul>
      <div className="cs-shifts" data-reveal="up">
        <div className="cs-shifts__head" aria-hidden="true">
          <span>{run("gl_components|caseStudy-intro|div", 1)}</span>
          <span>{run("gl_components|caseStudy-intro|div", 3)}</span>
        </div>
        <ul>
          {r.shifts.map(([before, after]) => (
            <li key={before}>
              <span className="cs-shifts__before">
                <span className="cs-visually-hidden">
                  {run("gl_components|caseStudy-intro|li-2", 0)}
                </span>
                {before}
              </span>
              <i className="ph ph-arrow-right" aria-hidden="true" />
              <span className="cs-shifts__after">
                <span className="cs-visually-hidden">
                  {run("gl_components|caseStudy-intro|li-3", 0)}
                </span>
                {after}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ---------- Development: a sprint build log ---------- */

function DevApproach({ study }) {
  return (
    <ol className="cs-log">
      {study.approach.steps.map((step) => (
        <li key={step.title} data-reveal="up">
          <span className="cs-log__node" aria-hidden="true">
            <i className="ph ph-git-commit" />
          </span>
          <code className="cs-log__when">{step.when}</code>
          <div className="cs-log__body">
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <Tags items={step.outputs} />
            <code className="cs-log__line">
              <i className="ph ph-check" aria-hidden="true" /> {step.log}
            </code>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DevDelivered({ study }) {
  const d = study.delivered;
  return (
    <figure className="cs-arch" data-reveal="up">
      <figcaption className="cs-visually-hidden">
        {run("gl_components|caseStudy-intro|figcaption-4", 0)}
        {d.modules.map((m) => m.name).join(", ")}
        {run("gl_components|caseStudy-intro|figcaption-5", 0)}{" "}
        {d.core.toLowerCase()}
        {run("gl_components|caseStudy-intro|figcaption-6", 0)}
        {d.layers.join(", ")}.
      </figcaption>
      <ul className="cs-arch__modules" aria-hidden="true">
        {d.modules.map((m) => (
          <li key={m.name}>
            <i className={"ph " + m.icon} />
            <span>{m.name}</span>
          </li>
        ))}
      </ul>
      <div className="cs-arch__bus" aria-hidden="true" />
      <div className="cs-arch__core" aria-hidden="true">
        <code>{run("gl_components|caseStudy-intro|code", 0)}</code>
        <strong>{d.core}</strong>
        <ul>
          {d.layers.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <div className="cs-arch__stack">
        <code>{run("gl_components|caseStudy-intro|code-2", 0)}</code>
        <Tags items={d.stack} />
      </div>
    </figure>
  );
}

function DevResults({ study }) {
  const r = study.results;
  const C = 2 * Math.PI * 44;
  return (
    <>
      <figure className="cs-gauges">
        <figcaption>
          <code>
            {study.sample ? msg("CaseStudy:13") : msg("CaseStudy:14")}
          </code>
        </figcaption>
        <ul>
          {r.gauges.map((g) => (
            <li key={g.label} data-cs-animate="">
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label={msg("CaseStudy:15", [g.label, g.value])}
              >
                <circle className="cs-gauge__track" cx="50" cy="50" r="44" />
                <circle
                  className="cs-gauge__value"
                  cx="50"
                  cy="50"
                  r="44"
                  style={{
                    "--c": C,
                    strokeDasharray: C,
                    strokeDashoffset: C * (1 - g.value / 100),
                  }}
                />
                <text x="50" y="50">
                  {g.value}
                </text>
              </svg>
              <span>{g.label}</span>
            </li>
          ))}
        </ul>
      </figure>
      <ul className="cs-metrics" data-reveal="stagger">
        {r.metrics.map((m) => (
          <li key={m.label}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Marketing: a campaign performance report ---------- */

function MarketingApproach({ study }) {
  const a = study.approach;
  const weeks = Array.from({ length: a.weeks }, (_, i) => i + 1);
  return (
    <div className="cs-gantt" data-reveal="up" style={{ "--weeks": a.weeks }}>
      <div className="cs-gantt__scale" aria-hidden="true">
        <span />
        <div>
          {weeks.map((w) => (
            <span key={w}>
              {run("gl_components|caseStudy-intro|div-2", 0)}
              {w}
            </span>
          ))}
        </div>
      </div>
      <ol>
        {a.steps.map((step, i) => (
          <li key={step.title} data-cs-animate="">
            <div className="cs-gantt__label">
              <span className="cs-gantt__when">
                {run("gl_components|caseStudy-intro|div-3", 0)}
                {step.start}
                {step.end > step.start ? "–" + step.end : ""}
              </span>
              <h3>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>{" "}
                {step.title}
              </h3>
              <p>{step.detail}</p>
              <Tags items={step.outputs} />
            </div>
            <div className="cs-gantt__track" aria-hidden="true">
              <span
                className="cs-gantt__bar"
                style={{ gridColumn: step.start + " / " + (step.end + 1) }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MarketingDelivered({ study }) {
  return (
    <ol className="cs-week" data-reveal="stagger">
      {study.delivered.week.map((d) => (
        <li key={d.day}>
          <span className="cs-week__day">{d.day}</span>
          <strong>{d.task}</strong>
          <ul>
            {d.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

const fmt = (n) => n.toLocaleString("en-US");
const FUNNEL_TONES = ["#9458F4", "#8150D9", "#6C3CAA", "#562E8A", "#42226C"];

function MarketingResults({ study }) {
  const r = study.results;
  const max = Math.max(...r.monthly.points.map((p) => p[1]));
  const palette = ["#9458F4", "#C9A0F3", "#6C3CAA", "#EEE3F7"];
  return (
    <div className="cs-dash">
      <ul className="cs-kpis" data-reveal="stagger">
        {r.kpis.map((k) => (
          <li key={k.label}>
            <span className="cs-kpis__label">{k.label}</span>
            <strong>{k.after}</strong>
            <span className="cs-kpis__foot">
              <span className="cs-kpis__change">
                <i
                  className={
                    "ph ph-trend-" + (k.change.startsWith("−") ? "down" : "up")
                  }
                  aria-hidden="true"
                />{" "}
                {k.change}
              </span>
              <span>
                {run("gl_components|caseStudy-intro|li-4", 0)}
                {k.before}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <figure className="cs-panel cs-bars" data-reveal="up">
        <figcaption>
          <span>{r.monthly.label}</span>
          <span className="cs-legend" aria-hidden="true">
            <span className="is-base">
              {run("gl_components|caseStudy-intro|figcaption-7", 0)}
            </span>
            <span className="is-live">
              {run("gl_components|caseStudy-intro|figcaption-8", 0)}
            </span>
          </span>
        </figcaption>
        <ol data-cs-animate="">
          {r.monthly.points.map(([month, value], i) => (
            <li
              key={month}
              className={i < r.monthly.baseline ? "is-base" : "is-live"}
              aria-label={
                month +
                ": " +
                value +
                (i < r.monthly.baseline
                  ? msg("CaseStudy:16")
                  : msg("CaseStudy:17"))
              }
            >
              <span className="cs-bars__value">{value}</span>
              <span className="cs-bars__col" style={{ "--h": value / max }} />
              <span className="cs-bars__month">{month}</span>
            </li>
          ))}
        </ol>
      </figure>
      <figure className="cs-panel cs-funnel" data-reveal="up">
        <figcaption>
          <span>{run("gl_components|caseStudy-intro|figcaption-9", 1)}</span>
        </figcaption>
        <ol data-cs-animate="">
          {r.funnel.map(([label, value], i) => {
            const prev = r.funnel[i - 1];
            return (
              <li
                key={label}
                style={{ "--w": 1 - i * 0.16, "--tone": FUNNEL_TONES[i] }}
              >
                {prev && (
                  <span className="cs-funnel__rate">
                    {((value / prev[1]) * 100).toFixed(1)}
                    {run("gl_components|caseStudy-intro|li-5", 0)}{" "}
                    {prev[0].toLowerCase()}
                  </span>
                )}
                <span className="cs-funnel__bar">
                  <span>{label}</span>
                  <strong>{fmt(value)}</strong>
                </span>
              </li>
            );
          })}
        </ol>
      </figure>
      <figure className="cs-panel cs-mix" data-reveal="up">
        <figcaption>
          <span>{run("gl_components|caseStudy-intro|figcaption-10", 1)}</span>
        </figcaption>
        <div className="cs-mix__bar" data-cs-animate="" aria-hidden="true">
          {r.channels.map(([name, share], i) => (
            <span
              key={name}
              style={{ "--share": share, "--tone": palette[i] }}
            />
          ))}
        </div>
        <ul className="cs-mix__legend">
          {r.channels.map(([name, share], i) => (
            <li key={name} style={{ "--tone": palette[i] }}>
              <span>{name}</span>
              <strong>{share}%</strong>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}

/* ---------- IT support: a service desk log ---------- */

function SupportApproach({ study }) {
  return (
    <div className="cs-desk" data-reveal="up">
      <div className="cs-desk__bar" aria-hidden="true">
        <span>
          <i className="ph ph-ticket" />
          {run("gl_components|caseStudy-intro|div-4", 0)}
        </span>
        <span>
          {study.approach.steps.length}
          {run("gl_components|caseStudy-intro|div-5", 0)}
        </span>
      </div>
      <ol>
        {study.approach.steps.map((step) => (
          <li key={step.id}>
            <div className="cs-desk__id">
              <code>{step.id}</code>
              <span>{step.when}</span>
            </div>
            <div className="cs-desk__body">
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <Tags items={step.outputs} />
            </div>
            <span
              className={
                "cs-state" + (step.state === "Ongoing" ? " is-open" : "")
              }
            >
              {step.state}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SupportDelivered({ study }) {
  return (
    <ol className="cs-priorities" data-reveal="stagger">
      {study.delivered.priorities.map((p, i) => (
        <li key={p.level} style={{ "--level": 1 - i * 0.22 }}>
          <span className="cs-priorities__level">{p.level}</span>
          <strong>{p.name}</strong>
          <span className="cs-priorities__when">{p.when}</span>
          <span className="cs-priorities__target">
            <small>{run("gl_components|caseStudy-intro|li-6", 0)}</small>
            {p.target}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SupportResults({ study }) {
  return (
    <ul className="cs-compare" data-reveal="stagger">
      {study.results.comparisons.map((c) => {
        const drop = Math.round((1 - c.after / c.before) * 100);
        return (
          <li key={c.label} data-cs-animate="">
            <div className="cs-compare__head">
              <h3>{c.label}</h3>
              <span className="cs-compare__drop">−{drop}%</span>
            </div>
            <div className="cs-compare__row">
              <span>{run("gl_components|caseStudy-intro|div-6", 0)}</span>
              <span className="cs-compare__track">
                <span
                  className="cs-compare__fill is-before"
                  style={{ "--v": 1 }}
                />
              </span>
              <strong>
                {c.before}
                {c.unit}
              </strong>
            </div>
            <div className="cs-compare__row">
              <span>{run("gl_components|caseStudy-intro|div-7", 0)}</span>
              <span className="cs-compare__track">
                <span
                  className="cs-compare__fill is-after"
                  style={{ "--v": c.after / c.before }}
                />
              </span>
              <strong>
                {c.after}
                {c.unit}
              </strong>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Hosting: a migration runbook and status view ---------- */

function HostingApproach({ study }) {
  return (
    <ol className="cs-runbook" data-reveal="stagger">
      {study.approach.steps.map((step, i) => (
        <li key={step.title}>
          <span className="cs-runbook__check" aria-hidden="true">
            <i className="ph ph-check" />
          </span>
          <code className="cs-runbook__id">
            {run("gl_components|caseStudy-intro|code-3", 0)}
            {String(i + 1).padStart(2, "0")}
          </code>
          <div className="cs-runbook__body">
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
          </div>
          <div className="cs-runbook__meta">
            <span>{step.when}</span>
            <Tags items={step.outputs} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function HostingDelivered({ study }) {
  const items = study.delivered.components;
  return (
    <div className="cs-status" data-reveal="up">
      <div className="cs-status__head">
        <span className="cs-status__dot" aria-hidden="true" />
        <strong>{run("gl_components|caseStudy-intro|div-8", 2)}</strong>
        <span>{run("gl_components|caseStudy-intro|div-8", 4)}</span>
      </div>
      <ul>
        {items.map((c) => (
          <li key={c.name}>
            <div>
              <strong>{c.name}</strong>
              <span>{c.detail}</span>
            </div>
            <span className="cs-status__state">
              <span className="cs-status__dot" aria-hidden="true" />
              {c.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Measures the chart frame so SVG units stay 1:1 with CSS pixels.
function useFrameWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    update();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function HostingResults({ study }) {
  const r = study.results;
  const pts = r.chart.points;
  const [frameRef, W] = useFrameWidth(1000);
  const H = W < 640 ? 220 : 280,
    pad = { l: 40, r: 16, t: 28, b: 36 },
    top = Math.ceil(Math.max(...pts.map((p) => p[1])) + 0.5);
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (pts.length - 1);
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const path = (from, to) =>
    pts
      .slice(from, to)
      .map(
        (p, i) =>
          (i ? "L" : "M") + x(from + i).toFixed(1) + " " + y(p[1]).toFixed(1),
      )
      .join(" ");
  const k = r.chart.cutover;
  const after = path(k - 1, pts.length);
  const area =
    after +
    " L" +
    x(pts.length - 1) +
    " " +
    y(0) +
    " L" +
    x(k - 1) +
    " " +
    y(0) +
    " Z";
  const cut = (x(k - 1) + x(k)) / 2;
  return (
    <div className="cs-host">
      <figure className="cs-panel cs-line" data-reveal="up">
        <figcaption>
          <span>{r.chart.label}</span>
          <span className="cs-legend" aria-hidden="true">
            <span>{run("gl_components|caseStudy-intro|figcaption-11", 0)}</span>
            <span className="is-live">
              {run("gl_components|caseStudy-intro|figcaption-12", 0)}
            </span>
          </span>
        </figcaption>
        <div ref={frameRef}>
          <svg
            width={W}
            height={H}
            viewBox={"0 0 " + W + " " + H}
            role="img"
            aria-label={msg("CaseStudy:19", [
              r.chart.label,
              pts.map((p) => p[0] + " " + p[1] + "s").join(", "),
              k,
            ])}
            data-cs-animate=""
          >
            {Array.from({ length: top + 1 }, (_, v) => (
              <g key={v} className="cs-line__grid">
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
                <text x={pad.l - 10} y={y(v)}>
                  {v}
                  {run("gl_components|caseStudy-intro|text", 0)}
                </text>
              </g>
            ))}
            <line
              className="cs-line__cut"
              x1={cut}
              x2={cut}
              y1={pad.t - 12}
              y2={H - pad.b}
            />
            <text className="cs-line__cut-label" x={cut + 8} y={pad.t - 4}>
              {run("gl_components|caseStudy-intro|text-2", 0)}
            </text>
            <path className="cs-line__area" d={area} />
            <path
              className="cs-line__path is-before"
              d={path(0, k)}
              pathLength="1"
            />
            <path className="cs-line__path is-after" d={after} pathLength="1" />
            {pts.map((p, i) => (
              <g key={p[0]}>
                <circle
                  className={"cs-line__pt" + (i < k ? " is-before" : "")}
                  cx={x(i)}
                  cy={y(p[1])}
                  r="4.5"
                />
                <text className="cs-line__x" x={x(i)} y={H - 10}>
                  {p[0]}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </figure>
      <ul className="cs-metrics" data-reveal="stagger">
        {r.metrics.map((m) => (
          <li key={m.label}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DEPARTMENTS = {
  design: {
    Approach: DesignApproach,
    Delivered: DesignDelivered,
    Results: DesignResults,
  },
  development: {
    Approach: DevApproach,
    Delivered: DevDelivered,
    Results: DevResults,
  },
  "digital-marketing": {
    Approach: MarketingApproach,
    Delivered: MarketingDelivered,
    Results: MarketingResults,
  },
  "it-support": {
    Approach: SupportApproach,
    Delivered: SupportDelivered,
    Results: SupportResults,
  },
  hosting: {
    Approach: HostingApproach,
    Delivered: HostingDelivered,
    Results: HostingResults,
  },
};
