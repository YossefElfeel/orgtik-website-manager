import React, { useEffect, useId, useRef, useState } from "react";
import { SharedMedia } from "../content/managed-page";
import { CartLink } from "./CartControls";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

const LINKS = () => [
  [run("gl_header|header|a", 1), "/"],
  [run("gl_header|header|a-2", 1), "/services"],
  [run("gl_header|header|a-3", 1), "/software"],
  [run("gl_header|header|a-4", 1), "/work"],
  [run("gl_header|header|a-5", 1), "/about"],
  [run("gl_header|header|a-6", 1), "/insights"],
];

function ProjectLink({ onClick, className = "" }) {
  return (
    <a
      href="/contact"
      className={`commerce-header__contact ${className}`}
      onClick={onClick}
    >
      {run("gl_commerce|siteHeader-intro|a", 0)}
      <span>
        <i className="ph ph-arrow-up-right" aria-hidden="true" />
      </span>
    </a>
  );
}

export function SiteHeader() {
  const [wide, setWide] = useState(
    () => matchMedia("(min-width: 1180px)").matches,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuId = useId();
  useEffect(() => {
    const query = matchMedia("(min-width: 1180px)");
    const resize = () => {
      setWide(query.matches);
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    const overflow = document.body.style.overflow;
    menu.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      menu.close();
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);
  return (
    <>
      <header className="site-header commerce-header">
        <a
          href="/"
          className="commerce-logo"
          aria-label={attr("gl_commerce|siteHeader-header|a@aria-label")}
        >
          <img
            src="/assets/logo/orgtik-mark-white.svg"
            alt=""
            className="commerce-brand__mark"
          />
          <img
            src="/assets/logo/orgtik-wordmark-white.svg"
            alt={attr("gl_commerce|siteHeader-header|img@alt")}
            className="commerce-brand__wordmark"
          />
        </a>
        {wide && (
          <nav
            aria-label={attr("gl_commerce|siteHeader-header|nav@aria-label")}
            className="commerce-nav"
          >
            {LINKS().map(([label, href]) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
          </nav>
        )}
        <div className="commerce-header__actions">
          <CartLink />
          <LanguageMenu compact={!wide} />
          {!wide && <AccountControl compact />}
          {wide ? (
            <>
              <AccountControl />
              <ProjectLink />
            </>
          ) : (
            <button
              type="button"
              className="commerce-menu site-menu-trigger"
              data-menu-toggle=""
              aria-label={attr(
                "gl_commerce|siteHeader-header|button@aria-label",
              )}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen(true)}
            >
              <span className="site-menu-trigger__label">
                {run("gl_commerce|siteHeader-header|button", 1)}
              </span>
              <i className="ph ph-list" aria-hidden="true" />
            </button>
          )}
        </div>
        <SharedMedia id="gl_header" />
        <SharedMedia id="gl_commerce" prefixes={["siteHeader-", "accountControl-"]} />
      </header>
      <dialog
        ref={menuRef}
        id={menuId}
        className="commerce-mobile-menu"
        aria-label={attr("gl_commerce|siteHeader-intro|dialog@aria-label")}
        onCancel={(event) => {
          event.preventDefault();
          setMenuOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [
            ...menuRef.current.querySelectorAll("a[href], button"),
          ];
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="commerce-mobile-menu__head">
          <img
            src="/assets/logo/orgtik-wordmark-white.svg"
            alt={attr("gl_commerce|siteHeader-intro|img@alt")}
          />
          <button
            data-menu-toggle=""
            type="button"
            aria-label={attr("gl_commerce|siteHeader-intro|button@aria-label")}
            onClick={() => setMenuOpen(false)}
          >
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={attr("gl_commerce|siteHeader-intro|nav@aria-label")}>
          {LINKS().map(([label, href]) => (
            <a href={href} key={href} onClick={() => setMenuOpen(false)}>
              {label}
              <i className="ph ph-arrow-up-right" aria-hidden="true" />
            </a>
          ))}
        </nav>
        <AccountControl
          menu
          onNavigate={() => setMenuOpen(false)}
          onSignOut={() => setMenuOpen(false)}
        />
        <ProjectLink
          className="commerce-mobile-menu__contact"
          onClick={() => setMenuOpen(false)}
        />
      </dialog>
    </>
  );
}
