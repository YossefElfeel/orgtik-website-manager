import React, { useEffect, useId, useRef, useState } from "react";
import "./language-menu.css";
import { msg } from "../content/strings";

const LANGUAGES = [
  { code: msg("LanguageMenu:1"), label: msg("LanguageMenu:2") },
  { code: msg("LanguageMenu:3"), label: msg("LanguageMenu:4") },
  { code: msg("LanguageMenu:5"), label: msg("LanguageMenu:6") },
];

export function LanguageMenu({ compact = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(msg("LanguageMenu:7"));
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const selectedLanguage = LANGUAGES.find(
    (language) => language.code === selected,
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`language-menu${compact ? " language-menu--compact" : ""} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="language-menu__trigger"
        aria-label={msg("LanguageMenu:8", [selectedLanguage.label])}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <i className="ph ph-globe" aria-hidden="true" />
        <span className="language-menu__code">{selected}</span>
        <i
          className="ph ph-caret-down language-menu__chevron"
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={panelId} className="language-menu__panel">
          <p className="language-menu__heading">Language</p>
          <div className="language-menu__options" aria-label="Language options">
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                className="language-menu__option"
                aria-pressed={selected === language.code}
                onClick={() => {
                  setSelected(language.code);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span
                  lang={
                    language.code === "AR"
                      ? "ar"
                      : language.code === "DE"
                        ? "de"
                        : "en"
                  }
                >
                  {language.label}
                </span>
                <span className="language-menu__option-code">
                  {language.code}
                </span>
                {selected === language.code && (
                  <i className="ph ph-check" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
