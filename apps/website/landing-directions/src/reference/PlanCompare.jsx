import React, { useEffect, useId, useRef, useState } from "react";
import "./plan-picker.css";
import "./plan-compare.css";

function Cell({ value }) {
  if (value === true)
    return (
      <>
        <i className="ph ph-check plan-compare__yes" aria-hidden="true" />
        <span className="plan-sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <i className="ph ph-minus plan-compare__no" aria-hidden="true" />
        <span className="plan-sr-only">Not included</span>
      </>
    );
  return <span>{value}</span>;
}

const allSame = (values) => values.every((value) => value === values[0]);

// Explicit roles keep table semantics when the mobile layout restyles the rows.
export function PlanCompareTable({ caption, plans, groups, renderAction }) {
  const [differences, setDifferences] = useState(false);
  const expandable = groups.flatMap((group) =>
    group.rows.filter((row) => row.children?.length).map((row) => row.label),
  );
  // Small comparisons open every service's parts straight away; larger ones start closed.
  const [open, setOpen] = useState(() =>
    expandable.length <= 3 ? expandable : [],
  );
  const toggle = (label) =>
    setOpen((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  const visible = groups
    .map((group) => ({
      ...group,
      rows: differences
        ? group.rows.filter((row) => !allSame(row.values))
        : group.rows,
    }))
    .filter((group) => group.rows.length);
  return (
    <div className="plan-compare">
      <label className="plan-compare__switch">
        <input
          type="checkbox"
          role="switch"
          checked={differences}
          onChange={(event) => setDifferences(event.target.checked)}
        />
        <span className="plan-compare__track" aria-hidden="true" />
        Show differences only
      </label>
      <table className="plan-compare__table" role="table">
        <caption className="plan-sr-only">{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <td className="plan-compare__corner" role="cell" />
            {plans.map((plan) => (
              <th
                key={plan.planId}
                scope="col"
                role="columnheader"
                className={
                  plan.recommended
                    ? "plan-compare__head is-recommended"
                    : "plan-compare__head"
                }
              >
                <span className="plan-compare__plan">{plan.name}</span>
                {plan.recommended && (
                  <span className="plan-compare__badge">Recommended</span>
                )}
                {plan.current && (
                  <span className="plan-compare__badge plan-compare__badge--current">
                    In your cart
                  </span>
                )}
                <span className="plan-compare__subtitle">{plan.subtitle}</span>
                <span className="plan-compare__price">
                  {plan.price}
                  <small>{plan.unit}</small>
                </span>
                {renderAction && (
                  <span className="plan-compare__action">
                    {renderAction(plan)}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        {visible.map((group) => (
          <tbody role="rowgroup" key={group.title}>
            <tr role="row" className="plan-compare__group">
              <th
                scope="colgroup"
                colSpan={plans.length + 1}
                role="columnheader"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => {
              const isOpen = open.includes(row.label);
              const children = (row.children || []).filter(
                (child) => !differences || !allSame(child.values),
              );
              return (
                <React.Fragment key={row.label}>
                  <tr
                    role="row"
                    className={
                      row.children ? "plan-compare__service" : undefined
                    }
                  >
                    <th scope="row" role="rowheader">
                      {row.children ? (
                        // The service name is the disclosure, so the toggle sits where the eye already is.
                        <button
                          type="button"
                          className="plan-compare__parts"
                          aria-expanded={isOpen}
                          onClick={() => toggle(row.label)}
                        >
                          <i className="ph ph-caret-right" aria-hidden="true" />
                          <span>{row.label}</span>
                        </button>
                      ) : (
                        <>
                          {row.label}
                          {row.detail && <small>{row.detail}</small>}
                        </>
                      )}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        role="cell"
                        key={plans[index].planId}
                        data-plan={plans[index].name}
                      >
                        <Cell value={value} />
                      </td>
                    ))}
                  </tr>
                  {isOpen &&
                    children.map((child) => (
                      <tr
                        role="row"
                        key={`${row.label}:${child.label}`}
                        className="plan-compare__part"
                      >
                        <th scope="row" role="rowheader">
                          {child.label}
                        </th>
                        {child.values.map((value, index) => (
                          <td
                            role="cell"
                            key={plans[index].planId}
                            data-plan={plans[index].name}
                          >
                            <Cell value={value} />
                          </td>
                        ))}
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        ))}
      </table>
      {!visible.length && (
        <p className="plan-compare__empty">
          These plans include the same items. Turn off “Show differences only”
          to see everything.
        </p>
      )}
      {renderAction && (
        <div className="plan-compare__footer" aria-label="Choose a plan">
          {plans.map((plan) => (
            <div key={plan.planId}>
              <p>
                <strong>{plan.name}</strong> {plan.price}{" "}
                <small>{plan.unit}</small>
              </p>
              {renderAction(plan)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Native modal dialog: Escape and the backdrop close it; focus returns to the trigger.
export function PlanCompareDialog({
  open,
  onClose,
  title,
  description,
  children,
}) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return undefined;
    const returnFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if (dialog.open) dialog.close();
      returnFocus?.focus?.();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="plan-compare-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="plan-compare-dialog__panel">
          <header className="plan-compare-dialog__header">
            <div>
              <h2 id={`${id}-title`}>{title}</h2>
              {description && <p id={`${id}-description`}>{description}</p>}
            </div>
            <button
              type="button"
              className="plan-compare-dialog__close"
              onClick={onClose}
              aria-label="Close plan comparison"
            >
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </header>
          <div className="plan-compare-dialog__body">{children}</div>
          <p className="plan-compare-dialog__note">
            Prototype estimates. Nothing is charged, and you can change your
            plan before you sign.
          </p>
        </div>
      )}
    </dialog>
  );
}
