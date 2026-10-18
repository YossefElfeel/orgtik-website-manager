import React from "react";
import "./plan-picker.css";

// Only promises OrgTik has confirmed (2026-10-01). Do not add new claims without approval.
export const PLAN_PROMISES = [
  ["ph-chat-circle-text", "Reply within 1 business day"],
  ["ph-phone-call", "Free scoping call"],
  ["ph-arrows-clockwise", "Change anything before you sign"],
  ["ph-credit-card", "Nothing is charged"],
];

export function PromiseList({ className = "" }) {
  return (
    <ul
      className={`plan-promises${className ? ` ${className}` : ""}`}
      aria-label="What you can count on"
    >
      {PLAN_PROMISES.map(([icon, text]) => (
        <li key={text}>
          <i className={`ph ${icon}`} aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
