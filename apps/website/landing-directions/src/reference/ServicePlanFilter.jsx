import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./service-plan-filter.css";

export function ServicePlanFilter({ family, value, onChange }) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const optionRefs = useRef([]);
  const searchRef = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 360 });
  const options = [
    {
      value: "all",
      label: `${family.short} department overview`,
      detail: "All services in this department",
    },
    ...family.children.map((service) => ({
      value: service.slug,
      label: service.name,
      detail: service.capabilities.slice(0, 2).join(" · "),
    })),
  ];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  function openList(index = selectedIndex) {
    searchRef.current = { text: "", time: 0 };
    setActiveIndex(index);
    setOpen(true);
  }

  function selectOption(index) {
    setOpen(false);
    if (options[index].value !== value) onChange(options[index].value);
  }

  useLayoutEffect(() => {
    setOpen(false);
  }, [family.slug, value]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const positionPanel = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 96;
      const needed = Math.min(panelRef.current.scrollHeight, 360);
      const showAbove = below < needed && above > below;
      setPlacement({
        above: showAbove,
        height: Math.max(80, Math.min(360, showAbove ? above : below)),
      });
    };
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const option = optionRefs.current[activeIndex];
    if (!option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < panel.scrollTop) panel.scrollTop = top;
    else if (bottom > panel.scrollTop + panel.clientHeight)
      panel.scrollTop = bottom - panel.clientHeight;
  }, [open, activeIndex, placement.height]);

  function handleKeyDown(event) {
    if (event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (open && event.altKey && event.key === "ArrowUp") {
          selectOption(activeIndex);
        } else if (!open) openList();
        else
          setActiveIndex((index) =>
            Math.max(
              0,
              Math.min(
                options.length - 1,
                index + (event.key === "ArrowDown" ? 1 : -1),
              ),
            ),
          );
        break;
      }
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        event.preventDefault();
        openList(
          event.key === "Home" || event.key === "PageUp"
            ? 0
            : options.length - 1,
        );
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) selectOption(activeIndex);
        else openList();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        if (open) selectOption(activeIndex);
        break;
      default: {
        if (event.altKey || event.key.length !== 1) return;
        event.preventDefault();
        const now = Date.now();
        const previous = searchRef.current;
        const text =
          (now - previous.time < 700 ? previous.text : "") +
          event.key.toLowerCase();
        searchRef.current = { text, time: now };
        const query = [...text].every((character) => character === text[0])
          ? text[0]
          : text;
        const start = open ? activeIndex : selectedIndex;
        const match = options.findIndex((_, offset) =>
          options[(start + offset + 1) % options.length].label
            .toLowerCase()
            .startsWith(query),
        );
        if (match !== -1) setActiveIndex((start + match + 1) % options.length);
        else if (!open) setActiveIndex(selectedIndex);
        setOpen(true);
      }
    }
  }

  return (
    <div ref={rootRef} className="service-plan-filter">
      <div>
        <label id={`${id}-label`} htmlFor={id}>
          Filter by service
        </label>
        <p id={`${id}-hint`}>Choose a service to compare its plan features.</p>
      </div>
      <div className="service-plan-filter__field">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          className="service-plan-filter__trigger"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={`${id}-hint`}
          aria-controls={`${id}-listbox`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-activedescendant={
            open ? `${id}-option-${activeIndex}` : undefined
          }
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
        >
          <span id={`${id}-value`}>{selected.label}</span>
          <i className="ph ph-caret-down" aria-hidden="true" />
        </button>
        {open && (
          <div
            ref={panelRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={`service-plan-filter__panel${placement.above ? " service-plan-filter__panel--above" : ""}`}
            style={{ maxHeight: placement.height }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                aria-labelledby={`${id}-option-label-${index}`}
                className="service-plan-filter__option"
                data-active={index === activeIndex}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse") setActiveIndex(index);
                }}
                onClick={() => selectOption(index)}
              >
                <span className="service-plan-filter__option-copy">
                  <span id={`${id}-option-label-${index}`}>{option.label}</span>
                  <span className="service-plan-filter__option-detail">
                    {option.detail}
                  </span>
                </span>
                <i className="ph ph-check" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
