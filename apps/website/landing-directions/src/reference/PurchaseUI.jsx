import React, { useState, useEffect, useRef, useId } from "react";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";
import { PurchasePriceStatus, taxCaption } from "./PurchasePricing";
import {
  CATALOG,
  BUNDLES,
  MONTHS,
  HOSTING_URL,
  findItem,
  findBundle,
  createGroup,
  groupFromIds,
  groupFromLocation,
  groupName,
  groupTerm,
  quoteGroup,
  quoteCart,
  money,
  termLabel,
  configurationHref,
  getPricingSnapshot,
} from "./purchase-catalog.js";
import {
  AddPackageButton,
  DurationPicker,
  PurchaseAction,
  PurchaseDialog,
} from "./PurchaseControls";

export function PreviewNote({ source }) {
  return (
    <p className="purchase-note">
      <i className="ph ph-info" aria-hidden="true" />
      {msg("PlatformPricing:17", [
        source?.currency || getPricingSnapshot().currency || "—",
      ])}
    </p>
  );
}
export function PurchaseHeading({ eyebrow, title, accent, children }) {
  return (
    <div className="purchase-heading">
      <div>
        <span className="purchase-eyebrow">{eyebrow}</span>
        <h2>
          {title}
          {accent && <span>{accent}</span>}
        </h2>
      </div>
      {children && <p>{children}</p>}
    </div>
  );
}
export function OrderContents({ groups, pricedQuote }) {
  return (
    <div className="purchase-order-contents">
      {groups.map((group) => (
        <div key={group.id} className="purchase-order-group">
          <strong>{groupName(group)}</strong>
          <ul>
            {(
              pricedQuote?.groups.find((item) => item.id === group.id)?.lines ??
              quoteGroup(group).lines
            ).map((line) => (
              <li key={line.catalogId}>
                <span>
                  {line.name}
                  <small>
                    {termLabel(line.months)} ·{" "}
                    {line.autoRenew ? msg("PurchaseUI:1") : msg("PurchaseUI:2")}
                  </small>
                  {line.perUser && Number.isFinite(line.quantity) && (
                    <small>{msg("PlatformPricing:18", [line.quantity])}</small>
                  )}
                </span>
                <b>{money(line.total, pricedQuote)}</b>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
export function MobilePurchaseBar({
  groups,
  scopeRef,
  children,
  note = msg("PurchaseUI:3"),
}) {
  const [visible, setVisible] = useState(!scopeRef);
  useEffect(() => {
    if (!scopeRef?.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(scopeRef.current);
    return () => observer.disconnect();
  }, [scopeRef]);
  return visible ? (
    <aside
      className="purchase-mobile-bar"
      aria-label={attr("gl_commerce|purchaseUI-intro|aside@aria-label")}
    >
      <div>
        <small>{note}</small>
        <strong>{money(quoteCart(groups).total)}</strong>
      </div>
      {children}
    </aside>
  ) : null;
}
export function QuoteSummary({
  groups,
  title = msg("PurchaseUI:4"),
  id,
  children,
  pricedQuote,
}) {
  const quote = pricedQuote?.quote ?? quoteCart(groups);
  const formatted = (value) => money(value, pricedQuote);
  const summary = useRef(null);
  useEffect(() => {
    const element = summary.current;
    const measure = () =>
      element.style.setProperty(
        "--purchase-summary-height",
        `${element.offsetHeight}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <aside className="purchase-summary" id={id} ref={summary}>
      <span className="purchase-eyebrow">{title}</span>
      <div className="purchase-summary__amount">
        <small>{run("gl_commerce|purchaseUI-intro|div", 0)}</small>
        <strong>{formatted(quote.total)}</strong>
        <span>{run("gl_commerce|purchaseUI-intro|div-2", 0)}</span>
      </div>
      <p className="purchase-sr-only" role="status" aria-live="polite">
        {run("gl_commerce|purchaseUI-intro|p-2", 0)}
        {formatted(quote.total)}
        {run("gl_commerce|purchaseUI-intro|p-3", 0)}
        {formatted(quote.saving)}.
      </p>
      <dl>
        <div>
          <dt>{run("gl_commerce|purchaseUI-intro|dt", 0)}</dt>
          <dd>{formatted(quote.subtotal)}</dd>
        </div>
        <div>
          <dt>{run("gl_commerce|purchaseUI-intro|dt-2", 0)}</dt>
          <dd>−{formatted(quote.saving)}</dd>
        </div>
        <div>
          <dt>
            {pricedQuote
              ? taxCaption(pricedQuote)
              : run("gl_commerce|purchaseUI-intro|dt-3", 0)}
          </dt>
          <dd>
            {pricedQuote
              ? formatted(quote.tax)
              : taxCaption(getPricingSnapshot())}
          </dd>
        </div>
      </dl>
      <p className="purchase-summary__equivalent">
        {formatted(
          Number.isFinite(quote.monthlyEquivalent)
            ? Math.round(quote.monthlyEquivalent)
            : null,
        )}
        {run("gl_commerce|purchaseUI-intro|p-4", 0)}
        {groups.some((g) => groupTerm(g) === "Mixed durations") &&
          " Items have different periods."}
      </p>
      {children}
      <PurchasePriceStatus source={pricedQuote} />
      <p className="purchase-summary__foot">
        {run("gl_commerce|purchaseUI-intro|p-5", 0)}
      </p>
      <a href="/plans">
        {run("gl_commerce|purchaseUI-intro|a", 0)}
        {run("gl_commerce|purchaseUI-intro|a", 1)}
        <i className="ph ph-arrow-up-right" aria-hidden="true" />
      </a>
    </aside>
  );
}
export function PackageLines({
  group,
  onChange,
  onRemove,
  renewal = true,
  compact = false,
}) {
  const quoted = quoteGroup(group);
  return (
    <div className="purchase-lines">
      {group.lines.some((line) => !line.months) && (
        <p className="purchase-alert">
          {run("gl_commerce|purchaseUI-intro|p-6", 0)}
        </p>
      )}
      {quoted.lines.map((line) => {
        const item = findItem(line.catalogId, group.kind);
        return (
          <article
            className={`purchase-line ${compact ? "purchase-line--compact" : ""}`}
            key={line.catalogId}
          >
            <div className="purchase-line__heading">
              <div>
                <span className="purchase-eyebrow">{item.departmentName}</span>
                <h3>{item.name}</h3>
              </div>
              <strong>
                {line.months ? money(line.total) : msg("PurchaseUI:5")}
                <small>{run("gl_commerce|purchaseUI-intro|div-3", 0)}</small>
              </strong>
            </div>
            {line.perUser && Number.isFinite(line.quantity) && (
              <p className="purchase-caption">
                {msg("PlatformPricing:18", [line.quantity])}
              </p>
            )}
            <details
              className="purchase-capabilities"
              open={compact ? undefined : true}
            >
              <summary>
                {run("gl_commerce|purchaseUI-intro|summary", 0)}
                <span>{item.capabilities.length}</span>
              </summary>
              <ul className="purchase-feature-list">
                {item.capabilities.map((c) => (
                  <li key={c}>
                    <i className="ph ph-check" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </details>
            {item.id === "marketing/digital-advertising-switzerland" && (
              <p className="purchase-caption">
                {run("gl_commerce|purchaseUI-intro|p-7", 0)}
              </p>
            )}
            {onChange ? (
              <DurationPicker
                label={msg("PurchaseUI:6", [item.name])}
                displayLabel={msg("PurchaseUI:7")}
                months={line.months}
                onChange={(months) => onChange(line.catalogId, { months })}
              />
            ) : (
              <p>
                {termLabel(line.months)} ·{" "}
                {line.autoRenew ? msg("PurchaseUI:8") : msg("PurchaseUI:9")}
              </p>
            )}
            <div className="purchase-line__foot">
              <span>
                {line.discount > 0
                  ? msg("PurchaseUI:10", [
                      line.discount,
                      line.reason,
                      money(line.saving),
                    ])
                  : msg("PurchaseUI:11")}
                {line.months && (
                  <>
                    {" "}
                    · {money(Math.round(line.monthlyEquivalent))}
                    {run("gl_commerce|purchaseUI-intro|div-4", 0)}
                  </>
                )}
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(line.catalogId)}
                  aria-label={msg("PurchaseUI:12", [item.name])}
                >
                  {run("gl_commerce|purchaseUI-intro|button", 0)}
                </button>
              )}
            </div>
            {renewal && onChange && (
              <label className="purchase-check">
                <input
                  type="checkbox"
                  aria-label={msg("PurchaseUI:13", [item.name])}
                  checked={line.autoRenew}
                  onChange={(e) =>
                    onChange(line.catalogId, { autoRenew: e.target.checked })
                  }
                />
                <span>
                  {run("gl_commerce|purchaseUI-intro|label", 0)}
                  {line.months ? (
                    <small>
                      {run("gl_commerce|purchaseUI-intro|label-2", 0)}
                      {termLabel(line.months)}
                      {run("gl_commerce|purchaseUI-intro|label-3", 0)}
                      {money(line.total)}
                    </small>
                  ) : (
                    ""
                  )}
                </span>
              </label>
            )}
          </article>
        );
      })}
    </div>
  );
}
export function ConfigurationEditor({
  group,
  onChange,
  showLines = true,
  onClear,
}) {
  const [department, setDepartment] = useState("all");
  const [pendingMonths, setPendingMonths] = useState(null);
  const [sharedDuration, setSharedDuration] = useState(true);
  const durationId = useId();
  useEffect(() => {
    setDepartment("all");
    setPendingMonths(null);
    setSharedDuration(true);
  }, [group.id]);
  const options = CATALOG.filter((i) => i.kind === group.kind);
  const departments = [
    ...new Map(options.map((i) => [i.department, i.departmentName])).entries(),
  ];
  const visible = options.filter(
    (i) => department === "all" || i.department === department,
  );
  const hidden = group.lines.filter(
    (l) => !visible.some((i) => i.id === l.catalogId),
  ).length;
  const applyDuration = (months) => {
    onChange({
      ...group,
      defaultMonths: months,
      lines: group.lines.map((l) => ({ ...l, months })),
    });
    setPendingMonths(null);
  };
  const toggle = (id) =>
    onChange({
      ...group,
      lines: group.lines.some((l) => l.catalogId === id)
        ? group.lines.filter((l) => l.catalogId !== id)
        : [
            ...group.lines,
            { catalogId: id, months: group.defaultMonths, autoRenew: false },
          ],
    });
  const individualLines = (
    <PackageLines
      group={group}
      compact
      onChange={(id, patch) =>
        onChange({
          ...group,
          lines: group.lines.map((line) =>
            line.catalogId === id ? { ...line, ...patch } : line,
          ),
        })
      }
      onRemove={toggle}
    />
  );
  return (
    <div className="purchase-editor">
      <div className="purchase-editor__step">
        <span className="purchase-step">01</span>
        <div className="purchase-editor__selection-copy">
          <div className="purchase-editor__selection-title">
            <h3>
              {run("gl_commerce|purchaseUI-intro|h3", 0)}
              {group.kind === "software" ? "products" : "services"}
            </h3>
            <button
              type="button"
              className="purchase-editor__clear"
              onClick={() =>
                onClear ? onClear() : onChange({ ...group, lines: [] })
              }
            >
              {run("gl_commerce|purchaseUI-intro|button-2", 0)}
            </button>
          </div>
          <p>{run("gl_commerce|purchaseUI-intro|p-8", 0)}</p>
        </div>
      </div>
      <div
        className="purchase-filters"
        role="group"
        aria-label={attr("gl_commerce|purchaseUI-intro|div@aria-label")}
      >
        <button
          type="button"
          aria-pressed={department === "all"}
          onClick={() => setDepartment("all")}
        >
          {run("gl_commerce|purchaseUI-intro|button-3", 0)}
        </button>
        {departments.map(([id, name]) => (
          <button
            type="button"
            key={id}
            aria-pressed={department === id}
            onClick={() => setDepartment(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="purchase-caption" role="status">
        {group.lines.length}
        {run("gl_commerce|purchaseUI-intro|p-9", 0)}
        {hidden > 0 ? msg("PurchaseUI:14", [hidden]) : ""}
      </p>
      <div className="purchase-options">
        {visible.map((item) => {
          const selected = group.lines.some((l) => l.catalogId === item.id);
          return (
            <label
              className={`purchase-option ${selected ? "is-selected" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(item.id)}
              />
              <span>
                <span className="purchase-eyebrow">{item.departmentName}</span>
                <strong>{item.name}</strong>
                <span>{item.capabilities.join(" · ")}</span>
                <b>
                  {money(item.monthlyMinor)}
                  <small>
                    {run("gl_commerce|purchaseUI-intro|label-4", 0)}
                  </small>
                </b>
              </span>
            </label>
          );
        })}
      </div>
      <div className="purchase-editor__step">
        <span className="purchase-step">02</span>
        <div className="purchase-editor__duration-copy">
          <div className="purchase-editor__duration-title">
            <h3>{run("gl_commerce|purchaseUI-intro|h3-2", 0)}</h3>
            <label className="purchase-duration-switch">
              <input
                type="checkbox"
                role="switch"
                aria-label={attr(
                  "gl_commerce|purchaseUI-intro|input@aria-label",
                )}
                aria-controls={`${durationId}-controls`}
                aria-describedby={`${durationId}-note`}
                checked={sharedDuration}
                onChange={(event) => setSharedDuration(event.target.checked)}
              />
              <span aria-hidden="true" />
            </label>
          </div>
          <p id={`${durationId}-note`}>
            {sharedDuration
              ? "Apply one period to all items. Turn off shared duration to set each item individually."
              : "Shared duration is off. Choose a duration for each item below; other items keep their selected durations."}
          </p>
        </div>
      </div>
      <div id={`${durationId}-controls`}>
        {sharedDuration && (
          <DurationPicker
            label={msg("PurchaseUI:15")}
            months={group.defaultMonths}
            showSavings
            onChange={(months) =>
              group.lines.some((line) => line.months !== group.defaultMonths)
                ? setPendingMonths(months)
                : applyDuration(months)
            }
          />
        )}
        {showLines &&
          !sharedDuration &&
          group.lines.length > 0 &&
          individualLines}
      </div>
      <PurchaseDialog
        open={pendingMonths !== null}
        title={attr("gl_commerce|purchaseUI-intro|PurchaseDialog@title")}
        onClose={() => setPendingMonths(null)}
      >
        <p>
          {run("gl_commerce|purchaseUI-intro|p-10", 0)}{" "}
          {termLabel(pendingMonths)}
          {run("gl_commerce|purchaseUI-intro|p-11", 0)}
        </p>
        <div className="purchase-dialog__actions">
          <PurchaseAction onClick={() => applyDuration(pendingMonths)}>
            {run("gl_commerce|purchaseUI-intro|PurchaseAction", 0)}
          </PurchaseAction>
          <PurchaseAction secondary onClick={() => setPendingMonths(null)}>
            {run("gl_commerce|purchaseUI-intro|PurchaseAction-2", 0)}
          </PurchaseAction>
        </div>
      </PurchaseDialog>
    </div>
  );
}
export function BundleCard({ bundle, onCustomize }) {
  const [months, setMonths] = useState(1);
  const group = groupFromIds(bundle.kind, bundle.ids, months, bundle.id);
  const quote = quoteGroup(group);
  return (
    <article
      className={`purchase-bundle ${bundle.recommended ? "purchase-bundle--recommended" : ""}`}
    >
      <div className="purchase-bundle__top">
        <span className="purchase-eyebrow">
          {bundle.kind === "software"
            ? msg("PurchaseUI:16")
            : bundle.department.replace("-", " ")}
        </span>
        {bundle.recommended && (
          <span className="purchase-badge">
            {run("gl_commerce|purchaseUI-intro|div-5", 0)}
          </span>
        )}
      </div>
      <h3>{bundle.name}</h3>
      <p>{bundle.why}</p>
      <ul className="purchase-feature-list">
        {bundle.ids.map((id) => (
          <li key={id}>
            <i className="ph ph-check" aria-hidden="true" />
            {findItem(id, bundle.kind).name}
          </li>
        ))}
      </ul>
      <div className="purchase-bundle__pricing">
        <small>
          {termLabel(months)}
          {run("gl_commerce|purchaseUI-intro|div-6", 0)}
        </small>
        <strong>{money(quote.total)}</strong>
        <span>
          {money(Math.round(quote.monthlyEquivalent))}
          {run("gl_commerce|purchaseUI-intro|div-7", 0)}
        </span>
        <span className="purchase-saving">
          {run("gl_commerce|purchaseUI-intro|div-8", 0)}
          {money(quote.saving)}
        </span>
      </div>
      <DurationPicker
        label={msg("PurchaseUI:17", [bundle.name])}
        displayLabel={msg("PurchaseUI:18")}
        months={months}
        onChange={setMonths}
      />
      <div className="purchase-bundle__actions">
        <AddPackageButton item={group} />
        {onCustomize ? (
          <button
            type="button"
            onClick={() => onCustomize(group)}
            className="purchase-text-button"
            aria-label={msg("PurchaseUI:19", [bundle.name])}
          >
            {run("gl_commerce|purchaseUI-intro|button-4", 0)}
            <i className="ph ph-arrow-right" aria-hidden="true" />
          </button>
        ) : (
          <a
            href={configurationHref(group)}
            className="purchase-text-button"
            aria-label={msg("PurchaseUI:20", [bundle.name])}
          >
            {run("gl_commerce|purchaseUI-intro|a-2", 0)}
            <i className="ph ph-arrow-right" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
export function BundleCollection({ kind, department = "all", onCustomize }) {
  const bundles = BUNDLES.filter(
    (b) =>
      b.kind === kind && (department === "all" || b.department === department),
  );
  return (
    <div className="purchase-bundles">
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} onCustomize={onCustomize} />
      ))}
    </div>
  );
}
export function PurchasingOverview({ kind, initialIds, initialDuration }) {
  const [group, setGroup] = useState(() => {
    let g = groupFromLocation(kind, window.location);
    if (initialIds?.length) {
      g = groupFromIds(
        kind,
        initialIds,
        initialDuration === "annual"
          ? 12
          : initialDuration === "monthly"
            ? 1
            : 1,
      );
      if (initialDuration === "biennial")
        g.lines.forEach((l) => {
          l.months = null;
        });
    }
    return g;
  });
  const [department, setDepartment] = useState("all");
  const builder = useRef(null);
  useEffect(() => {
    const restore = () => setGroup(groupFromLocation(kind, window.location));
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [kind]);
  const update = (next) => {
    setGroup(createGroup(next));
    const url = new URL(configurationHref(next), location.origin);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  };
  const configure = (next) => {
    update(next);
    requestAnimationFrame(() => {
      builder.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      builder.current?.querySelector("input")?.focus({ preventScroll: true });
    });
  };
  const departments = [
    ...new Map(
      CATALOG.filter((i) => i.kind === kind).map((i) => [
        i.department,
        i.departmentName,
      ]),
    ).entries(),
  ];
  return (
    <div className="purchase-surface">
      <section className="purchase-section" id={`${kind}-bundles`}>
        <div className="purchase-container">
          <PurchaseHeading
            eyebrow={msg("PurchaseUI:21")}
            title={attr("gl_commerce|purchaseUI-hero|PurchaseHeading@title")}
          >
            {run("gl_commerce|purchaseUI-hero|PurchaseHeading", 0)}
          </PurchaseHeading>
          <div className="purchase-entry-links">
            <span>{run("gl_commerce|purchaseUI-hero|div", 0)}</span>
            <PurchaseAction secondary onClick={() => configure(group)}>
              {run("gl_commerce|purchaseUI-hero|PurchaseAction", 0)}
            </PurchaseAction>
          </div>
          <div
            className="purchase-filters"
            role="group"
            aria-label={attr("gl_commerce|purchaseUI-hero|div@aria-label")}
          >
            <button
              type="button"
              aria-pressed={department === "all"}
              onClick={() => setDepartment("all")}
            >
              {run("gl_commerce|purchaseUI-hero|button", 0)}
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
          <BundleCollection
            kind={kind}
            department={department}
            onCustomize={configure}
          />
          <PreviewNote />
        </div>
      </section>
      <section
        ref={builder}
        className="purchase-section purchase-section--tint purchase-with-mobile-bar purchase-builder"
        id={kind === "software" ? "plan-builder" : "svc-builder"}
      >
        <div className="purchase-container">
          <PurchaseHeading
            eyebrow={msg("PurchaseUI:22")}
            title={
              kind === "software" ? msg("PurchaseUI:23") : msg("PurchaseUI:24")
            }
          >
            {run("gl_commerce|purchaseUI-section-1|PurchaseHeading", 0)}
          </PurchaseHeading>
          <div className="purchase-toolbar">
            <span>
              {group.lines.length ? groupName(group) : msg("PurchaseUI:25")}
            </span>
          </div>
          <div className="purchase-layout">
            <ConfigurationEditor
              group={group}
              onChange={update}
              onClear={() => update(groupFromIds(kind, []))}
            />
            <QuoteSummary groups={[group]}>
              <p>
                {group.lines.length}{" "}
                {kind === "software" ? "products" : "services"} ·{" "}
                {groupTerm(group)}
              </p>
              <AddPackageButton
                item={group}
                disabled={!quoteGroup(group).valid}
              />
              <details className="purchase-summary-selection" open>
                <summary>
                  {run("gl_commerce|purchaseUI-section-1|summary", 0)}
                </summary>
                {group.lines.length ? (
                  <OrderContents groups={[group]} />
                ) : (
                  <p>{run("gl_commerce|purchaseUI-section-1|p", 0)}</p>
                )}
              </details>
            </QuoteSummary>
          </div>
          <PreviewNote />
        </div>
        <MobilePurchaseBar groups={[group]} scopeRef={builder}>
          <AddPackageButton
            item={group}
            removable={false}
            disabled={!quoteGroup(group).valid}
          />
        </MobilePurchaseBar>
      </section>
    </div>
  );
}
export function PackageSection({ kind, id, department }) {
  const legacyId = new URLSearchParams(location.search).get("plan-service");
  const legacyEntry =
    findItem(legacyId, kind) || findItem(`${department}/${legacyId}`, kind);
  const entry =
    findItem(id, kind) ||
    (legacyEntry?.department === department ? legacyEntry : null);
  const [group, setGroup] = useState(() => {
    if (!entry) return groupFromIds(kind, []);
    const url = new URL(window.location.href);
    url.searchParams.set(
      kind === "software" ? "modules" : "services",
      entry.id,
    );
    url.searchParams.delete("bundle");
    return groupFromLocation(kind, url);
  });
  if (department === "hosting")
    return (
      <section className="purchase-section purchase-surface" id="plans-section">
        <div className="purchase-container">
          <PurchaseHeading
            eyebrow={msg("PurchaseUI:26")}
            title={attr(
              "gl_commerce|purchaseUI-plans-section|PurchaseHeading@title",
            )}
          >
            {run("gl_commerce|purchaseUI-plans-section|PurchaseHeading", 0)}
          </PurchaseHeading>
          <PurchaseAction href={HOSTING_URL}>
            {run("gl_commerce|purchaseUI-plans-section|PurchaseAction", 0)}
          </PurchaseAction>
        </div>
      </section>
    );
  if (!entry)
    return (
      <section className="purchase-section purchase-surface" id="plans-section">
        <div className="purchase-container">
          <PurchaseHeading
            eyebrow={msg("PurchaseUI:27")}
            title={attr(
              "gl_commerce|purchaseUI-plans-section|PurchaseHeading@title-2",
            )}
            accent={msg("PurchaseUI:28")}
          >
            {run("gl_commerce|purchaseUI-plans-section|PurchaseHeading-2", 0)}
          </PurchaseHeading>
          <BundleCollection kind={kind} department={department} />
          <PurchaseAction
            href={`/${kind === "service" ? "services" : "software"}#${kind === "service" ? "svc-builder" : "plan-builder"}`}
            secondary
          >
            {run("gl_commerce|purchaseUI-plans-section|PurchaseAction-2", 0)}
          </PurchaseAction>
          <PreviewNote />
        </div>
      </section>
    );
  const update = (catalogId, patch) => {
    const next = {
      ...group,
      defaultMonths: patch.months || group.defaultMonths,
      lines: group.lines.map((l) => ({ ...l, ...patch })),
    };
    setGroup(next);
    const url = new URL(location.href);
    url.searchParams.set("duration", next.lines[0].months);
    url.searchParams.delete("terms");
    if (next.lines[0].autoRenew) url.searchParams.set("renew", entry.id);
    else url.searchParams.delete("renew");
    url.searchParams.delete("plan");
    history.replaceState(
      history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  };
  return (
    <section className="purchase-section purchase-surface" id="plans-section">
      <div className="purchase-container">
        <PurchaseHeading
          eyebrow={msg("PurchaseUI:29")}
          title={entry.name + "."}
          accent={msg("PurchaseUI:30")}
        >
          {run("gl_commerce|purchaseUI-plans-section|PurchaseHeading-3", 0)}
        </PurchaseHeading>
        <div className="purchase-layout">
          <PackageLines group={group} onChange={update} />
          <QuoteSummary groups={[group]}>
            <p>
              {termLabel(group.lines[0]?.months)} ·{" "}
              {kind === "service" ? msg("PurchaseUI:31") : msg("PurchaseUI:32")}
            </p>
            <AddPackageButton
              item={group}
              disabled={!quoteGroup(group).valid}
            />
            <a href={configurationHref(group)}>
              {run("gl_commerce|purchaseUI-plans-section|a", 0)}
              {kind === "service" ? "services" : "products"}
            </a>
          </QuoteSummary>
        </div>
        <PreviewNote />
      </div>
    </section>
  );
}
