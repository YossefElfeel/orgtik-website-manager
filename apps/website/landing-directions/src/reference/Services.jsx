import { managedPageTree } from "../content/managed-page";
import { content } from "../content";
import {
  findItem,
  money,
  groupFromIds,
  configurationHref,
} from "./purchase-catalog.js";
import { PurchasingOverview, PackageSection } from "./PurchaseUI";
import { ServiceWork } from "./ServiceWork";
import { Testimonials } from "./Testimonials";
import { ContentHeading } from "./ContentHeading";
import React from "react";
import { nudge } from "../content/locale";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";

import { getServiceDuration } from "./service-duration";
import { ReferencePage } from "./ReferencePage";
import { routeHash, setRoute, toSiteHref } from "./navigation";
import {
  SERVICE_FAMILIES,
  getServiceChoices,
  getServicePlanSelection,
  recommendServicePlan,
} from "./service-catalog";
import { isPlanId, planIdFromLabel } from "./plan-ladder";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

export default class Services extends ReferencePage {
  FAM = SERVICE_FAMILIES;
  STORIES = content.STORIES();
  STEPS = content.STEPS();
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";
  HOME = "OrgTik%20Home.dc.html";
  readBundleQuery() {
    const query = new URLSearchParams(window.location.search);
    const ids = this.allSvc().map((item) => item.id);
    const selected = [
      ...new Set(
        (query.get("services") || "")
          .split(",")
          .filter((id) => ids.includes(id)),
      ),
    ];
    // Older links use engagement=project|partner instead of a plan.
    const plan = isPlanId(query.get("plan"))
      ? query.get("plan")
      : planIdFromLabel(query.get("plan")) ||
        { project: "starter", partner: "ongoing" }[query.get("engagement")];
    return {
      serviceMonths: getServiceDuration(query.get("duration")).months,
      ...(selected.length ? { sel: selected } : {}),
      // Start on the recommended plan; it never switches by itself afterwards.
      builderPlan:
        plan ||
        recommendServicePlan(selected.length ? selected : this.DEFAULT_SEL)
          ?.planId ||
        "starter",
    };
  }
  DEFAULT_SEL = [msg("Services:1"), msg("Services:2")];

  // Keep the builder shareable and restorable after refresh.
  syncBuilderUrl() {}

  readPlanService() {
    const route = this.parseRoute(routeHash());
    if (route?.view !== "family") return "all";
    const selection = getServicePlanSelection(
      route.fam,
      new URLSearchParams(window.location.search).get("plan-service"),
    );
    return selection?.family.children.length > 1
      ? selection.service?.slug || "all"
      : "all";
  }

  state = {
    route: this.parseRoute(routeHash()) || { view: "overview" },
    proc: 0,
    famActive: 0,
    sel: this.DEFAULT_SEL,
    builderPlan: "starter",
    builderDepartment: "all",
    compare: null,
    planService: this.readPlanService(),
    ...this.readBundleQuery(),
    svcOpen: 0,
    svcHover: null,
    hoverCard: null,
    narrow: window.innerWidth < 900,
    xwide: window.innerWidth >= 1180,
    menuOpen: false,
  };
  rootRef = React.createRef();
  headerRef = React.createRef();
  videoRef = React.createRef();
  heroMediaRef = React.createRef();
  parallaxRef = React.createRef();
  procRef = React.createRef();
  closingRef = React.createRef();
  glowRef = React.createRef();
  magnetRef = React.createRef();
  cursorRef = React.createRef();
  cursorBubble = React.createRef();
  parseRoute(hash) {
    const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
    if (["svc-builder", "service-bundles"].includes(h))
      return { view: "overview" };
    if (h === "") return { view: "overview" };
    if (h.charAt(0) !== "/") return null;
    const p = h.slice(1).split("/"),
      f = this.FAM.find((x) => x.slug === p[1]);
    if (p[0] === "family" && f) return { view: "family", fam: f.slug };
    if (p[0] === "service" && f) {
      const c = f.children.find((x) => x.slug === p[2]);
      if (c) return { view: "service", fam: f.slug, svc: c.slug };
    }
    return { view: "overview" };
  }
  routeKey(r) {
    return [r.view, r.fam || "", r.svc || ""].join("|");
  }
  componentDidMount() {
    super.componentDidMount();
    const root = this.rootRef.current;
    if (!root) return;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.setupHeroVideo();
    this.onScroll = () => this.syncScroll();
    window.addEventListener("scroll", this.onScroll, { passive: true });
    this.syncScroll();
    this.measure = () => {
      const el = this.rootRef.current;
      if (!el) return;
      const w = el.offsetWidth || window.innerWidth,
        n = w < 900,
        x = w >= 1180;
      if (n !== this.state.narrow || x !== this.state.xwide)
        this.setState({
          narrow: n,
          xwide: x,
          menuOpen: x ? false : this.state.menuOpen,
        });
    };
    window.addEventListener("resize", this.measure);
    requestAnimationFrame(this.measure);
    setTimeout(this.measure, 300);
    this.onHash = () => {
      const r = this.parseRoute(routeHash());
      if (["#svc-builder", "#service-bundles"].includes(routeHash()))
        this.pendingScroll = routeHash().slice(1);
      if (r)
        this.setState({
          route: r,
          planService: this.readPlanService(),
          serviceMonths: getServiceDuration(
            new URLSearchParams(window.location.search).get("duration"),
          ).months,
          menuOpen: false,
          svcOpen: 0,
          svcHover: null,
        });
    };
    window.addEventListener("hashchange", this.onHash);
    this.srcMO = new MutationObserver(() => this.applyDataSrc());
    this.srcMO.observe(root, { childList: true, subtree: true });
    this.procIO = new IntersectionObserver(
      ([e]) => {
        this.procVisible = e.isIntersecting;
      },
      { threshold: 0.35 },
    );
    if (this.procRef.current) this.procIO.observe(this.procRef.current);
    this.procT = setInterval(() => {
      if (
        this.procVisible &&
        !this.procHover &&
        !this.reduced &&
        !document.hidden
      )
        this.setState((s) => ({ proc: (s.proc + 1) % 4 }));
    }, 3800);
    if (!routeHash() && this.props.screen && this.props.screen !== "Overview")
      this.applyScreen();
    this.afterView(true);
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    if (this.routeKey(ps.route) !== this.routeKey(this.state.route)) {
      const c = this.cursorRef.current;
      if (c) c.style.opacity = "0";
      const tg = this.pendingScroll;
      this.pendingScroll = null;
      requestAnimationFrame(() => {
        if (tg) this.go(tg);
        else window.scrollTo({ top: 0, behavior: "instant" });
        this.afterView(false);
      });
    }
    this.applyDataSrc();
    if (pp.screen !== this.props.screen) this.applyScreen();
    if (ps.sel !== this.state.sel || ps.builderPlan !== this.state.builderPlan)
      this.syncBuilderUrl();
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    window.removeEventListener("hashchange", this.onHash);
    document.removeEventListener("visibilitychange", this.onVis);
    clearInterval(this.procT);
    [this.io, this.heroIO, this.procIO, this.srcMO].forEach(
      (o) => o && o.disconnect(),
    );
    (this.loops || []).forEach((a) => a.cancel());
  }
  afterView(first) {
    this.setupHeroVideo();
    const rt = this.rootRef.current;
    if (rt && !this.reduced && rt.animate)
      rt.querySelectorAll("[data-marquee]").forEach((el) => {
        if (el.__loop) return;
        el.__loop = true;
        this.loops = this.loops || [];
        this.loops.push(
          el.animate(
            [
              { transform: "translate3d(0,0,0)" },
              { transform: "translate3d(-50%,0,0)" },
            ],
            { duration: 70000, iterations: Infinity },
          ),
        );
      });
    this.applyDataSrc();
    setTimeout(() => this.applyDataSrc(), 60);
    this.observeReveals();
    this.bindCursors();
    this.setupLoops();
    this.heroIntro(first);
  }
  applyScreen() {
    const v = this.props.screen || msg("Services:3"),
      f = this.FAM.find((x) => x.short === v);
    setRoute(
      v === "Service detail"
        ? "#/service/design/brand-development"
        : f
          ? "#/family/" + f.slug
          : "#/",
    );
  }
  go(id) {
    const root = this.rootRef.current,
      el = root && root.querySelector("#" + id);
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 90,
      behavior: this.reduced ? "auto" : "smooth",
    });
  }
  goBuilder(mode, sel, dur) {
    const months =
      dur === "annual" ? 12 : dur === "biennial" ? 24 : Number(dur) || 1;
    const group = groupFromIds("service", sel || [], months);
    window.__orgNav?.(configurationHref(group));
  }
  setupHeroVideo() {
    const v = this.videoRef.current;
    if (this.activeHeroVideo === v) return;
    this.heroIO?.disconnect();
    if (this.onVis)
      document.removeEventListener("visibilitychange", this.onVis);
    this.activeHeroVideo = v;
    if (!v) return;
    if (window.innerWidth < 700) {
      v.src = "/assets/cinematic-mobile.mp4";
      v.poster = "/assets/cinematic-mobile.webp";
    }
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    const play = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    v.addEventListener("loadeddata", play);
    v.addEventListener("ended", () => {
      v.currentTime = 0;
      play();
    });
    this.heroIO = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) play();
        else v.pause();
      },
      { threshold: 0.05 },
    );
    this.heroIO.observe(v);
    this.onVis = () => {
      if (!document.hidden) play();
    };
    document.addEventListener("visibilitychange", this.onVis);
    play();
  }
  syncScroll() {
    const h = this.headerRef.current;
    if (!h) return;
    const y = window.scrollY;
    Object.assign(
      h.style,
      y > 40
        ? {
            insetInlineStart: "20px",
            insetInlineEnd: "20px",
            height: "72px",
            padding: "0 12px 0 22px",
            transform: "translateY(14px)",
            background: "#120A1Bd1",
            backdropFilter: "blur(18px) saturate(140%)",
            borderColor: "#ffffff1f",
            borderRadius: "22px",
            boxShadow: "0 20px 50px #0904114d, inset 0 1px 0 #ffffff12",
          }
        : {
            insetInlineStart: "0",
            insetInlineEnd: "0",
            height: "96px",
            padding: "0 max(clamp(20px,4.4vw,64px), calc((100% - 1312px) / 2))",
            transform: "none",
            background: "transparent",
            backdropFilter: "none",
            borderColor: "transparent",
            borderRadius: "0",
            boxShadow: "none",
          },
    );
    const p = this.parallaxRef.current;
    if (p && !this.reduced && y < 1400)
      p.style.transform = "translate3d(0," + y * 0.3 + "px,0)";
  }
  heroIntro(first) {
    const root = this.rootRef.current;
    if (!root || this.reduced || !root.animate) return;
    root.querySelectorAll("[data-hero-line]").forEach((l, i) =>
      l.animate([{ transform: "translateY(112%)" }, { transform: "none" }], {
        duration: 1300,
        delay: (first ? 200 : 60) + i * 120,
        easing: this.E,
        fill: "backwards",
      }),
    );
    root.querySelectorAll("[data-hero-fade]").forEach((l, i) =>
      l.animate(
        [
          { opacity: 0, filter: "blur(8px)", transform: "translateY(22px)" },
          { opacity: 1, filter: "blur(0px)", transform: "none" },
        ],
        {
          duration: 1000,
          delay: (first ? 600 : 220) + i * 90,
          easing: this.E,
          fill: "backwards",
        },
      ),
    );
    const hm = this.heroMediaRef.current;
    if (first && hm)
      hm.animate(
        [
          { transform: "scale(1.14)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 2600, easing: this.E, fill: "backwards" },
      );
  }
  observeReveals() {
    const root = this.rootRef.current;
    if (!root || this.reduced || !root.animate) return;
    if (!this.io)
      this.io = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              this.runReveal(e.target);
              this.io.unobserve(e.target);
            }
          }),
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
      );
    root.querySelectorAll("[data-reveal]").forEach((el) => {
      if (el.__rv) return;
      el.__rv = true;
      this.io.observe(el);
    });
  }
  runReveal(el) {
    const E = this.E,
      t = el.getAttribute("data-reveal");
    if (t === "mask")
      el.querySelectorAll("[data-line]").forEach((l, i) =>
        l.animate(
          [
            { opacity: 0, filter: "blur(18px)", transform: "translateY(22px)" },
            { opacity: 1, filter: "blur(0px)", transform: "none" },
          ],
          { duration: 1300, delay: i * 160, easing: E, fill: "backwards" },
        ),
      );
    else if (t === "stagger")
      Array.from(el.children).forEach((c, i) =>
        c.animate(
          [
            { opacity: 0, filter: "blur(12px)", transform: "translateY(28px)" },
            { opacity: 1, filter: "blur(0px)", transform: "none" },
          ],
          {
            duration: 1150,
            delay: Math.min(i * 90, 540),
            easing: E,
            fill: "backwards",
          },
        ),
      );
    else if (t === "clip") {
      el.animate(
        [
          { clipPath: "inset(10% 6% 10% 6% round 24px)", opacity: 0.4 },
          { clipPath: "inset(0% 0% 0% 0% round 24px)", opacity: 1 },
        ],
        { duration: 1400, easing: E, fill: "backwards" },
      );
      const im = el.querySelector("image-slot");
      if (im)
        im.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], {
          duration: 1800,
          easing: E,
          fill: "backwards",
        });
    } else
      el.animate(
        [
          { opacity: 0, filter: "blur(12px)", transform: "translateY(26px)" },
          { opacity: 1, filter: "blur(0px)", transform: "none" },
        ],
        { duration: 1150, easing: E, fill: "backwards" },
      );
  }
  bindCursors() {
    const root = this.rootRef.current,
      c = this.cursorRef.current,
      b = this.cursorBubble.current;
    if (!root || !c || !b || !this.fine || this.reduced) return;
    const label = b.querySelector("[data-cursor-label]");
    root.querySelectorAll("[data-cursor]").forEach((t) => {
      if (t.__cur) return;
      t.__cur = true;
      t.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        t.style.cursor = "none";
        if (label) label.textContent = t.getAttribute("data-cursor");
        c.style.opacity = "1";
        b.style.transform = "translate(-50%,-50%) scale(1)";
      });
      t.addEventListener("pointerleave", () => {
        c.style.opacity = "0";
        b.style.transform = "translate(-50%,-50%) scale(.5)";
      });
      t.addEventListener("pointermove", (e) => {
        const r = root.getBoundingClientRect(),
          k = r.width / root.offsetWidth || 1;
        c.style.transform =
          "translate3d(" +
          (e.clientX - r.left) / k +
          "px," +
          (e.clientY - r.top) / k +
          "px,0)";
      });
    });
  }
  setupLoops() {
    const root = this.rootRef.current;
    if (!root || this.reduced || !root.animate) return;
    this.loops = this.loops || [];
    const add = (sel, fn) =>
      root.querySelectorAll(sel).forEach((el) => {
        if (el.__loop) return;
        el.__loop = true;
        this.loops.push(fn(el));
      });
    add("[data-spin]", (el) =>
      el.animate([{ rotate: "0deg" }, { rotate: "360deg" }], {
        duration: +el.getAttribute("data-spin"),
        iterations: Infinity,
      }),
    );
    add("[data-pulse]", (el) =>
      el.animate(
        [
          { boxShadow: "0 0 60px #9458F455, inset 0 0 0 1px #ffffff2b" },
          { boxShadow: "0 0 130px #9458F48c, inset 0 0 0 1px #ffffff40" },
        ],
        {
          duration: 3200,
          iterations: Infinity,
          direction: "alternate",
          easing: "ease-in-out",
        },
      ),
    );
    add("[data-aurora]", (el) =>
      el.animate(
        [
          { opacity: 0.52, transform: "translate3d(-3%,5%,0) scaleX(.95)" },
          {
            opacity: 0.78,
            transform: "translate3d(4%,-3%,0) scaleX(1.06)",
            offset: 0.55,
          },
          { opacity: 0.62, transform: "translate3d(-1%,0,0) scaleX(1.02)" },
        ],
        {
          duration: 12000,
          iterations: Infinity,
          direction: "alternate",
          easing: "ease-in-out",
        },
      ),
    );
  }
  swapIn(sel) {
    const root = this.rootRef.current;
    if (!root || this.reduced) return;
    root.querySelectorAll(sel).forEach((el) =>
      el.animate(
        [
          { opacity: 0, filter: "blur(10px)", transform: "translateY(14px)" },
          { opacity: 1, filter: "blur(0px)", transform: "none" },
        ],
        { duration: 800, easing: this.E },
      ),
    );
  }

  applyDataSrc() {
    const root = this.rootRef.current;
    if (!root) return;
    root.querySelectorAll("image-slot[data-src]").forEach((el) => {
      const v = el.getAttribute("data-src");
      if (v && v.indexOf("{{") < 0 && el.getAttribute("src") !== v)
        el.setAttribute("src", v);
    });
  }

  allSvc() {
    return getServiceChoices();
  }

  goBundle(ids) {
    this.goBuilder(null, ids, 1);
  }
  onReq() {
    return this.props.prices === "On request";
  }
  chf(v) {
    return this.onReq()
      ? msg("Services:4")
      : msg("Services:5", [
          new Intl.NumberFormat("de-CH").format(Math.round(v)),
        ]);
  }
  BX = { limit: 6, tail: 3, noun: ["service", "services"] };
  bxCats() {
    return [{ label: msg("Services:6"), icon: "ph-squares-four" }].concat(
      this.FAM.map((f) => ({ label: f.short, icon: f.icon })),
    );
  }
  bxItems() {
    const IM = [
      "brand-cards.webp",
      "brand-glass.webp",
      "brand-phone.webp",
      "brand-tablet.webp",
      "cinematic-desktop.webp",
    ];
    let k = 0;
    return this.FAM.reduce(
      (a, f) =>
        a.concat(
          f.children.map((c) => {
            const caps = c.capabilities || [];
            return {
              slug: f.slug + "-" + c.slug,
              cat: f.short,
              chip: f.short,
              meta:
                caps.length +
                (caps.length === 1 ? " capability" : " capabilities"),
              title: c.name,
              excerpt: c.outcome,
              tags: [],
              image: IM[k++ % IM.length],
              ph: c.name + " image",
              href: "#/service/" + f.slug + "/" + c.slug,
              foot: msg("Services:7"),
              search: [c.name, c.outcome, c.summary, f.short, f.name]
                .concat(caps)
                .join(" "),
            };
          }),
        ),
      [],
    );
  }
  bxSide() {
    return [];
  }
  bxVals() {
    const s = this.state,
      narrow = s.narrow,
      items = this.bxItems(),
      f = s.bxF || msg("Services:8"),
      f2 = s.bxF2 || "",
      qRaw = s.bxQ || "",
      q = qRaw.trim().toLowerCase(),
      N = this.BX.noun;
    const list = items.filter(
      (x) =>
        (f === "All" || x.cat === f) &&
        (!f2 || x.cat2 === f2) &&
        (!q || x.search.toLowerCase().indexOf(q) >= 0),
    );
    const lim = this.BX.limit,
      collapsed = f === "All" && !f2 && !q && !s.bxAll && list.length > lim,
      shown = collapsed ? list.slice(0, lim) : list,
      n = shown.length,
      tail = this.BX.tail;
    const BP = [
      ["1 / span 7", "1 / span 2"],
      ["8 / span 5", "1"],
      ["8 / span 5", "2"],
    ];
    const pos = (i) => {
      if (narrow) return ["auto", "auto"];
      if (n === 1) return ["1 / -1", "auto"];
      if (n === 2) return [i ? "8 / span 5" : "1 / span 7", "auto"];
      if (i < 3) return BP[i];
      const j = i - 3,
        rem = n - 3,
        full = Math.floor(rem / tail) * tail;
      if (j < full)
        return [
          tail === 3
            ? ["1 / span 4", "5 / span 4", "9 / span 4"][j % 3]
            : j % 2
              ? "7 / span 6"
              : "1 / span 6",
          "auto",
        ];
      const r = rem - full;
      if (r === 1) return ["1 / -1", "auto"];
      return [j - full ? "7 / span 6" : "1 / span 6", "auto"];
    };
    const hv = (k) => {
      const on = s.hoverCard === k;
      return {
        imgT: on ? "scale(1.06)" : "scale(1)",
        arrowT: on ? "rotate(45deg)" : "none",
        enter: () => this.setState({ hoverCard: k }),
        leave: () => this.setState({ hoverCard: null }),
      };
    };
    const btn = (c, cnt, on, pick) => ({
      label: c.label,
      icon: c.icon,
      n: cnt,
      on: on ? "true" : "false",
      bg: on ? "#EEE3F7" : "transparent",
      c: on ? "#28123B" : "#E9E0F0",
      hover: on ? "#EEE3F7" : "#ffffff0d",
      nBg: on ? "#28123B1a" : "#ffffff12",
      pick: pick,
    });
    const cats = this.bxCats(),
      cats2 = this.bxCats2 ? this.bxCats2() : [],
      side = this.bxSide ? this.bxSide() : [];
    return {
      bxAside: s.xwide ? "sticky" : "static",
      bxAsideFlex: s.xwide ? "0 1 300px" : "1 1 100%",
      bxAsideDisp: s.xwide ? "flex" : "grid",
      bxQ: qRaw,
      bxHasQ: !!qRaw,
      bxOnQ: (e) => this.setState({ bxQ: e.target.value }),
      bxClearQ: () => this.setState({ bxQ: "" }),
      bxClear: () =>
        this.setState({ bxQ: "", bxF: msg("Services:9"), bxF2: "" }),
      bxIsF: !!q || f !== "All" || !!f2,
      bxCats: cats.map((c) =>
        btn(
          c,
          c.label === "All"
            ? items.length
            : items.filter((x) => x.cat === c.label).length,
          f === c.label,
          () => this.setState({ bxF: c.label, bxAll: false }),
        ),
      ),
      bxHasF2: cats2.length > 0,
      bxCats2: cats2.map((c) =>
        btn(
          c,
          items.filter((x) => x.cat2 === c.label).length,
          f2 === c.label,
          () =>
            this.setState({
              bxF2: f2 === c.label ? "" : c.label,
              bxAll: false,
            }),
        ),
      ),
      bxHasSide: side.length > 0,
      bxSide: side.map((x, i) =>
        Object.assign(
          { n: "0" + (i + 1), border: i ? "1px solid #ffffff14" : "none" },
          x,
        ),
      ),
      bxCount: collapsed
        ? msg("Services:10", [n, list.length, N[1]])
        : n +
          " " +
          (n === 1 ? N[0] : N[1]) +
          (f !== "All" ? " in " + f : "") +
          (f2 ? " · " + f2 : "") +
          (qRaw.trim() ? msg("Services:11", [qRaw.trim()]) : ""),
      bxHas: n > 0,
      bxNone: n === 0,
      bxCols: narrow ? "minmax(0,1fr)" : "repeat(12,minmax(0,1fr))",
      bxMore: collapsed,
      bxMoreLabel: msg("Services:12", [
        list.length - lim,
        list.length - lim === 1 ? N[0] : N[1],
      ]),
      bxShowMore: () => this.setState({ bxAll: true }),
      bxList: shown.map((x, i) => {
        const lead = i === 0 && n > 2,
          p = pos(i),
          h = hv("bx-" + x.slug);
        return Object.assign({}, x, {
          lead: lead,
          col: p[0],
          row: p[1],
          size: lead ? "clamp(24px,2.3vw,34px)" : "clamp(18px,1.4vw,21px)",
          hasTags: !!(x.tags && x.tags.length),
          tags: (x.tags || []).map((t) => {
            const m = !!q && t.toLowerCase().indexOf(q) >= 0;
            return {
              label: t,
              bg: m ? "#EEE3F7" : "#0D081480",
              c: m ? "#28123B" : "#F6F1FA",
            };
          }),
          imgT: h.imgT,
          arrowT: h.arrowT,
          enter: h.enter,
          leave: h.leave,
        });
      }),
    };
  }
  renderVals() {
    return Object.assign(this.renderVals0(), this.bxVals());
  }
  renderVals0() {
    const s = this.state,
      r = s.route,
      v = r.view,
      H = this.HOME;
    const F = r.fam ? this.FAM.find((x) => x.slug === r.fam) : null,
      C = F && r.svc ? F.children.find((x) => x.slug === r.svc) : null;
    const hov = (k) => {
      const on = s.hoverCard === k;
      return {
        arrowBg: on ? "#EEE3F7" : "transparent",
        arrowC: on ? "#28123B" : "#F6F1FA",
        arrowT: on ? "rotate(45deg)" : "none",
        enter: () => this.setState({ hoverCard: k }),
        leave: () => this.setState({ hoverCard: null }),
      };
    };
    const toContact = () => {
      window.__orgNav
        ? window.__orgNav("Contact.dc.html")
        : (location.href = "Contact.dc.html");
    };
    const name = C ? C.name : F ? F.name : "";
    let hero;
    if (C)
      hero = {
        hasCrumb: true,
        crumb: C.name,
        crumbRootC: "#B5A6C4",
        eyebrow: msg("Services:13", [F.name]),
        l1: C.name,
        l2: "",
        acc: F.kicker + ".",
        body: C.outcome + " " + C.summary,
        primary: msg("Services:14"),
        primaryGo: () => this.go("plans-section"),
        secondary: msg("Services:15"),
        secondaryGo: () =>
          this.goBundle(
            Array.from(new Set(this.state.sel.concat([F.slug + "/" + C.slug]))),
          ),
      };
    else if (F)
      hero = {
        hasCrumb: true,
        crumb: F.name,
        crumbRootC: "#B5A6C4",
        eyebrow: msg("Services:16", [F.kicker]),
        l1: F.name,
        l2: "",
        acc: F.title,
        body: F.intro,
        primary: msg("Services:17"),
        primaryGo: () => this.go("services-list"),
        secondary: msg("Services:18"),
        secondaryGo: () => this.go("plans-section"),
      };
    else
      hero = {
        hasCrumb: false,
        crumb: "",
        crumbRootC: "#FFFFFF",
        eyebrow: msg("Services:19"),
        l1: msg("Services:20"),
        l2: "",
        acc: msg("Services:21"),
        body: msg("Services:22"),
        primary: msg("Services:23"),
        primaryGo: () => this.go("families"),
        secondary: msg("Services:24"),
        secondaryGo: () => this.go("svc-builder"),
      };
    Object.assign(hero, {
      showStrip: false,
      noStrip: true,
      stripLabel: "",
      links: [],
      tags: [],
    });
    Object.assign(
      hero,
      C
        ? {
            panelTitle: msg("Services:25"),
            items: C.capabilities.map((c) => ({
              icon: "ph-check-circle",
              label: c,
              meta: "",
              href: "#/service/" + F.slug + "/" + C.slug,
            })),
            panelNote:
              F.slug === "hosting"
                ? msg("Services:26")
                : money(findItem(`${F.slug}/${C.slug}`).monthlyMinor) +
                  "/month",
          }
        : F
          ? {
              panelTitle: F.short + " services",
              items: F.children.map((c) => ({
                icon: F.icon,
                label: c.name,
                meta: "",
                href: "#/service/" + F.slug + "/" + c.slug,
              })),
              panelNote:
                F.slug === "hosting" ? msg("Services:27") : msg("Services:28"),
            }
          : {
              panelTitle: msg("Services:29"),
              items: this.FAM.map((x) => ({
                icon: x.icon,
                label: x.short,
                meta:
                  x.children.length +
                  (x.children.length === 1 ? " service" : " services"),
                href: "#/family/" + x.slug,
              })),
              panelNote: msg("Services:30"),
            },
    );
    const wideP = !s.narrow;
    const groups = this.FAM.map((f, i) => ({
      slug: f.slug,
      image: f.image,
      num: "0" + (i + 1),
      chips: f.children.map((c) => c.name),
      imgF: wideP && s.famActive !== i ? "blur(14px) saturate(.6)" : "none",
      ...(() => {
        const h = hov("fc" + f.slug);
        return {
          cEnter: h.enter,
          cLeave: h.leave,
          cImgT: h.imgT,
          cArrowT: h.arrowT,
        };
      })(),
      grow: wideP ? (s.famActive === i ? 4.2 : 1) : 1,
      minH: wideP ? "0px" : "440px",
      imgT: s.famActive === i || !wideP ? "scale(1.04)" : "scale(1.15)",
      colO: wideP && s.famActive !== i ? 1 : 0,
      expO: !wideP || s.famActive === i ? 1 : 0,
      expY: !wideP || s.famActive === i ? "0px" : "18px",
      scrim:
        !wideP || s.famActive === i
          ? "linear-gradient(180deg,#0D081459 0%,#0D081400 30%,#0D0814e6 100%)"
          : "linear-gradient(180deg,#170C24ed,#0D0814f7)",
      expF: !wideP || s.famActive === i ? "blur(0px)" : "blur(6px)",
      expD: !wideP || s.famActive === i ? ".34s" : "0s",
      enter: () => {
        clearTimeout(this.famT);
        this.famT = setTimeout(() => {
          if (this.state.famActive !== i) this.setState({ famActive: i });
        }, 130);
      },
      icon: f.icon,
      kicker: f.kicker,
      name: f.name,
      short: f.short,
      intro: f.intro,
      count:
        f.children.length +
        (f.children.length === 1 ? " service" : " services"),
      href: "#/family/" + f.slug,
      span: !s.narrow && i === this.FAM.length - 1 ? "1 / -1" : "auto",
      rows: f.children.map((c) =>
        Object.assign(
          {
            href: "#/service/" + f.slug + "/" + c.slug,
            name: c.name,
            outcome: c.outcome,
          },
          hov("g" + c.slug),
        ),
      ),
    }));
    const POS = {
      1: [["1 / span 12", "auto"]],
      2: [
        ["1 / span 7", "auto"],
        ["8 / span 5", "auto"],
      ],
      3: [
        ["1 / span 7", "1 / span 2"],
        ["8 / span 5", "1"],
        ["8 / span 5", "2"],
      ],
    };
    let bento = [],
      bn = { eyebrow: "", l1: "", acc: "", body: "" };
    if (F && !C) {
      const n = F.children.length;
      bn = {
        eyebrow: msg("Services:31", [F.short]),
        l1: n === 1 ? msg("Services:32") : msg("Services:33", [n]),
        acc: msg("Services:34"),
        body: msg("Services:35", [F.title]),
      };
      bento = F.children.map((c, i) => {
        const p = POS[n][i] || ["auto", "auto"],
          lead = i === 0;
        return {
          lead: lead,
          imgId: "sv-" + F.slug + "-" + c.slug,
          image: F.image,
          icon: F.icon,
          kicker: "0" + (i + 1) + " · " + F.short,
          title: c.name,
          sub: c.outcome,
          body: c.summary,
          tags: c.capabilities,
          hasLink: true,
          href: "#/service/" + F.slug + "/" + c.slug,
          size: lead ? "clamp(26px,2.46vw,37px)" : "clamp(22px,1.84vw,28px)",
          minH:
            lead && n === 3
              ? "clamp(520px,44vw,640px)"
              : lead
                ? "420px"
                : "300px",
          col: s.narrow ? "auto" : p[0],
          row: s.narrow ? "auto" : p[1],
        };
      });
    } else if (C) {
      bn = {
        eyebrow: msg("Services:37"),
        l1: msg("Services:38"),
        acc: msg("Services:39"),
        body: C.summary,
      };
      bento = this.STORIES.map((st, i) => {
        const p = POS[3][i],
          cap = C.capabilities[i] || C.capabilities[0],
          lead = i === 0;
        return {
          lead: lead,
          imgId: "sv-" + C.slug + "-lead",
          image: F.image,
          icon: st[2],
          kicker: "0" + (i + 1) + " · " + cap,
          title: st[0],
          sub: cap,
          body: st[1].replace("{c}", cap.toLowerCase()),
          tags: [],
          hasLink: false,
          href: "",
          size: lead ? "clamp(26px,2.46vw,37px)" : "clamp(22px,1.84vw,28px)",
          minH: lead ? "clamp(520px,44vw,640px)" : "300px",
          col: s.narrow ? "auto" : p[0],
          row: s.narrow ? "auto" : p[1],
        };
      });
    }
    let rel = { eyebrow: "", l1: "", acc: "", body: "", rows: [] };
    if (C) {
      const sib = F.children.filter((x) => x.slug !== C.slug);
      const rows = sib.length
        ? sib.map((x) => ({
            href: "#/service/" + F.slug + "/" + x.slug,
            icon: F.icon,
            name: x.name,
            outcome: x.outcome,
            k: "r" + x.slug,
          }))
        : this.FAM.filter((x) => x.slug !== F.slug).map((x) => ({
            href: "#/family/" + x.slug,
            icon: x.icon,
            name: x.name,
            outcome: x.title,
            k: "r" + x.slug,
          }));
      rel = {
        eyebrow: sib.length
          ? msg("Services:41", [F.short])
          : msg("Services:42"),
        l1: sib.length ? msg("Services:43") : msg("Services:44"),
        acc: sib.length ? msg("Services:45") : msg("Services:46"),
        body: sib.length ? msg("Services:47") : msg("Services:48"),
        rows: rows.map((x, i) =>
          Object.assign(
            x,
            { border: i ? "1px solid #ffffff14" : "none" },
            hov(x.k),
          ),
        ),
      };
    }
    const cta = F
      ? {
          eyebrow: msg("Services:49"),
          l1: msg("Services:50"),
          acc: msg("Services:51"),
          body: msg("Services:52", [name]),
          label: msg("Services:53"),
          go: toContact,
          second: msg("Services:54"),
          secondGo: () => this.go("plans-section"),
        }
      : {
          eyebrow: msg("Services:55"),
          l1: msg("Services:56"),
          acc: msg("Services:57"),
          body: msg("Services:58"),
          label: msg("Services:59"),
          go: toContact,
          second: msg("Services:60"),
          secondGo: () => {
            window.__orgNav
              ? window.__orgNav("Software.dc.html")
              : (location.href = "Software.dc.html");
          },
        };
    return {
      isOverview: v === "overview",
      isDetail: v !== "overview",
      isService: v === "service",
      xwide: !!s.xwide,
      notXwide: !s.xwide,

      menuOpen: s.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      menuLinks: [
        ["Home", "OrgTik%20Home.dc.html"],
        ["Services", "#/"],
        ["Software", "Software.dc.html"],
        ["Work", "Work.dc.html"],
        ["About", "About.dc.html"],
        ["Insights", "Insights.dc.html"],
      ].map((x) => ({ label: x[0], href: x[1] })),
      hero: hero,
      groups: groups,
      famCards: this.props.disciplines === "Cards",
      famAcc: this.props.disciplines !== "Cards",
      famCols: s.xwide
        ? "repeat(5,minmax(0,1fr))"
        : "repeat(auto-fit,minmax(min(100%,220px),1fr))",
      tickerLabel: msg("Services:61"),
      tickerList: [0, 1].map(() =>
        this.FAM.reduce(
          (acc2, x) => acc2.concat(x.children.map((c) => c.name)),
          [],
        ),
      ),
      famLeave: () => clearTimeout(this.famT),
      panDir: s.narrow ? "column" : "row",
      panH: s.narrow ? "auto" : "clamp(420px,calc(100svh - 240px),560px)",

      isFamily: v === "family",

      ac:
        F && !C
          ? {
              num: "01",
              eyebrow: msg("Services:62", [F.short]),
              l1:
                F.children.length === 1
                  ? msg("Services:63")
                  : msg("Services:64", [F.children.length]),
              accent: msg("Services:65"),
              body: msg("Services:66", [F.title]),
              stripL: F.kicker,
              stripR:
                F.children.length +
                (F.children.length === 1 ? " service" : " services"),
            }
          : {
              num: "",
              eyebrow: "",
              l1: "",
              accent: "",
              body: "",
              stripL: "",
              stripR: "",
            },
      svcs:
        F && !C
          ? F.children.map((c, i) => {
              const open = s.svcOpen === i,
                hv = s.svcHover === i,
                on = open || hv;
              return {
                key: F.slug + "-" + c.slug,
                index: "0" + (i + 1),
                icon: F.icon,
                title: c.name,
                category: c.outcome,
                caption: F.kicker,
                text: c.summary,
                tags: c.capabilities,
                image: F.image,
                href: "#/service/" + F.slug + "/" + c.slug,
                titleC: on ? "#DDBBFA" : "#F4EEF8",
                shift: hv ? nudge("8px") : "0px",
                lineS: on ? 1 : 0,
                glyphBorder: on ? "#A267DF" : "#ffffff24",
                glyphBg: on ? "#7B43B526" : "transparent",
                glyphColor: on ? "#F0DFFF" : "#C9A8F0",
                toggleBg: open ? "#CBA4F0" : "#F2EDF5",
                toggleRot: open ? "rotate(135deg)" : "none",
                rows: open ? "1fr" : "0fr",
                detailO: open ? 1 : 0,
                toggle: () => this.setState({ svcOpen: open ? null : i }),
                enter: () => this.setState({ svcHover: i }),
              };
            })
          : [],
      svcLeave: () => this.setState({ svcHover: null }),
      svcCols: s.xwide
        ? "48px minmax(0,1fr) auto 48px"
        : "48px minmax(0,1fr) 48px",
      detailCols: s.narrow
        ? "minmax(0,1fr)"
        : "minmax(0,1.16fr) minmax(300px,.84fr)",
      detailPad: s.narrow ? "0px" : "calc(48px + clamp(14px,2vw,28px))",

      bento: bento,
      bn: bn,
      bentoCols: s.narrow ? "minmax(0,1fr)" : "repeat(12,minmax(0,1fr))",

      rel: rel,
      cta: cta,
      apNum: "03",
      apEyebrow: v === "overview" ? msg("Services:67") : msg("Services:68"),
      apL1: v === "overview" ? msg("Services:69") : msg("Services:70"),
      apAcc: v === "overview" ? msg("Services:71") : msg("Services:72"),
      steps: this.STEPS.map((x, i) => {
        const on = i === s.proc,
          past = i < s.proc;
        return {
          idx: "0" + (i + 1),
          name: x[0],
          title: x[1],
          text: x[2],
          numC: on ? "#EEE3F7" : past ? "#6B5680" : "#3E2E4D",
          nameC: on ? "#FFFFFF" : "#CFC2DB",
          titleC: on ? "#D4B7EC" : "#9D8BAE",
          dot: on || past ? "#D4B7EC" : "#3E2E4D",
          glow: on ? "0 0 0 6px #D4B7EC26, 0 0 24px #9458F4" : "none",
          select: () => this.setState({ proc: i }),
        };
      }),
      railW: (s.proc + 1) * 25 + "%",
      procEnter: () => {
        this.procHover = true;
      },
      procLeave: () => {
        this.procHover = false;
      },
      closingMove: (e) => {
        const sec = this.closingRef.current,
          g = this.glowRef.current;
        if (!sec || !g || !this.fine) return;
        const rr = sec.getBoundingClientRect(),
          k = rr.width / sec.offsetWidth || 1;
        g.style.left = (e.clientX - rr.left) / k + "px";
        g.style.top = (e.clientY - rr.top) / k + "px";
        const m = this.magnetRef.current;
        if (!m) return;
        const mr = m.getBoundingClientRect(),
          dx = e.clientX - (mr.left + mr.width / 2),
          dy = e.clientY - (mr.top + mr.height / 2);
        m.style.transform =
          Math.hypot(dx, dy) < 170
            ? "translate3d(" +
              (dx * 0.14) / k +
              "px," +
              (dy * 0.18) / k +
              "px,0)"
            : "";
      },
      closingLeave: () => {
        const m = this.magnetRef.current;
        if (m) m.style.transform = "";
      },
      footExplore: [
        ["Software", "Software.dc.html"],
        ["Services", "Services.dc.html"],
        ["Selected work", "Work.dc.html"],
        ["Insights", "Insights.dc.html"],
        ["About OrgTik", "About.dc.html"],
      ].map((x) => ({ label: x[0], href: x[1] })),
      footStart: [
        ["Build a software plan", "Software.dc.html"],
        ["Bundles & pricing", "/plans"],
        ["Tell us about your project", "Contact.dc.html"],
        ["Roadmap", "Roadmap.dc.html"],
        ["Imprint", "/legal/imprint"],
      ].map((x) => ({ label: x[0], href: x[1] })),
      footTalk: () => {
        if (window.__orgNav) window.__orgNav("Contact.dc.html");
        else location.href = "Contact.dc.html";
      },
      socials: this.SOCIALS.map((x) => ({ name: x[0], cls: x[1] })),
      rootRef: this.rootRef,
      headerRef: this.headerRef,
      videoRef: this.videoRef,
      heroMediaRef: this.heroMediaRef,
      parallaxRef: this.parallaxRef,
      procRef: this.procRef,
      closingRef: this.closingRef,
      glowRef: this.glowRef,
      magnetRef: this.magnetRef,
      cursorRef: this.cursorRef,
      cursorBubble: this.cursorBubble,
    };
  }

  render() {
    const v = this.renderVals();
    return (
      managedPageTree(<>
        <div
          ref={v.rootRef}
          data-screen-label={"Services"}
          style={{
            position: "relative",
            background: "#0D0814",
            color: "#F6F1FA",
            fontFamily: '"OrgTik Arabic",Montserrat, sans-serif',
            fontWeight: "400",
            overflowX: "clip",
          }}
        >
          <div
            ref={v.cursorRef}
            style={{
              position: "absolute",
              insetInlineStart: "0",
              top: "0",
              width: "0",
              height: "0",
              zIndex: "60",
              pointerEvents: "none",
              opacity: "0",
              transition: "opacity .25s",
            }}
          >
            <span
              ref={v.cursorBubble}
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "6px",
                width: "104px",
                height: "104px",
                borderRadius: "50%",
                background: "#EEE3F7",
                color: "#28123B",
                fontSize: "12px",
                lineHeight: "1.25",
                fontWeight: "600",
                textAlign: "center",
                boxShadow: "0 18px 40px #09041159",
                transform: "translate(-50%,-50%) scale(.5)",
                transition: "transform .45s cubic-bezier(.22,1,.36,1)",
              }}
            >
              <span data-cursor-label={""}>
                {run("pg_services|intro|div", 2)}
              </span>
              <i
                aria-hidden={true}
                style={{ fontSize: "17px" }}
                className={"ph ph-arrow-up-right"}
              ></i>
            </span>
          </div>
          <div
            style={{ position: "sticky", top: "0", height: "0", zIndex: "50" }}
          >
            <header
              className="site-header"
              ref={v.headerRef}
              style={{
                position: "absolute",
                top: "0",
                insetInlineStart: "0",
                insetInlineEnd: "0",
                height: "96px",
                display: "flex",
                alignItems: "center",
                gap: v.xwide ? "28px" : "10px",
                padding:
                  "0 max(clamp(20px,4.4vw,64px), calc((100% - 1312px) / 2))",
                color: "#F6F1FA",
                border: "1px solid transparent",
                transition: "all .5s cubic-bezier(.22,1,.36,1)",
              }}
            >
              <a
                href={toSiteHref("OrgTik%20Home.dc.html")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexShrink: "0",
                  color: "#F6F1FA",
                }}
              >
                <img
                  src={"/assets/logo/orgtik-mark-white.svg"}
                  alt={""}
                  style={{
                    width: "30px",
                    height: "30px",
                    objectFit: "contain",
                  }}
                />
                <img
                  src={"/assets/logo/orgtik-wordmark-white.svg"}
                  alt={attr("gl_header|header|img@alt")}
                  style={{ width: "104px", height: "auto" }}
                />
              </a>
              {v.xwide && (
                <>
                  <nav
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                      margin: "0 auto",
                      padding: "5px",
                      borderRadius: "999px",
                      background: "#ffffff0b",
                      border: "1px solid #ffffff17",
                      backdropFilter: "blur(14px)",
                    }}
                  >
                    <a
                      href={toSiteHref("OrgTik%20Home.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-63"}
                    >
                      {run("gl_header|header|a", 1)}
                    </a>
                    <a
                      href={toSiteHref("#/")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        background: "#ffffff17",
                        color: "#FFFFFF",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-64"}
                    >
                      {run("gl_header|header|a-2", 1)}
                    </a>
                    <a
                      href={toSiteHref("Software.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-65"}
                    >
                      {run("gl_header|header|a-3", 1)}
                    </a>
                    <a
                      href={toSiteHref("Work.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-66"}
                    >
                      {run("gl_header|header|a-4", 1)}
                    </a>
                    <a
                      href={toSiteHref("About.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-67"}
                    >
                      {run("gl_header|header|a-5", 1)}
                    </a>
                    <a
                      href={toSiteHref("Insights.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-68"}
                    >
                      {run("gl_header|header|a-6", 1)}
                    </a>
                  </nav>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      flexShrink: "0",
                    }}
                  >
                    <CartLink />
                    <LanguageMenu />
                    <AccountControl />
                    <a
                      href={toSiteHref("Contact.dc.html")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "16px",
                        minHeight: "48px",
                        padding: "6px 6px 6px 20px",
                        borderRadius: "999px",
                        background: "#EEE3F7",
                        color: "#28123B",
                        fontSize: "13px",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                        transition:
                          "background .3s, transform .45s cubic-bezier(.22,1,.36,1)",
                      }}
                      className={"reference-state-70"}
                    >
                      {run("gl_header|header|a-7", 1)}
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "#28123B",
                          color: "#EEE3F7",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "16px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </a>
                  </div>
                </>
              )}
              {v.notXwide && (
                <>
                  <CartLink />
                  <LanguageMenu compact />
                  <AccountControl compact />
                  <button
                    data-menu-toggle=""
                    onClick={v.openMenu}
                    aria-label={attr("gl_header|header|button@aria-label")}
                    aria-expanded={v.menuOpen}
                    className="site-menu-trigger"
                    style={{
                      marginInlineStart: "0",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      height: "46px",
                      padding: "0 18px",
                      borderRadius: "999px",
                      border: "1px solid #ffffff2b",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    <span className="site-menu-trigger__label">
                      {run("gl_header|header|button", 1)}
                    </span>
                    <i
                      aria-hidden={true}
                      style={{ fontSize: "17px" }}
                      className={"ph ph-list"}
                    ></i>
                  </button>
                </>
              )}
            </header>
          </div>
          {v.menuOpen && (
            <>
              <div
                className="site-navigation-panel"
                style={{
                  position: "fixed",
                  inset: "0",
                  zIndex: "80",
                  background: "#0D0814",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={"/assets/logo/orgtik-wordmark-white.svg"}
                    alt={attr("pg_services|intro|img@alt")}
                    style={{ width: "104px" }}
                  />
                  <button
                    aria-label={attr("pg_services|intro|button@aria-label")}
                    onClick={v.closeMenu}
                    style={{
                      width: "46px",
                      height: "46px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      border: "1px solid #ffffff2b",
                    }}
                  >
                    <i
                      aria-hidden={true}
                      style={{ fontSize: "18px" }}
                      className={"ph ph-x"}
                    ></i>
                  </button>
                </div>
                <AccountControl
                  menu
                  onNavigate={v.closeMenu}
                  onSignOut={v.closeMenu}
                />
                <nav
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: "48px",
                  }}
                >
                  {(v.menuLinks || []).map((ml, mlIndex) => (
                    <React.Fragment key={mlIndex}>
                      <a
                        href={toSiteHref(ml.href)}
                        onClick={v.closeMenu}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "20px 0",
                          borderBottom: "1px solid #ffffff17",
                          fontSize: "27px",
                          fontWeight: "500",
                          letterSpacing: "-.03em",
                          color: "#F6F1FA",
                        }}
                      >
                        {ml.label}
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "20px", color: "#C9A0F3" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </a>
                    </React.Fragment>
                  ))}
                </nav>
                <a
                  href={toSiteHref("Contact.dc.html")}
                  onClick={v.closeMenu}
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minHeight: "52px",
                    padding: "8px 8px 8px 24px",
                    borderRadius: "999px",
                    background: "#EEE3F7",
                    color: "#28123B",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  {run("pg_services|intro|a", 1)}
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: "#28123B",
                      color: "#EEE3F7",
                    }}
                  >
                    <i
                      aria-hidden={true}
                      className={"ph ph-arrow-up-right"}
                    ></i>
                  </span>
                </a>
              </div>
            </>
          )}
          <main
            id={"top"}
            className={v.isOverview ? undefined : "content-page"}
          >
            {v.isOverview ? (
              <section data-cms-section="hero"
                style={{
                  position: "relative",
                  minHeight: "100svh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "clip",
                  isolation: "isolate",
                }}
              >
                <div
                  ref={v.heroMediaRef}
                  style={{
                    position: "absolute",
                    inset: "0",
                    zIndex: "-2",
                    background: "#190B25",
                  }}
                >
                  <div
                    ref={v.parallaxRef}
                    style={{
                      position: "absolute",
                      inset: "0",
                      willChange: "transform",
                    }}
                  >
                    <img
                      src={"/assets/cinematic-desktop.webp"}
                      alt={""}
                      style={{
                        position: "absolute",
                        inset: "0",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "72% 40%",
                      }}
                    />
                    <video
                      ref={v.videoRef}
                      src={"/assets/cinematic-desktop.mp4"}
                      poster={"/assets/cinematic-desktop.webp"}
                      muted={true}
                      loop={true}
                      playsInline={true}
                      autoPlay={true}
                      preload={"auto"}
                      style={{
                        position: "absolute",
                        inset: "0",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "72% 40%",
                      }}
                    ></video>
                  </div>
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: "0",
                    zIndex: "-1",
                    pointerEvents: "none",
                    background:
                      "linear-gradient(90deg,#0D0814 0%,#0D0814f0 26%,#0D0814a8 48%,#0D081400 76%),linear-gradient(0deg,#0D0814 0%,#0D081400 45%),linear-gradient(180deg,#0D0814c7 0%,#0D081400 24%)",
                  }}
                ></div>
                <div
                  style={{
                    flex: "1",
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    maxWidth: "1440px",
                    margin: "0 auto",
                    padding: "112px clamp(20px,4.4vw,64px) 44px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: "40px 56px",
                    }}
                  >
                    <div
                      style={{
                        flex: "1 1 560px",
                        minWidth: "0",
                        maxWidth: "860px",
                      }}
                    >
                      <div
                        data-hero-fade={""}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#B5A6C4",
                        }}
                      >
                        <a
                          href={toSiteHref("OrgTik%20Home.dc.html")}
                          style={{ color: "#B5A6C4" }}
                          className={"reference-state-71"}
                        >
                          {run("pg_services|hero|a", 1)}
                        </a>
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "12px", opacity: ".7" }}
                          className={"ph ph-caret-right"}
                        ></i>
                        <a
                          href={toSiteHref("#/")}
                          style={{ color: String(v.hero.crumbRootC) }}
                          className={"reference-state-72"}
                        >
                          {run("pg_services|hero|a-2", 1)}
                        </a>
                        {v.hero.hasCrumb && (
                          <>
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "12px", opacity: ".7" }}
                              className={"ph ph-caret-right"}
                            ></i>
                            <span style={{ color: "#FFFFFF" }}>
                              {v.hero.crumb}
                            </span>
                          </>
                        )}
                      </div>
                      <div
                        data-hero-fade={""}
                        style={{
                          marginTop: "26px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".2em",
                          textTransform: "uppercase",
                          color: "#DCD0E6",
                        }}
                      >
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "#B98AF7",
                            boxShadow: "0 0 0 5px #9458F42b",
                          }}
                        ></span>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {v.hero.eyebrow}
                        </span>
                      </div>
                      <h1
                        data-hw={""}
                        style={{
                          fontSize: "clamp(33px,min(5.08vw,8.2vh),80px)",
                          lineHeight: ".96",
                          fontWeight: "500",
                          letterSpacing: "-.05em",
                          margin: "28px 0 0",
                          textWrap: "balance",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            paddingBottom: ".1em",
                            marginBottom: "-.1em",
                          }}
                        >
                          <span
                            data-hero-line={""}
                            style={{ display: "block" }}
                          >
                            {v.hero.l1}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            paddingBottom: ".1em",
                            marginBottom: "-.1em",
                          }}
                        >
                          <span
                            data-hero-line={""}
                            style={{ display: "block" }}
                          >
                            {v.hero.l2}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            paddingBottom: ".12em",
                            marginBottom: "-.12em",
                          }}
                        >
                          <span
                            data-hero-line={""}
                            data-acc={""}
                            style={{
                              display: "block",
                              color: "#D4B7EC",
                              letterSpacing: "-.045em",
                            }}
                          >
                            {v.hero.acc}
                          </span>
                        </span>
                      </h1>
                      <p
                        data-hero-fade={""}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          marginTop: "32px",
                          maxWidth: "580px",
                          fontSize: "clamp(16px,1.2vw,18px)",
                          lineHeight: "1.6",
                          color: "#DCD0E6",
                          textWrap: "pretty",
                        }}
                      >
                        {v.hero.body}
                      </p>
                      <div
                        data-hero-fade={""}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "14px",
                          marginTop: "34px",
                        }}
                      >
                        <button
                          onClick={v.hero.primaryGo}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "20px",
                            minHeight: "52px",
                            padding: "8px 8px 8px 26px",
                            borderRadius: "999px",
                            background: "#EEE3F7",
                            color: "#28123B",
                            fontSize: "14px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                            transition:
                              "background .3s, transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s",
                          }}
                          className={"reference-state-73"}
                        >
                          {v.hero.primary}
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background: "#28123B",
                              color: "#EEE3F7",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "17px" }}
                              className={"ph ph-arrow-down"}
                            ></i>
                          </span>
                        </button>
                        <button
                          onClick={v.hero.secondaryGo}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "20px",
                            minHeight: "52px",
                            padding: "8px 8px 8px 26px",
                            borderRadius: "999px",
                            border: "1px solid #D4B7EC55",
                            background: "#0D081440",
                            backdropFilter: "blur(10px)",
                            color: "#F6F1FA",
                            fontSize: "14px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                            transition: "background .3s, border-color .3s",
                          }}
                          className={"reference-state-74"}
                        >
                          {v.hero.secondary}
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background: "#ffffff14",
                              color: "#F6F1FA",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "17px" }}
                              className={"ph ph-arrow-right"}
                            ></i>
                          </span>
                        </button>
                      </div>
                    </div>
                    {v.xwide && (
                      <>
                        <div
                          data-hero-fade={""}
                          style={{
                            flex: "0 1 380px",
                            minWidth: "300px",
                            padding: "22px 24px",
                            borderRadius: "24px",
                            background: "#0D081499",
                            border: "1px solid #ffffff21",
                            backdropFilter: "blur(18px) saturate(140%)",
                            boxShadow:
                              "0 30px 80px #0904118c, inset 0 1px 0 #ffffff12",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              letterSpacing: ".18em",
                              textTransform: "uppercase",
                              color: "#C9A0F3",
                              marginBottom: "10px",
                            }}
                          >
                            {v.hero.panelTitle}
                          </div>
                          {(v.hero.items || []).map((it, itIndex) => (
                            <React.Fragment key={itIndex}>
                              <a
                                href={toSiteHref(it.href)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "11px 0",
                                  borderTop: "1px solid #ffffff14",
                                  color: "#F6F1FA",
                                  transition: "color .3s",
                                }}
                                className={"reference-state-75"}
                              >
                                <span
                                  style={{
                                    display: "grid",
                                    placeItems: "center",
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "10px",
                                    background: "#EEE3F714",
                                    border: "1px solid #ffffff17",
                                    color: "#D4B7EC",
                                    flexShrink: "0",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "16px" }}
                                    className={"ph " + it.icon}
                                  ></i>
                                </span>
                                <span
                                  style={{
                                    flex: "1",
                                    minWidth: "0",
                                    fontSize: "15px",
                                    fontWeight: "600",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {it.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    color: "#B5A6C4",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {it.meta}
                                </span>
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "14px", color: "#B5A6C4" }}
                                  className={"ph ph-arrow-up-right"}
                                ></i>
                              </a>
                            </React.Fragment>
                          ))}
                          <div
                            style={{
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              marginTop: "6px",
                              paddingTop: "14px",
                              borderTop: "1px solid #ffffff14",
                              fontSize: "13px",
                              lineHeight: "1.5",
                              color: "#CFC2DB",
                            }}
                          >
                            {v.hero.panelNote}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div
                  data-hero-fade={""}
                  style={{
                    borderTop: "1px solid #ffffff1a",
                    background: "linear-gradient(180deg,#0D081400,#0D0814d9)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    data-marquee={""}
                    style={{ display: "flex", width: "max-content" }}
                  >
                    {(v.tickerList || []).map((tk, tkIndex) => (
                      <React.Fragment key={tkIndex}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "34px",
                            padding: "22px 34px 22px 0",
                            flexShrink: "0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              letterSpacing: ".24em",
                              textTransform: "uppercase",
                              color: "#C9A0F3",
                            }}
                          >
                            {v.tickerLabel}
                          </span>
                          {(tk || []).map((w, wIndex) => (
                            <React.Fragment key={wIndex}>
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "34px",
                                }}
                              >
                                <span
                                  style={{ fontSize: "17px", color: "#E9E0F0" }}
                                >
                                  {w}
                                </span>
                                <img
                                  src={"/assets/logo/orgtik-mark-white.svg"}
                                  alt={""}
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    opacity: ".35",
                                  }}
                                />
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <ContentHeading title={v.hero} />
            )}
            {v.isOverview && (
              <>
                <section data-cms-section="families"
                  id={"families"}
                  data-screen-label={"Services — Disciplines"}
                  style={{ padding: "var(--section-space) 0" }}
                >
                  <div
                    style={{
                      maxWidth: "1440px",
                      margin: "0 auto",
                      padding: "0 clamp(20px,4.4vw,64px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "32px 64px",
                        marginBottom: "clamp(24px,3vh,32px)",
                      }}
                    >
                      <div style={{ minWidth: "0" }}>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#B5A6C4",
                          }}
                        >
                          <span
                            style={{
                              color: "#C9A0F3",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {run("pg_services|families|div", 2)}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {run("pg_services|families|div", 7)}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                            marginTop: "22px",
                            textWrap: "balance",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {run("pg_services|families|h2", 3)}
                            </span>
                          </span>
                          <span style={{ display: "block" }}>
                            <span
                              data-line={""}
                              data-acc={""}
                              style={{
                                display: "block",
                                color: "#D4B7EC",
                                letterSpacing: "-.045em",
                              }}
                            >
                              {run("pg_services|families|h2", 9)}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "420px",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {run("pg_services|families|p", 1)}
                      </p>
                    </div>
                    {v.famAcc && (
                      <>
                        <div
                          data-reveal={"up"}
                          onMouseLeave={v.famLeave}
                          style={{
                            display: "flex",
                            flexDirection: String(v.panDir),
                            gap: "12px",
                            height: String(v.panH),
                          }}
                        >
                          {(v.groups || []).map((g, gIndex) => (
                            <React.Fragment key={gIndex}>
                              <a
                                href={toSiteHref(g.href)}
                                onMouseEnter={g.enter}
                                onFocus={g.enter}
                                data-cursor={"Explore"}
                                style={{
                                  position: "relative",
                                  flex: g.grow + " 1 0",
                                  minWidth: "0",
                                  minHeight: String(g.minH),
                                  borderRadius: "26px",
                                  overflow: "hidden",
                                  isolation: "isolate",
                                  background: "#1A0D27",
                                  color: "#F6F1FA",
                                  transition:
                                    "flex-grow 1.15s cubic-bezier(.65,.05,.36,1)",
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    zIndex: "-2",
                                    color: "#D4B7EC",
                                    filter: String(g.imgF),
                                    transition:
                                      "filter .9s cubic-bezier(.22,1,.36,1)",
                                  }}
                                >
                                  <image-slot
                                    id={"sv-fam-" + g.slug}
                                    shape={"rect"}
                                    data-src={"/assets/" + g.image}
                                    placeholder={g.name + " image"}
                                    style={{
                                      position: "absolute",
                                      inset: "0",
                                      width: "100%",
                                      height: "100%",
                                      transform: String(g.imgT),
                                      transition:
                                        "transform 1.6s cubic-bezier(.22,1,.36,1)",
                                    }}
                                  ></image-slot>
                                </div>
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    zIndex: "-1",
                                    pointerEvents: "none",
                                    background: String(g.scrim),
                                    transition: "background .6s",
                                  }}
                                ></span>
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    padding: "22px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    opacity: String(g.colO),
                                    transition: "opacity .22s ease",
                                    pointerEvents: "none",
                                  }}
                                >
                                  <span></span>
                                  <span
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "14px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        color: "#D4B7EC",
                                      }}
                                    >
                                      {g.num}
                                    </span>
                                    <span
                                      data-hw={""}
                                      style={{
                                        writingMode: "vertical-rl",
                                        transform: "rotate(180deg)",
                                        fontSize: "clamp(21px,1.7vw,26px)",
                                        color: "#E9E0F0",
                                        fontWeight: "500",
                                        letterSpacing: "-.03em",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {g.short}
                                    </span>
                                  </span>
                                </div>
                                <div
                                  style={{
                                    position: "absolute",
                                    insetInlineStart: "0",
                                    top: "0",
                                    bottom: "0",
                                    width: "clamp(300px,34vw,480px)",
                                    maxWidth: "100%",
                                    padding: "clamp(20px,2vw,28px)",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: "18px",
                                    opacity: String(g.expO),
                                    filter: String(g.expF),
                                    transform: "translateY(" + g.expY + ")",
                                    transition:
                                      "opacity .6s " +
                                      g.expD +
                                      ", filter .6s " +
                                      g.expD +
                                      ", transform .9s " +
                                      g.expD +
                                      " cubic-bezier(.16,1,.3,1)",
                                    pointerEvents: "none",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "grid",
                                        placeItems: "center",
                                        width: "38px",
                                        height: "38px",
                                        borderRadius: "12px",
                                        background: "#EEE3F7",
                                        color: "#28123B",
                                      }}
                                    >
                                      <i
                                        aria-hidden={true}
                                        style={{ fontSize: "17px" }}
                                        className={"ph " + g.icon}
                                      ></i>
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        letterSpacing: ".18em",
                                        textTransform: "uppercase",
                                        color: "#E9E0F0",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {g.num + " · " + g.kicker}
                                    </span>
                                  </div>
                                  <div>
                                    <h3
                                      data-hw={""}
                                      style={{
                                        fontSize: "clamp(26px,2.3vw,36px)",
                                        lineHeight: "1",
                                        fontWeight: "500",
                                        letterSpacing: "-.045em",
                                      }}
                                    >
                                      {g.name}
                                    </h3>
                                    <p
                                      style={{
                                        fontFamily:
                                          "Arial,Helvetica,sans-serif",
                                        marginTop: "10px",
                                        maxWidth: "40ch",
                                        fontSize: "14px",
                                        lineHeight: "1.55",
                                        color: "#E4DAEC",
                                      }}
                                    >
                                      {g.intro}
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                        marginTop: "14px",
                                      }}
                                    >
                                      {(g.chips || []).map((ch, chIndex) => (
                                        <React.Fragment key={chIndex}>
                                          <span
                                            style={{
                                              padding: "6px 11px",
                                              borderRadius: "999px",
                                              background: "#0D081480",
                                              border: "1px solid #ffffff2e",
                                              backdropFilter: "blur(10px)",
                                              fontSize: "12px",
                                              fontWeight: "600",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {ch}
                                          </span>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                    <span
                                      style={{
                                        marginTop: "18px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "5px 5px 5px 14px",
                                        borderRadius: "999px",
                                        background: "#EEE3F7",
                                        color: "#28123B",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <span style={{ whiteSpace: "nowrap" }}>
                                        {msg("Services:73", [g.short])}
                                      </span>
                                      <span
                                        style={{
                                          display: "grid",
                                          placeItems: "center",
                                          width: "28px",
                                          height: "28px",
                                          borderRadius: "50%",
                                          background: "#28123B",
                                          color: "#EEE3F7",
                                        }}
                                      >
                                        <i
                                          aria-hidden={true}
                                          style={{ fontSize: "13px" }}
                                          className={"ph ph-arrow-up-right"}
                                        ></i>
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </a>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    )}
                    {v.famCards && (
                      <>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "grid",
                            gridTemplateColumns: String(v.famCols),
                            gap: "12px",
                          }}
                        >
                          {(v.groups || []).map((g, gIndex) => (
                            <React.Fragment key={gIndex}>
                              <a
                                href={toSiteHref(g.href)}
                                data-cursor={"Explore"}
                                onMouseEnter={g.cEnter}
                                onMouseLeave={g.cLeave}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  minWidth: "0",
                                  borderRadius: "22px",
                                  overflow: "hidden",
                                  border: "1px solid #ffffff17",
                                  background: "#120A1B",
                                  color: "#F6F1FA",
                                  transition:
                                    "border-color .4s, transform .6s cubic-bezier(.22,1,.36,1)",
                                }}
                                className={"reference-state-76"}
                              >
                                <div
                                  style={{
                                    position: "relative",
                                    aspectRatio: "4 / 3",
                                    overflow: "hidden",
                                    color: "#D4B7EC",
                                  }}
                                >
                                  <image-slot
                                    id={"sv-famc-" + g.slug}
                                    shape={"rect"}
                                    data-src={"/assets/" + g.image}
                                    placeholder={g.name + " image"}
                                    style={{
                                      position: "absolute",
                                      inset: "0",
                                      width: "100%",
                                      height: "100%",
                                      transform: String(g.cImgT),
                                      transition:
                                        "transform 1.4s cubic-bezier(.22,1,.36,1)",
                                    }}
                                  ></image-slot>
                                  <span
                                    style={{
                                      position: "absolute",
                                      inset: "0",
                                      pointerEvents: "none",
                                      background:
                                        "linear-gradient(180deg,#120A1B00 45%,#120A1B 100%)",
                                    }}
                                  ></span>
                                  <span
                                    style={{
                                      position: "absolute",
                                      insetInlineStart: "14px",
                                      top: "14px",
                                      display: "grid",
                                      placeItems: "center",
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "11px",
                                      background: "#EEE3F7",
                                      color: "#28123B",
                                    }}
                                  >
                                    <i
                                      aria-hidden={true}
                                      style={{ fontSize: "17px" }}
                                      className={"ph " + g.icon}
                                    ></i>
                                  </span>
                                </div>
                                <div
                                  style={{
                                    flex: "1",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                    padding: "2px 18px 18px",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      color: "#C9A0F3",
                                    }}
                                  >
                                    {g.num}
                                  </span>
                                  <span
                                    data-hw={""}
                                    style={{
                                      fontSize: "clamp(20px,1.6vw,24px)",
                                      fontWeight: "500",
                                      letterSpacing: "-.03em",
                                      lineHeight: "1.1",
                                    }}
                                  >
                                    {g.short}
                                  </span>
                                  <span
                                    style={{
                                      fontFamily:
                                        '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                      fontSize: "14px",
                                      lineHeight: "1.5",
                                      color: "#CFC2DB",
                                    }}
                                  >
                                    {g.kicker}
                                  </span>
                                  <span
                                    style={{
                                      marginTop: "auto",
                                      paddingTop: "10px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      borderTop: "1px solid #ffffff14",
                                      fontSize: "13px",
                                      fontWeight: "600",
                                      color: "#D4B7EC",
                                    }}
                                  >
                                    <span>{g.count}</span>
                                    <i
                                      aria-hidden={true}
                                      style={{
                                        fontSize: "15px",
                                        transform: String(g.cArrowT),
                                        transition: "transform .45s",
                                      }}
                                      className={"ph ph-arrow-up-right"}
                                    ></i>
                                  </span>
                                </div>
                              </a>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
                <section data-cms-section="all-services"
                  id={"all-services"}
                  data-screen-label={"Services — All services"}
                  style={{ padding: "var(--section-space) 0" }}
                >
                  <div
                    style={{
                      maxWidth: "1440px",
                      margin: "0 auto",
                      padding: "0 clamp(20px,4.4vw,64px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "24px 64px",
                        marginBottom: "clamp(24px,3vh,32px)",
                      }}
                    >
                      <div style={{ minWidth: "0" }}>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#B5A6C4",
                          }}
                        >
                          <span
                            style={{
                              color: "#C9A0F3",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {run("pg_services|all-services|div", 2)}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {run("pg_services|all-services|div", 7)}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1.02",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                            marginTop: "22px",
                            textWrap: "balance",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {run("pg_services|all-services|h2", 3)}
                            </span>
                          </span>
                          <span style={{ display: "block" }}>
                            <span
                              data-line={""}
                              data-acc={""}
                              style={{
                                display: "block",
                                color: "#D4B7EC",
                                letterSpacing: "-.045em",
                              }}
                            >
                              {run("pg_services|all-services|h2", 9)}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "420px",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {run("pg_services|all-services|p", 1)}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        gap: "20px",
                      }}
                    >
                      <aside
                        data-reveal={"up"}
                        style={{
                          flex: String(v.bxAsideFlex),
                          minWidth: "250px",
                          position: String(v.bxAside),
                          top: "100px",
                          display: String(v.bxAsideDisp),
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(min(100%,240px),1fr))",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <label
                          style={{
                            gridColumn: "1 / -1",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            height: "50px",
                            padding: "0 14px",
                            borderRadius: "16px",
                            border: "1px solid #ffffff26",
                            background: "#ffffff08",
                            color: "#B5A6C4",
                          }}
                        >
                          <i
                            aria-hidden={true}
                            style={{ fontSize: "17px" }}
                            className={"ph ph-magnifying-glass"}
                          ></i>
                          <input
                            value={v.bxQ}
                            onChange={v.bxOnQ}
                            placeholder={attr(
                              "pg_services|all-services|input@placeholder",
                            )}
                            aria-label={attr(
                              "pg_services|all-services|input@aria-label",
                            )}
                            style={{
                              flex: "1",
                              minWidth: "0",
                              background: "transparent",
                              border: "0",
                              outline: "none",
                              color: "#F6F1FA",
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              fontSize: "15px",
                            }}
                          />
                          {v.bxHasQ && (
                            <>
                              <button
                                type={"button"}
                                onClick={v.bxClearQ}
                                title={attr(
                                  "pg_services|all-services|button@title",
                                )}
                                style={{
                                  display: "grid",
                                  placeItems: "center",
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  color: "#CFC2DB",
                                }}
                                className={"reference-state-77"}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "14px" }}
                                  className={"ph ph-x"}
                                ></i>
                              </button>
                            </>
                          )}
                        </label>
                        <div
                          style={{
                            padding: "14px",
                            borderRadius: "20px",
                            border: "1px solid #ffffff17",
                            background: "#120A1B",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              letterSpacing: ".16em",
                              textTransform: "uppercase",
                              color: "#9D8BAE",
                              margin: "2px 4px 8px",
                            }}
                          >
                            {run("pg_services|all-services|div-2", 1)}
                          </div>
                          {(v.bxCats || []).map((c, cIndex) => (
                            <React.Fragment key={cIndex}>
                              <button
                                type={"button"}
                                onClick={c.pick}
                                aria-pressed={c.on}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "10px 12px",
                                  marginTop: "2px",
                                  borderRadius: "12px",
                                  background: String(c.bg),
                                  color: String(c.c),
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  textAlign: "start",
                                  transition: "background .3s, color .3s",
                                }}
                                className={"reference-state-78"}
                              >
                                <span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    minWidth: "0",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{
                                      fontSize: "16px",
                                      flexShrink: "0",
                                    }}
                                    className={"ph " + c.icon}
                                  ></i>
                                  <span>{c.label}</span>
                                </span>
                                <span
                                  style={{
                                    minWidth: "26px",
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    background: String(c.nBg),
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  {c.n}
                                </span>
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                        {v.bxHasF2 && (
                          <>
                            <div
                              style={{
                                padding: "14px",
                                borderRadius: "20px",
                                border: "1px solid #ffffff17",
                                background: "#120A1B",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  letterSpacing: ".16em",
                                  textTransform: "uppercase",
                                  color: "#9D8BAE",
                                  margin: "2px 4px 8px",
                                }}
                              ></div>
                              {(v.bxCats2 || []).map((c, cIndex) => (
                                <React.Fragment key={cIndex}>
                                  <button
                                    type={"button"}
                                    onClick={c.pick}
                                    aria-pressed={c.on}
                                    style={{
                                      width: "100%",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: "12px",
                                      padding: "10px 12px",
                                      marginTop: "2px",
                                      borderRadius: "12px",
                                      background: String(c.bg),
                                      color: String(c.c),
                                      fontSize: "14px",
                                      fontWeight: "600",
                                      textAlign: "start",
                                      transition: "background .3s, color .3s",
                                    }}
                                    className={"reference-state-79"}
                                  >
                                    <span
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        minWidth: "0",
                                      }}
                                    >
                                      <i
                                        aria-hidden={true}
                                        style={{
                                          fontSize: "16px",
                                          flexShrink: "0",
                                        }}
                                        className={"ph " + c.icon}
                                      ></i>
                                      <span>{c.label}</span>
                                    </span>
                                    <span
                                      style={{
                                        minWidth: "26px",
                                        padding: "2px 8px",
                                        borderRadius: "999px",
                                        background: String(c.nBg),
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        textAlign: "center",
                                      }}
                                    >
                                      {c.n}
                                    </span>
                                  </button>
                                </React.Fragment>
                              ))}
                            </div>
                          </>
                        )}
                        {v.bxHasSide && (
                          <>
                            <div
                              style={{
                                padding: "14px",
                                borderRadius: "20px",
                                border: "1px solid #ffffff17",
                                background: "#120A1B",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  letterSpacing: ".16em",
                                  textTransform: "uppercase",
                                  color: "#9D8BAE",
                                  margin: "2px 4px 8px",
                                }}
                              >
                                {run("pg_services|all-services|div-3", 1)}
                              </div>
                              {(v.bxSide || []).map((p, pIndex) => (
                                <React.Fragment key={pIndex}>
                                  <a
                                    href={toSiteHref(p.href)}
                                    onClick={p.go}
                                    style={{
                                      display: "flex",
                                      gap: "12px",
                                      padding: "12px 4px",
                                      borderTop: String(p.border),
                                      color: "#F6F1FA",
                                    }}
                                    className={"reference-state-80"}
                                  >
                                    <span
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        color: "#C9A0F3",
                                        paddingTop: "2px",
                                      }}
                                    >
                                      {p.n}
                                    </span>
                                    <span style={{ flex: "1", minWidth: "0" }}>
                                      <span
                                        style={{
                                          display: "block",
                                          fontSize: "14px",
                                          fontWeight: "600",
                                          lineHeight: "1.35",
                                        }}
                                      >
                                        {p.title}
                                      </span>
                                      <span
                                        style={{
                                          display: "block",
                                          marginTop: "4px",
                                          fontSize: "12px",
                                          color: "#9D8BAE",
                                        }}
                                      >
                                        {p.meta}
                                      </span>
                                    </span>
                                    <i
                                      aria-hidden={true}
                                      style={{
                                        fontSize: "14px",
                                        color: "#9D8BAE",
                                        paddingTop: "2px",
                                      }}
                                      className={"ph ph-arrow-up-right"}
                                    ></i>
                                  </a>
                                </React.Fragment>
                              ))}
                            </div>
                          </>
                        )}
                      </aside>
                      <div style={{ flex: "1 1 560px", minWidth: "0" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "16px",
                            marginBottom: "14px",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#B5A6C4",
                          }}
                        >
                          <span aria-live={"polite"}>{v.bxCount}</span>
                          {v.bxIsF && (
                            <>
                              <button
                                type={"button"}
                                onClick={v.bxClear}
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#D4B7EC",
                                }}
                                className={"reference-state-81"}
                              >
                                {run("pg_services|all-services|button", 1)}
                              </button>
                            </>
                          )}
                        </div>
                        {v.bxHas && (
                          <>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: String(v.bxCols),
                                gridAutoRows: "minmax(224px,auto)",
                                gap: "12px",
                              }}
                            >
                              {(v.bxList || []).map((k, kIndex) => (
                                <React.Fragment key={kIndex}>
                                  <a
                                    href={toSiteHref(k.href)}
                                    data-cursor={"Explore"}
                                    onMouseEnter={k.enter}
                                    onMouseLeave={k.leave}
                                    style={{
                                      position: "relative",
                                      gridColumn: String(k.col),
                                      gridRow: String(k.row),
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "space-between",
                                      gap: "16px",
                                      padding: "20px",
                                      borderRadius: "22px",
                                      overflow: "hidden",
                                      isolation: "isolate",
                                      border: "1px solid #ffffff17",
                                      background:
                                        "linear-gradient(160deg,#1A0D27,#120A1B)",
                                      color: "#F6F1FA",
                                      transition:
                                        "border-color .4s, transform .6s cubic-bezier(.22,1,.36,1)",
                                    }}
                                    className={"reference-state-82"}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: "0",
                                        zIndex: "-2",
                                        color: "#D4B7EC",
                                      }}
                                    >
                                      <image-slot
                                        id={"sv-all-" + k.slug}
                                        shape={"rect"}
                                        data-src={"/assets/" + k.image}
                                        placeholder={k.ph}
                                        style={{
                                          position: "absolute",
                                          inset: "0",
                                          width: "100%",
                                          height: "100%",
                                          transform: String(k.imgT),
                                          transition:
                                            "transform 1.4s cubic-bezier(.22,1,.36,1)",
                                        }}
                                      ></image-slot>
                                    </div>
                                    <span
                                      style={{
                                        position: "absolute",
                                        inset: "0",
                                        zIndex: "-1",
                                        pointerEvents: "none",
                                        background:
                                          "linear-gradient(180deg,#0D081459 0%,#0D081400 30%,#0D0814f0 88%)",
                                      }}
                                    ></span>
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "10px",
                                        pointerEvents: "none",
                                      }}
                                    >
                                      <span
                                        style={{
                                          padding: "5px 10px",
                                          borderRadius: "999px",
                                          background: "#EEE3F7",
                                          color: "#28123B",
                                          fontSize: "12px",
                                          fontWeight: "700",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {k.chip}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          fontWeight: "600",
                                          color: "#CFC2DB",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {k.meta}
                                      </span>
                                    </div>
                                    <div style={{ pointerEvents: "none" }}>
                                      <h3
                                        data-hw={""}
                                        style={{
                                          fontSize: String(k.size),
                                          lineHeight: "1.12",
                                          fontWeight: "500",
                                          letterSpacing: "-.03em",
                                          textWrap: "balance",
                                        }}
                                      >
                                        {k.title}
                                      </h3>
                                      {k.lead && (
                                        <>
                                          <p
                                            style={{
                                              fontFamily:
                                                "Arial,Helvetica,sans-serif",
                                              marginTop: "10px",
                                              maxWidth: "46ch",
                                              fontSize: "14px",
                                              lineHeight: "1.6",
                                              color: "#DCD0E6",
                                            }}
                                          >
                                            {k.excerpt}
                                          </p>
                                        </>
                                      )}
                                      {k.hasTags && (
                                        <>
                                          <div
                                            style={{
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: "6px",
                                              marginTop: "12px",
                                            }}
                                          >
                                            {(k.tags || []).map((t, tIndex) => (
                                              <React.Fragment key={tIndex}>
                                                <span
                                                  style={{
                                                    padding: "5px 10px",
                                                    borderRadius: "999px",
                                                    background: String(t.bg),
                                                    border:
                                                      "1px solid #ffffff26",
                                                    backdropFilter:
                                                      "blur(10px)",
                                                    color: String(t.c),
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    transition:
                                                      "background .3s, color .3s",
                                                  }}
                                                >
                                                  {t.label}
                                                </span>
                                              </React.Fragment>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                      <span
                                        style={{
                                          marginTop: "14px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          gap: "12px",
                                          fontSize: "13px",
                                          fontWeight: "600",
                                          color: "#D4B7EC",
                                        }}
                                      >
                                        <span>{k.foot}</span>
                                        <i
                                          aria-hidden={true}
                                          style={{
                                            fontSize: "16px",
                                            transform: String(k.arrowT),
                                            transition: "transform .45s",
                                          }}
                                          className={"ph ph-arrow-up-right"}
                                        ></i>
                                      </span>
                                    </div>
                                  </a>
                                </React.Fragment>
                              ))}
                            </div>
                          </>
                        )}
                        {v.bxMore && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                marginTop: "22px",
                              }}
                            >
                              <button
                                type={"button"}
                                onClick={v.bxShowMore}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "14px",
                                  minHeight: "52px",
                                  padding: "6px 6px 6px 22px",
                                  borderRadius: "999px",
                                  border: "1px solid #D4B7EC55",
                                  color: "#F6F1FA",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  transition:
                                    "background .3s, border-color .3s",
                                }}
                                className={"reference-state-83"}
                              >
                                {v.bxMoreLabel}
                                <span
                                  style={{
                                    display: "grid",
                                    placeItems: "center",
                                    width: "38px",
                                    height: "38px",
                                    borderRadius: "50%",
                                    background: "#EEE3F7",
                                    color: "#28123B",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "15px" }}
                                    className={"ph ph-plus"}
                                  ></i>
                                </span>
                              </button>
                            </div>
                          </>
                        )}
                        {v.bxNone && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "12px",
                                padding: "56px 24px",
                                borderRadius: "22px",
                                border: "1px dashed #ffffff2e",
                                textAlign: "center",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "26px", color: "#D4B7EC" }}
                                className={"ph ph-magnifying-glass"}
                              ></i>
                              <div
                                data-hw={""}
                                style={{ fontSize: "22px", fontWeight: "500" }}
                              >
                                {run("pg_services|all-services|div-4", 1)}
                              </div>
                              <p
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  fontSize: "15px",
                                  color: "#CFC2DB",
                                }}
                              >
                                {run("pg_services|all-services|p-2", 1)}
                              </p>
                              <button
                                type={"button"}
                                onClick={v.bxClear}
                                style={{
                                  padding: "10px 18px",
                                  borderRadius: "999px",
                                  background: "#EEE3F7",
                                  color: "#28123B",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                }}
                              >
                                {run("pg_services|all-services|button-2", 1)}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isOverview && (
              <>
                <PurchasingOverview kind="service" />
              </>
            )}
            {v.isFamily && (
              <>
                <section data-cms-section="services-list"
                  id={"services-list"}
                  data-screen-label={"Services — Family services"}
                  style={{
                    position: "relative",
                    overflow: "clip",
                    isolation: "isolate",
                    background: "#190B25",
                    color: "#F4EEF8",
                    padding: "var(--section-space) 0",
                    borderTop: "1px solid #ffffff12",
                    borderBottom: "1px solid #ffffff12",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      insetInlineEnd: "-14%",
                      top: "-34%",
                      width: "64%",
                      aspectRatio: "1",
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle,#58327D52,transparent 64%)",
                      zIndex: "-1",
                      pointerEvents: "none",
                    }}
                  ></div>
                  <div
                    style={{
                      maxWidth: "1440px",
                      margin: "0 auto",
                      padding: "0 clamp(20px,4.4vw,64px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "32px 64px",
                        marginBottom: "clamp(24px,3vh,32px)",
                      }}
                    >
                      <div>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#B5A6C4",
                          }}
                        >
                          <span
                            style={{
                              color: "#C9A0F3",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {"(" + v.ac.num + ")"}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {v.ac.eyebrow}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                            marginTop: "22px",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {v.ac.l1}
                            </span>
                          </span>
                          <span style={{ display: "block" }}>
                            <span
                              data-line={""}
                              data-acc={""}
                              style={{
                                display: "block",
                                fontWeight: "500",
                                color: "#D4B7EC",
                                letterSpacing: "-.045em",
                              }}
                            >
                              {v.ac.accent}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <div
                        data-reveal={"up"}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "24px",
                          maxWidth: "380px",
                        }}
                      >
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            fontSize: "16px",
                            lineHeight: "1.65",
                            color: "#CFC2DB",
                          }}
                        >
                          {v.ac.body}
                        </p>
                        <a
                          href={toSiteHref("Contact.dc.html")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "20px",
                            minHeight: "50px",
                            padding: "7px 7px 7px 24px",
                            borderRadius: "999px",
                            background: "#EEE3F7",
                            color: "#28123B",
                            fontSize: "14px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                            transition:
                              "background .3s, transform .45s cubic-bezier(.22,1,.36,1)",
                          }}
                          className={"reference-state-91"}
                        >
                          {run("pg_services|services-list|a", 1)}
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              background: "#28123B",
                              color: "#EEE3F7",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "16px" }}
                              className={"ph ph-arrow-up-right"}
                            ></i>
                          </span>
                        </a>
                      </div>
                    </div>
                    <div
                      data-reveal={"up"}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "20px",
                        paddingBottom: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "#A596B0",
                      }}
                    >
                      <span style={{ whiteSpace: "nowrap" }}>
                        {v.ac.stripL}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          color: "#C9A0F3",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.ac.stripR + " "}
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "15px" }}
                          className={"ph ph-arrow-down-right"}
                        ></i>
                      </span>
                    </div>
                    <div style={{ borderBottom: "1px solid #ffffff21" }}>
                      {(v.svcs || []).map((s, sIndex) => (
                        <React.Fragment key={sIndex}>
                          <article
                            data-reveal={"up"}
                            style={{
                              position: "relative",
                              borderTop: "1px solid #ffffff21",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                insetInlineStart: "0",
                                insetInlineEnd: "0",
                                top: "-1px",
                                height: "1px",
                                background:
                                  "linear-gradient(90deg,#9458F4,#D4B7EC)",
                                transform: "scaleX(" + s.lineS + ")",
                                transformOrigin: "left",
                                transition:
                                  "transform .8s cubic-bezier(.22,1,.36,1)",
                              }}
                            ></span>
                            <button
                              onClick={s.toggle}
                              onMouseEnter={s.enter}
                              onMouseLeave={v.svcLeave}
                              style={{
                                width: "100%",
                                display: "grid",
                                gridTemplateColumns: String(v.svcCols),
                                alignItems: "center",
                                gap: "clamp(14px,2vw,28px)",
                                minHeight: "clamp(96px,8vw,120px)",
                                padding: "18px 0",
                                textAlign: "start",
                                color: "#F4EEF8",
                              }}
                            >
                              <span
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  display: "grid",
                                  placeItems: "center",
                                  borderRadius: "50%",
                                  border: "1px solid " + s.glyphBorder,
                                  background: String(s.glyphBg),
                                  color: String(s.glyphColor),
                                  transition:
                                    "all .35s cubic-bezier(.22,1,.36,1)",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "22px" }}
                                  className={"ph-light " + s.icon}
                                ></i>
                              </span>
                              <span
                                style={{
                                  fontSize: "clamp(23px,2.46vw,37px)",
                                  lineHeight: "1.05",
                                  fontWeight: "500",
                                  letterSpacing: "-.045em",
                                  color: String(s.titleC),
                                  transform: "translateX(" + s.shift + ")",
                                  transition:
                                    "transform .6s cubic-bezier(.22,1,.36,1), color .35s",
                                }}
                              >
                                {s.title}
                                <sup
                                  style={{
                                    marginInlineStart: "10px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    letterSpacing: ".08em",
                                    color: "#A596B0",
                                  }}
                                >
                                  {s.index}
                                </sup>
                              </span>
                              {v.xwide && (
                                <>
                                  <span
                                    style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      flexWrap: "nowrap",
                                      gap: "8px",
                                    }}
                                  >
                                    {(s.tags || []).map((t, tIndex) => (
                                      <React.Fragment key={tIndex}>
                                        <span
                                          style={{
                                            padding: "8px 13px",
                                            border: "1px solid #ffffff1f",
                                            borderRadius: "999px",
                                            color: "#CFC2DB",
                                            fontSize: "12px",
                                            fontWeight: "500",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {t}
                                        </span>
                                      </React.Fragment>
                                    ))}
                                  </span>
                                </>
                              )}
                              <span
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  display: "grid",
                                  placeItems: "center",
                                  borderRadius: "50%",
                                  background: String(s.toggleBg),
                                  color: "#190B25",
                                  transform: String(s.toggleRot),
                                  transition:
                                    "transform .5s cubic-bezier(.22,1,.36,1), background .3s",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "17px" }}
                                  className={"ph ph-plus"}
                                ></i>
                              </span>
                            </button>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateRows: String(s.rows),
                                transition:
                                  "grid-template-rows .7s cubic-bezier(.22,1,.36,1)",
                              }}
                            >
                              <div
                                style={{ minHeight: "0", overflow: "hidden" }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: String(v.detailCols),
                                    gap: "20px",
                                    padding: "4px 0 36px " + v.detailPad,
                                    opacity: String(s.detailO),
                                    transition: "opacity .5s",
                                  }}
                                >
                                  <figure
                                    style={{
                                      minWidth: "0",
                                      display: "flex",
                                      flexDirection: "column",
                                      background: "#0B0710",
                                      border: "1px solid #ffffff14",
                                      borderRadius: "18px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "relative",
                                        flex: "1 1 auto",
                                        minHeight: "clamp(200px,28svh,300px)",
                                        background: "#2A1542",
                                        color: "#D4B7EC",
                                      }}
                                    >
                                      <image-slot
                                        id={"sv-acc-" + s.key}
                                        shape={"rect"}
                                        data-src={"/assets/" + s.image}
                                        placeholder={msg("Services:74", [
                                          s.title,
                                        ])}
                                        style={{
                                          position: "absolute",
                                          inset: "0",
                                          width: "100%",
                                          height: "100%",
                                        }}
                                      ></image-slot>
                                    </div>
                                    <figcaption
                                      style={{
                                        flex: "none",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "18px",
                                        minHeight: "54px",
                                        padding: "0 22px",
                                        borderTop: "1px solid #ffffff12",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        color: "#E7DDEB",
                                      }}
                                    >
                                      <span>{s.title}</span>
                                      <small
                                        style={{
                                          fontFamily:
                                            "Arial,Helvetica,sans-serif",
                                          fontSize: "13px",
                                          fontWeight: "400",
                                          color: "#A596B0",
                                          textAlign: "end",
                                        }}
                                      >
                                        {s.caption}
                                      </small>
                                    </figcaption>
                                  </figure>
                                  <div
                                    style={{
                                      position: "relative",
                                      overflow: "hidden",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "flex-start",
                                      border: "1px solid #ffffff16",
                                      borderRadius: "18px",
                                      padding: "clamp(24px,2.6vw,36px)",
                                      background:
                                        "linear-gradient(145deg,#32203D66,#ffffff04)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        position: "absolute",
                                        insetInlineEnd: "20px",
                                        top: "6px",
                                        fontSize: "112px",
                                        lineHeight: "1",
                                        fontWeight: "500",
                                        letterSpacing: "-.08em",
                                        color: "#D7B1F70f",
                                        pointerEvents: "none",
                                      }}
                                    >
                                      {s.index}
                                    </span>
                                    <h4
                                      data-hw={""}
                                      style={{
                                        fontSize: "clamp(24px,2.02vw,29px)",
                                        fontWeight: "500",
                                        letterSpacing: "-.04em",
                                        color: "#F2E6FA",
                                      }}
                                    >
                                      {s.category}
                                    </h4>
                                    <p
                                      style={{
                                        fontFamily:
                                          "Arial,Helvetica,sans-serif",
                                        marginTop: "14px",
                                        fontSize: "16px",
                                        lineHeight: "1.65",
                                        color: "#D3C7D9",
                                        maxWidth: "40ch",
                                      }}
                                    >
                                      {s.text}
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "8px",
                                        margin: "26px 0 30px",
                                      }}
                                    >
                                      {(s.tags || []).map((t, tIndex) => (
                                        <React.Fragment key={tIndex}>
                                          <span
                                            style={{
                                              padding: "10px 12px",
                                              border: "1px solid #ffffff1f",
                                              borderRadius: "8px",
                                              color: "#CFC2DB",
                                              fontSize: "13px",
                                              fontWeight: "500",
                                              lineHeight: "1.2",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {t}
                                          </span>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                    <div style={{ marginTop: "auto" }}>
                                      <a
                                        href={toSiteHref(s.href)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "20px",
                                          minHeight: "50px",
                                          padding: "7px 7px 7px 24px",
                                          borderRadius: "999px",
                                          background: "#EEE3F7",
                                          color: "#28123B",
                                          fontSize: "14px",
                                          fontWeight: "600",
                                          whiteSpace: "nowrap",
                                          transition:
                                            "background .3s, transform .45s cubic-bezier(.22,1,.36,1)",
                                        }}
                                        className={"reference-state-92"}
                                      >
                                        {run(
                                          "pg_services|services-list|a-2",
                                          1,
                                        )}
                                        <span
                                          style={{
                                            display: "grid",
                                            placeItems: "center",
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "50%",
                                            background: "#28123B",
                                            color: "#EEE3F7",
                                          }}
                                        >
                                          <i
                                            aria-hidden={true}
                                            style={{ fontSize: "16px" }}
                                            className={"ph ph-arrow-up-right"}
                                          ></i>
                                        </span>
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isService && (
              <>
                <section data-cms-section="services-list"
                  id={"services-list"}
                  data-screen-label={"Services — Detail"}
                  style={{ padding: "var(--section-space) 0" }}
                >
                  <div
                    style={{
                      maxWidth: "1440px",
                      margin: "0 auto",
                      padding: "0 clamp(20px,4.4vw,64px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "32px 64px",
                        marginBottom: "clamp(24px,3vh,32px)",
                      }}
                    >
                      <div style={{ minWidth: "0" }}>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#B5A6C4",
                          }}
                        >
                          <span
                            style={{
                              color: "#C9A0F3",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {"(01)"}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {v.bn.eyebrow}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                            marginTop: "22px",
                            textWrap: "balance",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {v.bn.l1}
                            </span>
                          </span>
                          <span style={{ display: "block" }}>
                            <span
                              data-line={""}
                              data-acc={""}
                              style={{
                                display: "block",
                                color: "#D4B7EC",
                                letterSpacing: "-.045em",
                              }}
                            >
                              {v.bn.acc}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "420px",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {v.bn.body}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: String(v.bentoCols),
                        gap: "clamp(16px,1.6vw,22px)",
                      }}
                    >
                      {(v.bento || []).map((c, cIndex) => (
                        <React.Fragment key={cIndex}>
                          <div
                            data-reveal={"clip"}
                            style={{
                              position: "relative",
                              gridColumn: String(c.col),
                              gridRow: String(c.row),
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "28px",
                              minHeight: String(c.minH),
                              padding: "clamp(24px,2.4vw,34px)",
                              borderRadius: "24px",
                              overflow: "hidden",
                              isolation: "isolate",
                              border: "1px solid #ffffff17",
                              background:
                                "linear-gradient(160deg,#1A0D27,#120A1B)",
                              color: "#F6F1FA",
                            }}
                          >
                            {c.lead && (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    zIndex: "-2",
                                    color: "#D4B7EC",
                                  }}
                                >
                                  <image-slot
                                    id={c.imgId}
                                    shape={"rect"}
                                    data-src={"/assets/" + c.image}
                                    placeholder={c.title + " image"}
                                    style={{
                                      position: "absolute",
                                      inset: "0",
                                      width: "100%",
                                      height: "100%",
                                    }}
                                  ></image-slot>
                                </div>
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    zIndex: "-1",
                                    pointerEvents: "none",
                                    background:
                                      "linear-gradient(180deg,#0D081466 0%,#0D081400 28%,#0D0814f2 86%)",
                                  }}
                                ></span>
                              </>
                            )}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                pointerEvents: "none",
                              }}
                            >
                              <span
                                style={{
                                  padding: "7px 12px",
                                  borderRadius: "999px",
                                  background: "#0D081473",
                                  border: "1px solid #ffffff24",
                                  backdropFilter: "blur(10px)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  letterSpacing: ".08em",
                                  color: "#E9E0F0",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {c.kicker}
                              </span>
                              <span
                                style={{
                                  display: "grid",
                                  placeItems: "center",
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "13px",
                                  border: "1px solid #D4B7EC4d",
                                  color: "#D4B7EC",
                                  background: "#0D081459",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "18px" }}
                                  className={"ph " + c.icon}
                                ></i>
                              </span>
                            </div>
                            <div
                              style={{
                                pointerEvents: "none",
                                maxWidth: "620px",
                              }}
                            >
                              <h3
                                data-hw={""}
                                style={{
                                  fontSize: String(c.size),
                                  lineHeight: "1.04",
                                  fontWeight: "500",
                                  letterSpacing: "-.04em",
                                }}
                              >
                                {c.title}
                              </h3>
                              <p
                                style={{
                                  marginTop: "12px",
                                  fontSize: "16px",
                                  fontWeight: "500",
                                  lineHeight: "1.45",
                                  color: "#E9E0F0",
                                }}
                              >
                                {c.sub}
                              </p>
                              <p
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  marginTop: "10px",
                                  fontSize: "15px",
                                  lineHeight: "1.6",
                                  color: "#CFC2DB",
                                }}
                              >
                                {c.body}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                  marginTop: "18px",
                                }}
                              >
                                {(c.tags || []).map((t, tIndex) => (
                                  <React.Fragment key={tIndex}>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "7px",
                                        padding: "8px 12px",
                                        borderRadius: "999px",
                                        background: "#ffffff0d",
                                        border: "1px solid #ffffff1f",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <i
                                        aria-hidden={true}
                                        style={{ color: "#D4B7EC" }}
                                        className={"ph-fill ph-check-circle"}
                                      ></i>
                                      {t}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>
                              {c.hasLink && (
                                <>
                                  <a
                                    href={toSiteHref(c.href)}
                                    style={{
                                      pointerEvents: "auto",
                                      marginTop: "22px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      padding: "7px 7px 7px 18px",
                                      borderRadius: "999px",
                                      background: "#EEE3F7",
                                      color: "#28123B",
                                      fontSize: "14px",
                                      fontWeight: "600",
                                      whiteSpace: "nowrap",
                                    }}
                                    className={"reference-state-93"}
                                  >
                                    <span>
                                      {run("pg_services|services-list|a-3", 1)}
                                    </span>
                                    <span
                                      style={{
                                        display: "grid",
                                        placeItems: "center",
                                        width: "34px",
                                        height: "34px",
                                        borderRadius: "50%",
                                        background: "#28123B",
                                        color: "#EEE3F7",
                                      }}
                                    >
                                      <i
                                        aria-hidden={true}
                                        style={{ fontSize: "15px" }}
                                        className={"ph ph-arrow-right"}
                                      ></i>
                                    </span>
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isDetail && (
              <>
                <PackageSection
                  key={this.routeKey(this.state.route)}
                  kind="service"
                  department={this.state.route.fam}
                  id={
                    this.state.route.view === "service"
                      ? `${this.state.route.fam}/${this.state.route.svc}`
                      : undefined
                  }
                />
              </>
            )}
            <section data-cms-section="approach"
              id={"approach"}
              ref={v.procRef}
              style={{
                padding: "var(--section-space) 0",
                borderTop: "1px solid #ffffff12",
              }}
            >
              <div
                style={{
                  maxWidth: "1440px",
                  margin: "0 auto",
                  padding: "0 clamp(20px,4.4vw,64px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "32px 64px",
                    marginBottom: "clamp(24px,3vh,32px)",
                  }}
                >
                  <div>
                    <div
                      data-reveal={"up"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: ".2em",
                        textTransform: "uppercase",
                        color: "#B5A6C4",
                      }}
                    >
                      <span
                        style={{
                          color: "#C9A0F3",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {"(" + v.apNum + ")"}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      <span style={{ whiteSpace: "nowrap" }}>
                        {v.apEyebrow}
                      </span>
                    </div>
                    <h2
                      data-reveal={"mask"}
                      data-hw={""}
                      style={{
                        fontSize: "var(--section-title-size)",
                        lineHeight: "1",
                        fontWeight: "500",
                        letterSpacing: "-.045em",
                        marginTop: "22px",
                      }}
                    >
                      <span style={{ display: "block" }}>
                        <span data-line={""} style={{ display: "block" }}>
                          {v.apL1}
                        </span>
                      </span>
                      <span style={{ display: "block" }}>
                        <span
                          data-line={""}
                          data-acc={""}
                          style={{
                            display: "block",
                            fontWeight: "500",
                            color: "#D4B7EC",
                            letterSpacing: "-.045em",
                          }}
                        >
                          {v.apAcc}
                        </span>
                      </span>
                    </h2>
                  </div>
                  <p
                    data-reveal={"up"}
                    style={{
                      fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                      maxWidth: "380px",
                      fontSize: "16px",
                      lineHeight: "1.65",
                      color: "#CFC2DB",
                    }}
                  >
                    {run("pg_services|approach|p", 1)}
                  </p>
                </div>
                <div
                  data-reveal={"stagger"}
                  onMouseEnter={v.procEnter}
                  onMouseLeave={v.procLeave}
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                    columnGap: "clamp(20px,2.4vw,36px)",
                    rowGap: "48px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      insetInlineStart: "0",
                      insetInlineEnd: "0",
                      top: "0",
                      height: "1px",
                      background: "#ffffff1f",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      insetInlineStart: "0",
                      top: "0",
                      height: "1px",
                      width: String(v.railW),
                      background: "linear-gradient(90deg,#9458F4,#D4B7EC)",
                      transition: "width 1s cubic-bezier(.22,1,.36,1)",
                    }}
                  ></div>
                  {(v.steps || []).map((st, stIndex) => (
                    <React.Fragment key={stIndex}>
                      <button
                        onMouseEnter={st.select}
                        onClick={st.select}
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          justifyContent: "flex-start",
                          alignSelf: "start",
                          textAlign: "start",
                          paddingTop: "44px",
                          color: "#F6F1FA",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            insetInlineStart: "0",
                            top: "-5px",
                            width: "11px",
                            height: "11px",
                            borderRadius: "50%",
                            background: String(st.dot),
                            boxShadow: String(st.glow),
                            transition: "all .5s",
                          }}
                        ></span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "clamp(35px,2.95vw,45px)",
                            lineHeight: ".9",
                            fontWeight: "200",
                            letterSpacing: "-.06em",
                            color: String(st.numC),
                            transition: "color .6s",
                          }}
                        >
                          {st.idx}
                        </span>
                        <span
                          data-hw={""}
                          style={{
                            display: "block",
                            marginTop: "22px",
                            fontSize: "clamp(25px,2.3vw,34px)",
                            fontWeight: "500",
                            letterSpacing: "-.04em",
                            lineHeight: "1.05",
                            textWrap: "balance",
                            color: String(st.nameC),
                            transition: "color .4s",
                          }}
                        >
                          {st.name}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: "14px",
                            fontSize: "16px",
                            fontWeight: "500",
                            color: String(st.titleC),
                            transition: "color .4s",
                          }}
                        >
                          {st.title}
                        </span>
                        <span
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            display: "block",
                            marginTop: "10px",
                            maxWidth: "32ch",
                            fontSize: "15px",
                            lineHeight: "1.6",
                            color: "#B5A6C4",
                          }}
                        >
                          {st.text}
                        </span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>
            {v.isService && (
              <ServiceWork
                family={this.FAM.find((f) => f.slug === this.state.route.fam)}
                service={this.FAM.find(
                  (f) => f.slug === this.state.route.fam,
                ).children.find((c) => c.slug === this.state.route.svc)}
              />
            )}
            {v.isService && (
              <>
                <section
                  data-screen-label={"Services — More in family"}
                  style={{
                    padding: "var(--section-space) 0",
                    borderTop: "1px solid #ffffff12",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "1440px",
                      margin: "0 auto",
                      padding: "0 clamp(20px,4.4vw,64px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "32px 64px",
                        marginBottom: "clamp(24px,3vh,32px)",
                      }}
                    >
                      <div style={{ minWidth: "0" }}>
                        <div
                          data-reveal={"up"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#B5A6C4",
                          }}
                        >
                          <span
                            style={{
                              color: "#C9A0F3",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {"(05)"}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {v.rel.eyebrow}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                            marginTop: "22px",
                            textWrap: "balance",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {v.rel.l1}
                            </span>
                          </span>
                          <span style={{ display: "block" }}>
                            <span
                              data-line={""}
                              data-acc={""}
                              style={{
                                display: "block",
                                color: "#D4B7EC",
                                letterSpacing: "-.045em",
                              }}
                            >
                              {v.rel.acc}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "420px",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {v.rel.body}
                      </p>
                    </div>
                    <div
                      data-reveal={"up"}
                      style={{
                        borderRadius: "26px",
                        border: "1px solid #ffffff17",
                        background: "#120A1B",
                        padding: "4px clamp(20px,2.4vw,32px)",
                      }}
                    >
                      {(v.rel.rows || []).map((r, rIndex) => (
                        <React.Fragment key={rIndex}>
                          <a
                            href={toSiteHref(r.href)}
                            onMouseEnter={r.enter}
                            onMouseLeave={r.leave}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "48px minmax(0,1fr) 40px",
                              alignItems: "center",
                              gap: "18px",
                              padding: "22px 0",
                              borderTop: String(r.border),
                              color: "#F6F1FA",
                            }}
                            className={"reference-state-99"}
                          >
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "48px",
                                height: "48px",
                                borderRadius: "14px",
                                background: "#ffffff0d",
                                border: "1px solid #ffffff17",
                                color: "#D4B7EC",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "19px" }}
                                className={"ph " + r.icon}
                              ></i>
                            </span>
                            <span style={{ minWidth: "0" }}>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "18px",
                                  fontWeight: "500",
                                  letterSpacing: "-.02em",
                                }}
                              >
                                {r.name}
                              </span>
                              <span
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  display: "block",
                                  marginTop: "3px",
                                  fontSize: "14px",
                                  lineHeight: "1.45",
                                  color: "#B5A6C4",
                                }}
                              >
                                {r.outcome}
                              </span>
                            </span>
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                border: "1px solid #ffffff2e",
                                background: String(r.arrowBg),
                                color: String(r.arrowC),
                                transform: String(r.arrowT),
                                transition:
                                  "all .45s cubic-bezier(.22,1,.36,1)",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "16px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </span>
                          </a>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isOverview && <Testimonials data-cms-section="reviews" scope="services" />}
            <section
              id={"closing"}
              className="closing-cta"
              ref={v.closingRef}
              onMouseMove={v.closingMove}
              onMouseLeave={v.closingLeave}
              style={{
                position: "relative",
                overflow: "clip",
                isolation: "isolate",
                padding: "var(--section-space) 0",
                minHeight: "var(--closing-cta-height)",
                display: "grid",
                alignItems: "center",
                textAlign: "center",
                background: "#0B0612",
              }}
            >
              <div
                ref={v.glowRef}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "55%",
                  width: "min(1100px,120vw)",
                  aspectRatio: "1",
                  transform: "translate(-50%,-50%)",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle,#9458F452 0%,#6C3CAA26 30%,transparent 62%)",
                  zIndex: "-1",
                  pointerEvents: "none",
                  transition:
                    "left .9s cubic-bezier(.22,1,.36,1), top .9s cubic-bezier(.22,1,.36,1)",
                }}
              ></div>
              <img
                src={"/assets/logo/orgtik-mark-white.svg"}
                alt={""}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "var(--closing-cta-mark-width)",
                  height: "auto",
                  transform: "translate(-50%,-50%)",
                  opacity: ".04",
                  zIndex: "-1",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  maxWidth: "1440px",
                  margin: "0 auto",
                  padding: "0 clamp(20px,4.4vw,64px)",
                }}
              >
                <div
                  data-reveal={"up"}
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    letterSpacing: ".24em",
                    textTransform: "uppercase",
                    color: "#C9A0F3",
                  }}
                >
                  {v.cta.eyebrow}
                </div>
                <h2
                  data-reveal={"mask"}
                  data-hw={""}
                  style={{
                    marginTop: "34px",
                    fontSize: "var(--closing-cta-title-size)",
                    lineHeight: ".95",
                    fontWeight: "500",
                    letterSpacing: "-.05em",
                    textWrap: "balance",
                  }}
                >
                  <span style={{ display: "block" }}>
                    <span data-line={""} style={{ display: "block" }}>
                      {v.cta.l1}
                    </span>
                  </span>
                  <span style={{ display: "block" }}>
                    <span
                      data-line={""}
                      data-acc={""}
                      style={{
                        display: "block",
                        color: "#D4B7EC",
                        letterSpacing: "-.045em",
                      }}
                    >
                      {v.cta.acc}
                    </span>
                  </span>
                </h2>
                <p
                  data-reveal={"up"}
                  style={{
                    fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                    margin: "30px auto 0",
                    maxWidth: "560px",
                    fontSize: "clamp(16px,1.2vw,18px)",
                    lineHeight: "1.6",
                    color: "#CFC2DB",
                  }}
                >
                  {v.cta.body}
                </p>
                <div
                  data-reveal={"up"}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "16px",
                    marginTop: "48px",
                  }}
                >
                  <button
                    ref={v.magnetRef}
                    onClick={v.cta.go}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "24px",
                      minHeight: "60px",
                      padding: "9px 9px 9px 32px",
                      borderRadius: "999px",
                      background: "#EEE3F7",
                      color: "#28123B",
                      fontSize: "16px",
                      fontWeight: "600",
                      whiteSpace: "nowrap",
                      transition:
                        "transform .5s cubic-bezier(.22,1,.36,1), background .3s, box-shadow .5s",
                    }}
                    className={"reference-state-100"}
                  >
                    {v.cta.label}
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: "#28123B",
                        color: "#EEE3F7",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "18px" }}
                        className={"ph ph-arrow-up-right"}
                      ></i>
                    </span>
                  </button>
                  <button
                    onClick={v.cta.secondGo}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: "60px",
                      padding: "0 30px",
                      borderRadius: "999px",
                      border: "1px solid #D4B7EC55",
                      color: "#F6F1FA",
                      fontSize: "16px",
                      fontWeight: "600",
                      whiteSpace: "nowrap",
                      transition: "background .3s, border-color .3s",
                    }}
                    className={"reference-state-101"}
                  >
                    {v.cta.second}
                  </button>
                </div>
              </div>
            </section>
          </main>
          <></>
          <footer
            style={{
              position: "relative",
              isolation: "isolate",
              overflow: "clip",
              padding: "64px clamp(20px,4.4vw,64px) 32px",
              background: "#0d0814",
              color: "#f7f1fa",
            }}
          >
            <div
              style={{
                position: "absolute",
                zIndex: "-2",
                inset: "0",
                background:
                  "linear-gradient(180deg,#0d0814 0%,#0d0814f0 52%,#150a21cc 100%),radial-gradient(circle at 50% 105%,#54277e,transparent 60%)",
              }}
            ></div>
            <div
              data-aurora={""}
              style={{
                position: "absolute",
                zIndex: "-1",
                insetInlineStart: "7%",
                insetInlineEnd: "7%",
                bottom: "-230px",
                height: "430px",
                pointerEvents: "none",
                opacity: ".7",
                filter: "blur(42px)",
                background:
                  "radial-gradient(ellipse at 24% 62%,#8d4ce5 0%,#622ba380 27%,transparent 58%),radial-gradient(ellipse at 72% 58%,#bf78e4cc 0%,#7440c375 30%,transparent 60%)",
              }}
            ></div>
            <div
              style={{
                maxWidth: "1312px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "32px",
                paddingBottom: "32px",
                borderBottom: "1px solid #d8b8ed26",
              }}
            >
              <a
                href={toSiteHref("OrgTik%20Home.dc.html")}
                aria-label={attr("gl_footer|footer|a@aria-label")}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <img
                    src={"/assets/logo/orgtik-mark-white.svg"}
                    alt={""}
                    style={{
                      width: "38px",
                      height: "38px",
                      objectFit: "contain",
                    }}
                  />
                  <img
                    src={"/assets/logo/orgtik-wordmark-white.svg"}
                    alt={attr("gl_footer|footer|img@alt")}
                    style={{ width: "145px", height: "auto" }}
                  />
                </span>
              </a>
              <a
                href={toSiteHref("#top")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "16px",
                  color: "#cab9d5",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
              >
                <span>{run("gl_footer|footer|a", 1)}</span>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "46px",
                    height: "46px",
                    border: "1px solid #cba8e05c",
                    borderRadius: "50%",
                    transition:
                      "background 250ms, color 250ms, transform 350ms",
                  }}
                  className={"reference-state-102"}
                >
                  <i
                    aria-hidden={true}
                    style={{ fontSize: "20px" }}
                    className={"ph ph-arrow-up-right"}
                  ></i>
                </span>
              </a>
            </div>
            <div
              data-reveal={"stagger"}
              style={{
                maxWidth: "1312px",
                margin: "48px auto 0",
                display: "flex",
                flexWrap: "wrap",
                gap: "48px clamp(56px,8vw,116px)",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: "1 1 420px", minWidth: "0" }}>
                <h2
                  style={{
                    maxWidth: "520px",
                    fontSize: "var(--section-title-size)",
                    lineHeight: "1.12",
                    letterSpacing: "-.04em",
                    fontWeight: "500",
                  }}
                  data-hw={""}
                >
                  {run("gl_footer|footer|h2", 1)}
                  <em
                    data-acc={""}
                    style={{
                      color: "#c9a0f3",
                      fontStyle: "normal",
                      fontWeight: "500",
                    }}
                  >
                    {run("gl_footer|footer|h2", 4)}
                  </em>
                </h2>
                <p
                  style={{
                    fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                    maxWidth: "470px",
                    marginTop: "22px",
                    color: "#baabc5",
                    fontSize: "15px",
                    lineHeight: "1.75",
                  }}
                >
                  {run("gl_footer|footer|p", 1)}
                </p>
                <button
                  onClick={v.footTalk}
                  style={{
                    marginTop: "30px",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "24px",
                    minHeight: "50px",
                    padding: "7px 7px 7px 22px",
                    border: "1px solid #d4b7ec66",
                    borderRadius: "999px",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "12px",
                    fontWeight: "600",
                    lineHeight: "1.4",
                    transition:
                      "background 250ms, border-color 250ms, transform 350ms cubic-bezier(.22,1,.36,1)",
                  }}
                  className={"reference-state-103"}
                >
                  <span>{run("gl_footer|footer|button", 1)}</span>
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: "#eee3f7",
                      color: "#28123b",
                    }}
                  >
                    <i
                      aria-hidden={true}
                      style={{ fontSize: "18px" }}
                      className={"ph ph-arrow-up-right"}
                    ></i>
                  </span>
                </button>
              </div>
              <nav
                style={{
                  flex: "1 1 420px",
                  display: "grid",
                  gridTemplateColumns: "minmax(0,.85fr) minmax(0,1.15fr)",
                  gap: "40px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#bba4ca",
                      margin: "0 0 18px",
                      lineHeight: "1.5",
                    }}
                  >
                    {run("gl_footer|footer|h3", 1)}
                  </h3>
                  {(v.footExplore || []).map((fl, flIndex) => (
                    <React.Fragment key={flIndex}>
                      <a
                        href={toSiteHref(fl.href)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: "38px",
                          padding: "7px 0",
                          color: "#f2e8f8",
                          fontSize: "16px",
                          fontWeight: "450",
                          lineHeight: "1.5",
                          textUnderlineOffset: "6px",
                          transition: "color 250ms",
                        }}
                        className={"reference-state-104"}
                      >
                        {fl.label}
                      </a>
                    </React.Fragment>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#bba4ca",
                      margin: "0 0 18px",
                      lineHeight: "1.5",
                    }}
                  >
                    {run("gl_footer|footer|h3-2", 1)}
                  </h3>
                  {(v.footStart || []).map((fl, flIndex) => (
                    <React.Fragment key={flIndex}>
                      <a
                        href={toSiteHref(fl.href)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: "38px",
                          padding: "7px 0",
                          color: "#f2e8f8",
                          fontSize: "16px",
                          fontWeight: "450",
                          lineHeight: "1.5",
                          textUnderlineOffset: "6px",
                          transition: "color 250ms",
                        }}
                        className={"reference-state-105"}
                      >
                        {fl.label}
                      </a>
                    </React.Fragment>
                  ))}
                </div>
              </nav>
            </div>
            <div
              style={{
                maxWidth: "1312px",
                margin: "48px auto 0",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "24px 32px",
                paddingTop: "28px",
                borderTop: "1px solid #d8b8ed26",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {(v.socials || []).map((so, soIndex) => (
                  <React.Fragment key={soIndex}>
                    <span
                      title={so.name}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "46px",
                        height: "46px",
                        border: "1px solid #d2afe533",
                        borderRadius: "50%",
                        color: "#f7f1fa",
                        transition: "background 250ms, border-color 250ms",
                      }}
                      className={"reference-state-106"}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "22px" }}
                        className={so.cls}
                      ></i>
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "#e0cfea",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    flex: "0 0 20px",
                    width: "20px",
                    height: "20px",
                    background: "#da291c",
                  }}
                  className={"reference-state-107 reference-state-108"}
                ></span>
                {"Made in Switzerland"}
              </span>
            </div>
            <div
              style={{
                maxWidth: "1312px",
                margin: "28px auto 0",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "12px 24px",
                fontSize: "12px",
                lineHeight: "1.6",
                color: "#b9a6c7",
              }}
            >
              <span>{run("gl_footer|footer|div", 1)}</span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "9px" }}
              >
                <i
                  aria-hidden={true}
                  style={{
                    width: "6px",
                    height: "6px",
                    background: "#d2a3fa",
                    borderRadius: "50%",
                  }}
                ></i>
                {run("gl_footer|footer|div", 5)}
              </span>
              <span>{run("gl_footer|footer|div", 8)}</span>
            </div>
          </footer>
        </div>
      </>, "pg_services")
    );
  }
}
