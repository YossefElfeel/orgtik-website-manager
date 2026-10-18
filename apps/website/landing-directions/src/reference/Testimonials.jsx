import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import snapshot from "../content/snapshot";
import { currentLocale, dirOf, wordsOf } from "../content/locale";
import { SectionMedia } from "../content/managed-page";
import "./cms-content.css";
import "./testimonials.css";

const labels = {
  en: {
    heading: "In our clients’",
    accent: "words.",
    reviews: "Reviews",
    review: "Review",
    preview: "Testimonial preview.",
    approved: "Approved client stories will appear here.",
    stories: "Experiences shared by our clients.",
    samples: "Sample reviews are labeled.",
    sample: "Sample review",
    rating: "Rating preview",
    ratingHelp: "Five-star design preview; not a client rating",
    services: "Services",
    software: "Software",
    servicesContext: "Services testimonials",
    softwareContext: "Software testimonials",
    previous: "Previous testimonials",
    next: "Next testimonials",
    of: "of",
    track: "Client testimonials. Use the arrow keys to browse.",
  },
  ar: {
    heading: "بكلمات",
    accent: "عملائنا.",
    reviews: "التقييمات",
    review: "تقييم",
    preview: "معاينة آراء العملاء.",
    approved: "ستظهر قصص العملاء المعتمدة هنا.",
    stories: "تجارب يشاركها عملاؤنا.",
    samples: "التقييمات التجريبية موضّحة.",
    sample: "تقييم تجريبي",
    rating: "معاينة التقييم",
    ratingHelp: "معاينة تصميم بخمس نجوم؛ ليست تقييماً من عميل",
    services: "الخدمات",
    software: "البرمجيات",
    servicesContext: "آراء عملاء الخدمات",
    softwareContext: "آراء عملاء البرمجيات",
    previous: "الآراء السابقة",
    next: "الآراء التالية",
    of: "من",
    track: "آراء العملاء. استخدم مفاتيح الأسهم للتصفح.",
  },
  de: {
    heading: "In den Worten",
    accent: "unserer Kunden.",
    reviews: "Bewertungen",
    review: "Bewertung",
    preview: "Vorschau der Kundenstimmen.",
    approved: "Freigegebene Kundengeschichten erscheinen hier.",
    stories: "Erfahrungen unserer Kunden.",
    samples: "Beispielbewertungen sind gekennzeichnet.",
    sample: "Beispielbewertung",
    rating: "Bewertungsvorschau",
    ratingHelp: "Fünf-Sterne-Designvorschau; keine Kundenbewertung",
    services: "Services",
    software: "Software",
    servicesContext: "Kundenstimmen zu Services",
    softwareContext: "Kundenstimmen zur Software",
    previous: "Vorherige Kundenstimmen",
    next: "Nächste Kundenstimmen",
    of: "von",
    track: "Kundenstimmen. Mit den Pfeiltasten blättern.",
  },
  fr: {
    heading: "Les mots de",
    accent: "nos clients.",
    reviews: "Avis",
    review: "Avis",
    preview: "Aperçu des témoignages.",
    approved: "Les témoignages approuvés apparaîtront ici.",
    stories: "Les expériences de nos clients.",
    samples: "Les avis de démonstration sont indiqués.",
    sample: "Avis de démonstration",
    rating: "Aperçu de la note",
    ratingHelp: "Aperçu du design à cinq étoiles ; pas une note client",
    services: "Services",
    software: "Logiciels",
    servicesContext: "Témoignages sur les services",
    softwareContext: "Témoignages sur les logiciels",
    previous: "Témoignages précédents",
    next: "Témoignages suivants",
    of: "sur",
    track: "Témoignages clients. Utilisez les flèches pour parcourir.",
  },
  it: {
    heading: "Nelle parole dei",
    accent: "nostri clienti.",
    reviews: "Recensioni",
    review: "Recensione",
    preview: "Anteprima delle testimonianze.",
    approved: "Le storie approvate dei clienti appariranno qui.",
    stories: "Le esperienze dei nostri clienti.",
    samples: "Le recensioni dimostrative sono indicate.",
    sample: "Recensione dimostrativa",
    rating: "Anteprima della valutazione",
    ratingHelp:
      "Anteprima del design a cinque stelle; non una valutazione cliente",
    services: "Servizi",
    software: "Software",
    servicesContext: "Testimonianze sui servizi",
    softwareContext: "Testimonianze sul software",
    previous: "Testimonianze precedenti",
    next: "Testimonianze successive",
    of: "di",
    track: "Testimonianze dei clienti. Usa i tasti freccia per sfogliare.",
  },
};

function relatedTo(entry) {
  for (const type of [
    "serviceFamily",
    "service",
    "softwareModule",
    "caseStudy",
  ]) {
    const record = (snapshot.entries[type] ?? []).find(
      (row) => row.id === entry.relatedEntry,
    );
    if (record) {
      const words = wordsOf(record.locales) ?? {};
      return {
        kind: type === "softwareModule" ? "software" : "services",
        name: words.name ?? words.title ?? record.name,
      };
    }
  }
  return null;
}

/** Read from the published snapshot; generic reviews remain usable on either overview. */
export function reviewsFor(scope) {
  return (snapshot.entries.review ?? [])
    .filter(
      (entry) =>
        !["services", "software"].includes(scope) ||
        !relatedTo(entry) ||
        relatedTo(entry).kind === scope,
    )
    .slice()
    .sort(
      (a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0),
    );
}

function useTestimonials(count, rtl) {
  const section = useRef(null);
  const track = useRef(null);
  const [range, setRange] = useState({ first: 0, visible: 3 });
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const measure = useCallback(() => {
    const node = track.current;
    if (!node?.children.length) return;
    const bounds = node.getBoundingClientRect();
    const cards = [...node.children];
    const width = cards[0].getBoundingClientRect().width;
    const shown = Math.min(
      count,
      Math.max(1, Math.round(bounds.width / width)),
    );
    const leading = rtl ? bounds.right : bounds.left;
    const first = cards.reduce(
      (best, card, index) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs((rtl ? rect.right : rect.left) - leading);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Infinity },
    ).index;
    const next = {
      first: Math.min(first, Math.max(0, count - shown)),
      visible: shown,
    };
    setRange((old) =>
      old.first === next.first && old.visible === next.visible ? old : next,
    );
  }, [count, rtl]);

  const go = useCallback(
    (index, manual = true) => {
      const node = track.current;
      const card =
        node?.children[Math.max(0, Math.min(index, count - range.visible))];
      if (!card) return;
      const parent = node.getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      node.scrollBy({
        left: rtl ? rect.right - parent.right : rect.left - parent.left,
        behavior: reduced ? "instant" : "smooth",
      });
      if (manual) setInteraction((value) => value + 1);
    },
    [count, range.visible, reduced, rtl],
  );

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    node.addEventListener("scroll", measure, { passive: true });
    const intersection = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    intersection.observe(section.current);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(media.matches);
    const onVisibility = () => setHidden(document.hidden);
    onMotion();
    onVisibility();
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      node.removeEventListener("scroll", measure);
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [measure]);

  useEffect(() => {
    if (!visible || hidden || focused || reduced || count <= range.visible)
      return;
    const timer = window.setInterval(() => {
      if (
        document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        )
      )
        return;
      go(range.first >= count - range.visible ? 0 : range.first + 1, false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [visible, hidden, focused, reduced, count, range, go, interaction]);

  const onKeyDown = (event) => {
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const previousKey = rtl ? "ArrowRight" : "ArrowLeft";
    if (![nextKey, previousKey, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    go(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? count - range.visible
          : range.first + (event.key === nextKey ? 1 : -1),
    );
  };
  return {
    section,
    track,
    range,
    go,
    onKeyDown,
    onFocus: () => setFocused(true),
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
    interact: () => setInteraction((value) => value + 1),
  };
}

export function Testimonials({
  scope = "general",
  project,
  className = "",
  ...props
}) {
  const locale = currentLocale();
  const label = labels[locale] ?? labels.en;
  const reviews = reviewsFor(scope);
  const carousel = useTestimonials(reviews.length, dirOf(locale) === "rtl");
  const headingId = useId();
  const trackId = useId();
  if (!reviews.length) return null;
  const allSamples = reviews.every((entry) => entry.sample);
  const hasSamples = reviews.some((entry) => entry.sample);
  const context = project?.name ?? project?.title ?? label[`${scope}Context`];
  const number = (value) =>
    new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(value);
  return (
    <section
      {...props}
      id="reviews"
      ref={carousel.section}
      className={`testimonials ${className}`.trim()}
      dir={dirOf(locale)}
      aria-labelledby={headingId}
      onFocusCapture={carousel.onFocus}
      onBlurCapture={carousel.onBlur}
    >
      <div className="testimonials__inner">
        <div className="testimonials__heading">
          <h2 id={headingId}>
            {label.heading} <span>{label.accent}</span>
          </h2>
          <p className="testimonials__note">
            {allSamples ? label.preview : label.stories}
            <br />
            {allSamples ? label.approved : hasSamples ? label.samples : null}
          </p>
        </div>
        {context ? <p className="testimonials__context">{context}</p> : null}
        <div
          id={trackId}
          ref={carousel.track}
          className="testimonials__track"
          role="region"
          aria-label={label.track}
          tabIndex={0}
          onKeyDown={carousel.onKeyDown}
          onPointerDown={carousel.interact}
          onWheel={carousel.interact}
        >
          {reviews.map((entry) => {
            const words = wordsOf(entry.locales) ?? {};
            const related = relatedTo(entry);
            return (
              <figure
                key={entry.id}
                className="testimonials__card"
                data-review-id={entry.id}
              >
                <div className="testimonials__card-top">
                  <i className="ph-fill ph-quotes" aria-hidden="true" />
                  <div className="testimonials__category">
                    <span>{related?.name ?? label.reviews}</span>
                    <span
                      className={`testimonials__tag${related?.kind === "software" ? " testimonials__tag--software" : ""}`}
                    >
                      {related ? label[related.kind] : label.review}
                    </span>
                  </div>
                </div>
                <blockquote className="testimonials__quote">
                  {words.quote}
                </blockquote>
                <div className="testimonials__rating">
                  {entry.sample ? (
                    <>
                      <span aria-label={label.ratingHelp}>
                        {Array.from({ length: 5 }, (_, index) => (
                          <i
                            key={index}
                            className="ph-fill ph-star"
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                      <span>{label.rating}</span>
                    </>
                  ) : null}
                </div>
                <figcaption className="testimonials__client">
                  <span className="testimonials__avatar">
                    {entry.image?.src ? (
                      <img
                        src={
                          /^https?:\/\//.test(entry.image.src)
                            ? entry.image.src
                            : `/assets/${entry.image.src}`
                        }
                        alt={
                          entry.image.alt?.[locale] ?? entry.image.alt?.en ?? ""
                        }
                        style={{
                          objectPosition: `${entry.image.focal?.x ?? 50}% ${entry.image.focal?.y ?? 50}%`,
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <i className="ph ph-user" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>{words.name}</strong>
                    <p>
                      {[
                        words.role,
                        words.company,
                        entry.sample ? label.sample : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </figcaption>
                <SectionMedia
                  items={Object.values(
                    entry.presentation?.sectionMedia ?? {},
                  ).flat()}
                />
              </figure>
            );
          })}
        </div>
        <div className="testimonials__bottom">
          <p className="testimonials__count">
            <bdi>
              {number(carousel.range.first + 1)}–
              {number(
                Math.min(
                  reviews.length,
                  carousel.range.first + carousel.range.visible,
                ),
              )}
            </bdi>{" "}
            <span>
              {label.of} {number(reviews.length)}
            </span>
          </p>
          <div className="testimonials__controls">
            <button
              type="button"
              aria-label={label.previous}
              aria-controls={trackId}
              disabled={carousel.range.first === 0}
              onClick={() => carousel.go(carousel.range.first - 1)}
            >
              <i className="ph ph-arrow-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={label.next}
              aria-controls={trackId}
              disabled={
                carousel.range.first >= reviews.length - carousel.range.visible
              }
              onClick={() => carousel.go(carousel.range.first + 1)}
            >
              <i className="ph ph-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
