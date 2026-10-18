import React, {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getPricingSnapshot,
  loadPublicCatalog,
  subscribePricing,
} from "./reference/purchase-catalog.js";
import {
  normalizeLocation,
  pageOf,
  setRoute,
  toSiteHref,
} from "./reference/navigation";
import { CartEditBar, CartNotice } from "./reference/CartControls";
import { headFor } from "./content/heads";
import { dirOf, shown, splitLocale, withLocale } from "./content/locale";

const pages = {
  "/faq": lazy(() => import("./reference/FAQ")),
  "/": lazy(() => import("./reference/Home")),
  "/services": lazy(() => import("./reference/Services")),
  "/software": lazy(() => import("./reference/Software")),
  "/work": lazy(() => import("./reference/Work")),
  "/about": lazy(() => import("./reference/About")),
  "/insights": lazy(() => import("./reference/Insights")),
  "/contact": lazy(() => import("./reference/Contact")),
  "/cart": lazy(() => import("./reference/Cart")),
  "/checkout": lazy(() => import("./reference/Checkout")),
  "/plans": lazy(() => import("./reference/Plans")),
  "/roadmap": lazy(() => import("./reference/Roadmap")),
  "/legal": lazy(() => import("./reference/Legal")),
  "/sign-in": lazy(() => import("./reference/SignIn")),
  "/sign-up": lazy(() => import("./reference/SignIn")),
};
normalizeLocation();

export function App() {
  useSyncExternalStore(
    subscribePricing,
    getPricingSnapshot,
    getPricingSnapshot,
  );
  useEffect(() => {
    loadPublicCatalog();
  }, []);
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => {
      normalizeLocation();
      setPath(window.location.pathname);
    };
    // Back and forward between two views of one page: the page hears it as it always did.
    let shown = pageOf(window.location.pathname);
    const history = () => {
      update();
      const page = pageOf(window.location.pathname);
      if (page === shown)
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      shown = page;
    };
    const navigate = (destination) => {
      // Links are written in English addresses; the page's language goes in front.
      const url = new URL(
        withLocale(toSiteHref(destination)),
        window.location.href,
      );
      if (url.origin !== window.location.origin) {
        window.location.assign(url.href);
        return;
      }
      const previous = window.location.href;
      const changedPage =
        pageOf(url.pathname) !== pageOf(window.location.pathname);
      if (pageOf(url.pathname) === "/cart" && !changedPage) return;
      const state =
        pageOf(url.pathname) === "/cart"
          ? {
              cartReturnTo:
                window.location.pathname +
                window.location.search +
                window.location.hash,
            }
          : {};
      window.history.pushState(state, "", url.pathname + url.search + url.hash);
      update();
      shown = pageOf(window.location.pathname);
      if (changedPage) window.scrollTo({ top: 0, behavior: "instant" });
      else
        window.dispatchEvent(
          new HashChangeEvent("hashchange", {
            oldURL: previous,
            newURL: url.href,
          }),
        );
    };
    window.__orgNav = navigate;
    const click = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (
        !anchor ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target ||
        anchor.hasAttribute("download")
      )
        return;
      const href = toSiteHref(anchor.getAttribute("href"));
      // A view of this page ("#/project/x"): its real address.
      if (href.startsWith("#/")) {
        event.preventDefault();
        setRoute(href);
        return;
      }
      if (href.startsWith("#")) return;
      const url = new URL(href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        !/^https?:$/.test(url.protocol)
      )
        return;
      event.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", click);
    window.addEventListener("popstate", history);
    // A page moving to one of its views (setRoute) changes the address, and so the title.
    const view = () => setPath(window.location.pathname);
    window.addEventListener("hashchange", view);
    return () => {
      delete window.__orgNav;
      document.removeEventListener("click", click);
      window.removeEventListener("popstate", history);
      window.removeEventListener("hashchange", view);
    };
  }, []);
  const page = pageOf(path);
  // The language comes from the address (/ar/…); the page's records are found by its English address.
  const { locale, path: route } = splitLocale(path);
  // The address's record in the Website Manager: its title, or none (an address the site doesn't have).
  const head = headFor(route, locale);
  useEffect(() => {
    if (head) document.title = head.title;
  }, [head?.title]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);
  // A language the Website Manager hasn't made public shows only in development and previews.
  const Page = head && shown(locale) ? pages[page] : null;
  return (
    <>
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <Suspense
        fallback={
          <div className="page-loading" role="status">
            Loading OrgTik…
          </div>
        }
      >
        {Page ? (
          <Page key={page} />
        ) : (
          <main className="not-found">
            <img src="/assets/logo/orgtik-lockup-white.svg" alt="OrgTik" />
            <h1>Page not found.</h1>
            <p>Explore our services, software, and ideas from the homepage.</p>
            <a href="/">Back to home ↗</a>
          </main>
        )}
      </Suspense>
      <CartNotice path={path} />
      <CartEditBar path={path} />
    </>
  );
}
