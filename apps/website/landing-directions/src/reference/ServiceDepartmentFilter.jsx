import React from "react";
import { SERVICE_FAMILIES, getServiceChoices } from "./service-catalog";
import "./service-builder.css";

export function ServiceDepartmentFilter({ department, selections, onChange }) {
  const choices = getServiceChoices(department);
  const visibleIds = new Set(choices.map((choice) => choice.id));
  const hiddenSelected = selections.filter((id) => !visibleIds.has(id)).length;
  const filters = [
    { slug: "all", short: "All", count: getServiceChoices().length },
    ...SERVICE_FAMILIES.map((family) => ({
      slug: family.slug,
      short: family.short,
      count: family.children.length,
    })),
  ];
  return (
    <div className="service-builder-filter">
      <div className="service-builder-filter__heading">
        <p>Filter by department</p>
        <p role="status">
          {choices.length} service{choices.length === 1 ? "" : "s"}
          {hiddenSelected > 0
            ? ` · ${hiddenSelected} selected in other departments`
            : ` · ${selections.length} selected`}
        </p>
      </div>
      <div
        className="service-builder-filter__options"
        role="group"
        aria-label="Filter services by department"
      >
        {filters.map((filter) => (
          <button
            type="button"
            key={filter.slug}
            aria-label={
              filter.slug === "all" ? "All departments" : filter.short
            }
            aria-pressed={department === filter.slug}
            aria-controls="service-builder-options"
            onClick={() => onChange(filter.slug)}
          >
            {filter.short} <span aria-hidden="true">{filter.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
