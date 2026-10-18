import React, { useId } from "react";
import "./plan-picker.css";

// Native radio group so arrow keys, labels and screen readers work by default.
export function PlanPicker({
  label,
  options,
  value,
  onChange,
  why = "",
  tone = "light",
  layout = "rows",
  hideLegend = false,
}) {
  const id = useId();
  return (
    <fieldset
      className={`plan-picker plan-picker--${tone} plan-picker--${layout}`}
      aria-describedby={why ? `${id}-why` : undefined}
    >
      <legend
        className={
          hideLegend
            ? "plan-picker__legend plan-sr-only"
            : "plan-picker__legend"
        }
      >
        {label}
      </legend>
      <div className="plan-picker__options">
        {options.map((option) => (
          <label className="plan-picker__option" key={option.planId}>
            <input
              type="radio"
              name={`${id}-plan`}
              value={option.planId}
              checked={value === option.planId}
              onChange={() => onChange(option.planId)}
            />
            <span className="plan-picker__card">
              <span className="plan-picker__name">
                {option.name}
                {option.recommended && (
                  <span className="plan-picker__badge">Recommended</span>
                )}
              </span>
              {option.subtitle && (
                <span className="plan-picker__subtitle">{option.subtitle}</span>
              )}
              <span className="plan-picker__price">
                {option.price}
                {option.note && <small>{option.note}</small>}
              </span>
            </span>
          </label>
        ))}
      </div>
      {why && (
        <p className="plan-picker__why" id={`${id}-why`}>
          <i className="ph ph-lightbulb" aria-hidden="true" />
          <span>{why}</span>
        </p>
      )}
    </fieldset>
  );
}
