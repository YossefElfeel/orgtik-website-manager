import React, { useEffect, useRef, useState } from "react";
import { content } from "../content";
import "./partners.css";

export function PartnerStrip() {
  const partners = content.PARTNERS();
  const copy = content.PARTNER_INFO();
  const section = useRef(null);
  const rail = useRef(null);
  const group = useRef(null);
  const interactionTimer = useRef(null);
  const [paused, setPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(section.current);
    const resize = new ResizeObserver(() =>
      setScrollable(group.current.scrollWidth > rail.current.clientWidth),
    );
    resize.observe(rail.current);
    resize.observe(group.current);
    return () => {
      preference.removeEventListener("change", update);
      observer.disconnect();
      resize.disconnect();
      clearTimeout(interactionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (
      !scrollable ||
      paused ||
      interactionPaused ||
      hovered ||
      focused ||
      !visible ||
      reduced
    )
      return;
    let frame;
    let previous;
    let position = rail.current.scrollLeft;
    const advance = (now) => {
      const node = rail.current;
      if (previous !== undefined && !document.hidden) {
        const gap =
          parseFloat(getComputedStyle(node.firstElementChild).gap) || 0;
        const loop = group.current.getBoundingClientRect().width + gap;
        position = (position + Math.min(now - previous, 50) * 0.036) % loop;
        node.scrollLeft = position;
      }
      previous = now;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [
    scrollable,
    paused,
    interactionPaused,
    hovered,
    focused,
    visible,
    reduced,
  ]);

  const pauseForInteraction = () => {
    clearTimeout(interactionTimer.current);
    setInteractionPaused(true);
    interactionTimer.current = setTimeout(
      () => setInteractionPaused(false),
      2000,
    );
  };

  const move = (direction) => {
    pauseForInteraction();
    rail.current.scrollBy({
      left: direction * rail.current.clientWidth * 0.7,
      behavior: reduced ? "instant" : "smooth",
    });
  };
  const logos = (duplicate = false) => (
    <ul
      ref={duplicate ? undefined : group}
      className="partner-logo-group"
      aria-hidden={duplicate || undefined}
    >
      {partners.map((partner) => (
        <li key={partner.id}>
          <a
            href={partner.profileHref}
            tabIndex={duplicate ? -1 : undefined}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label={
              duplicate ? undefined : `${copy.profileLabel}: ${partner.name}`
            }
          >
            <img
              src={partner.logo}
              alt={duplicate ? "" : partner.name}
              width="240"
              height="72"
              loading="lazy"
            />
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <section
      ref={section}
      id="partners"
      className="partner-strip"
      aria-labelledby="partner-strip-title"
    >
      <div className="partner-strip__heading">
        <div className="partner-strip__title">
          <h2 id="partner-strip-title">{copy.title}</h2>
          <span className="partner-mock-label">{copy.badge}</span>
        </div>
        <div className="partner-strip__actions">
          {scrollable && (
            <div className="partner-scroll-controls">
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label={copy.previousLabel}
                title={copy.previousLabel}
              >
                <i className="ph ph-arrow-left" aria-hidden="true" />
              </button>
              {!reduced && (
                <button
                  type="button"
                  onClick={() => {
                    clearTimeout(interactionTimer.current);
                    setInteractionPaused(false);
                    setPaused((value) => !value);
                  }}
                  aria-pressed={paused}
                  aria-label={paused ? copy.playLabel : copy.pauseLabel}
                  title={paused ? copy.playLabel : copy.pauseLabel}
                >
                  <i
                    className={`ph ph-${paused ? "play" : "pause"}`}
                    aria-hidden="true"
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => move(1)}
                aria-label={copy.nextLabel}
                title={copy.nextLabel}
              >
                <i className="ph ph-arrow-right" aria-hidden="true" />
              </button>
            </div>
          )}
          <a
            className="commerce-action partner-directory-link"
            href="/legal/partners"
          >
            <span>{copy.linkLabel}</span>
            <span className="commerce-action__arrow">
              <i className="ph ph-arrow-up-right" aria-hidden="true" />
            </span>
          </a>
        </div>
      </div>
      <div className="partner-strip__window">
        <div
          ref={rail}
          className="partner-rail"
          tabIndex={0}
          role="region"
          aria-label={copy.scrollLabel}
          onFocusCapture={(event) =>
            setFocused(event.target.matches(":focus-visible"))
          }
          onKeyDown={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocused(false);
          }}
          onPointerDown={() => {
            setFocused(false);
            pauseForInteraction();
          }}
          onPointerMove={(event) => {
            if (event.buttons) pauseForInteraction();
          }}
          onPointerUp={pauseForInteraction}
          onPointerCancel={pauseForInteraction}
          onWheel={pauseForInteraction}
        >
          <div className="partner-track">
            {logos()}
            {scrollable && logos(true)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PartnerDirectory() {
  const partners = content.PARTNERS();
  const copy = content.PARTNER_INFO();
  return (
    <div className="partner-directory">
      <span className="partner-mock-label">{copy.badge}</span>
      {partners.map((partner) => (
        <article id={partner.id} key={partner.id} className="partner-profile">
          <div className="partner-profile__logo">
            <img src={partner.logo} alt="" width="240" height="72" />
          </div>
          <div>
            <h3>{partner.name}</h3>
            <p className="partner-profile__category">{partner.category}</p>
            <p>{partner.summary}</p>
            {(partner.website || partner.accounts.length > 0) && (
              <div className="partner-profile__links">
                {partner.website && (
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${partner.name}: ${partner.mock ? copy.exampleWebsiteLabel : copy.websiteLabel}. ${copy.externalLabel}`}
                  >
                    <span>
                      {partner.mock
                        ? copy.exampleWebsiteLabel
                        : copy.websiteLabel}
                    </span>
                    <i className="ph ph-arrow-up-right" aria-hidden="true" />
                  </a>
                )}
                {partner.accounts.map((account) => {
                  const label = partner.mock
                    ? `${copy.exampleAccountLabel} ${account.label}`
                    : account.label;
                  return (
                    <a
                      key={`${account.label}:${account.url}`}
                      href={account.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${partner.name}: ${label}. ${copy.externalLabel}`}
                    >
                      <span>{label}</span>
                      <i className="ph ph-arrow-up-right" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
