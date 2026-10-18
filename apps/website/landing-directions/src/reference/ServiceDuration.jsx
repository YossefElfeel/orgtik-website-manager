import React, { useId } from "react";
import { SERVICE_DURATIONS, getServiceDuration } from "./service-duration";
import "./service-duration.css";

export function ServiceDuration({
  months,
  onChange,
  groupLabel,
  label = "Monthly commitment",
  hint = "Applies to the Ongoing plan. Projects follow the timeline agreed in your brief.",
  headingLevel = 3,
  variant = "",
  // Software billing terms reuse the same radios with their own values.
  options = SERVICE_DURATIONS.map((value) => ({
    value,
    label: getServiceDuration(value).label,
  })),
}) {
  const id = useId();
  const Heading = `h${headingLevel}`;
  return (
    <div
      className={`service-duration${variant ? ` service-duration--${variant}` : ""}`}
      data-reveal={variant ? undefined : "up"}
    >
      <div>
        <Heading className="service-duration__heading" id={`${id}-label`}>
          {label}
        </Heading>
        <p id={`${id}-hint`}>{hint}</p>
      </div>
      <fieldset
        aria-label={groupLabel}
        aria-labelledby={groupLabel ? undefined : `${id}-label`}
        aria-describedby={`${id}-hint`}
      >
        <legend className="service-duration__legend">{label}</legend>
        <div
          className="service-duration__options"
          data-count={options.length}
          style={{ "--duration-count": options.length }}
        >
          {options.map((option) => (
            <label key={option.value} className="service-duration__option">
              <input
                type="radio"
                name={`${id}-duration`}
                value={option.value}
                checked={months === option.value}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
