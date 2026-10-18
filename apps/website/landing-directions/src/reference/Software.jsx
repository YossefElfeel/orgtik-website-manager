import { managedPageTree } from "../content/managed-page";
import { content } from "../content";
import {
  findItem,
  money,
  groupFromIds,
  configurationHref,
  BUNDLES as PURCHASE_BUNDLES,
} from "./purchase-catalog.js";
import { PurchasingOverview, PackageSection } from "./PurchaseUI";
import { Testimonials } from "./Testimonials";
import { ContentHeading } from "./ContentHeading";
import React from "react";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";
import { ReferencePage } from "./ReferencePage";
import { toSiteHref, readWorkspaceQuery } from "./navigation";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";
import { routeHash, setRoute } from "./navigation";

import {
  SOFTWARE_MODES,
  SOFTWARE_PRODUCTS,
  SOFTWARE_TERMS,
  getSoftwareMode,
  recommendSoftwarePlan,
  softwareModeOf,
} from "./software-catalog";

export default class Software extends ReferencePage {
  MODS = SOFTWARE_PRODUCTS;
  PLAN_OPTIONS = SOFTWARE_MODES;
  DURATIONS = SOFTWARE_TERMS;
  CONNECT = {
    hr: ["tasks", "files"],
    crm: ["marketing", "website"],
    files: ["tasks", "hr"],
    tasks: ["files", "hr"],
    marketing: ["crm", "website"],
    website: ["marketing", "crm"],
  };
  STEPS = content.SOFTWARE_STEPS();
  FLOW = content.FLOW();
  CTX = content.CTX();
  UC_IMGS = [
    "brand-tablet.webp",
    "brand-cards.webp",
    "brand-glass.webp",
    "brand-phone.webp",
  ];
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";
  HOME = "OrgTik%20Home.dc.html";
  state = {
    route: this.parseRoute(routeHash()) || { view: "overview" },
    mode: "single",
    selected: ["hr"],
    duration: "annual",
    prodDur: "annual",
    // Start on the recommended plan; it never switches by itself afterwards.
    plan:
      recommendSoftwarePlan(readWorkspaceQuery().selected || ["hr"])?.planId ||
      "starter",
    compare: null,
    mod: 0,
    lineDeg: -90,
    uc: 0,
    flow: 0,
    hoverCard: null,
    narrow: window.innerWidth < 900,
    xwide: window.innerWidth >= 1180,
    menuOpen: false,
    ...readWorkspaceQuery(),
  };
  rootRef = React.createRef();
  headerRef = React.createRef();
  videoRef = React.createRef();
  heroMediaRef = React.createRef();
  parallaxRef = React.createRef();
  explorerRef = React.createRef();
  closingRef = React.createRef();
  glowRef = React.createRef();
  magnetRef = React.createRef();
  cursorRef = React.createRef();
  cursorBubble = React.createRef();

  parseRoute(hash) {
    const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
    if (["plan-builder", "software-bundles"].includes(h))
      return { view: "overview" };
    if (h === "") return { view: "overview" };
    if (h.charAt(0) !== "/") return null;
    const p = h.slice(1).split("/"),
      ids = this.MODS.map((m) => m.id);
    if (p[0] === "product" && ids.indexOf(p[1]) >= 0)
      return { view: "product", id: p[1] };
    if (p[0] === "plans")
      return {
        view: "plans",
        mode: getSoftwareMode(p[1])?.id || "custom",
        duration: this.DURATIONS.some((d) => d.id === p[2]) ? p[2] : "annual",
        modules: (p[3] || "").split(",").filter((x) => ids.indexOf(x) >= 0),
      };
    return { view: "overview" };
  }
  // The billing term is left out so switching it on the compare view keeps the scroll position.
  routeKey(r) {
    return [r.view, r.id || "", r.mode || "", (r.modules || []).join(",")].join(
      "|",
    );
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
      if (["#plan-builder", "#software-bundles"].includes(routeHash()))
        this.pendingScroll = routeHash().slice(1);
      if (!r) return;
      this.setState((s) => ({
        route: r,
        menuOpen: false,
        uc:
          r.view === "product" &&
          (s.route.view !== "product" || s.route.id !== r.id)
            ? 0
            : s.uc,
      }));
    };
    window.addEventListener("hashchange", this.onHash);
    if (!routeHash() && this.props.screen && this.props.screen !== "Overview")
      this.applyScreen();
    this.afterView(true);
    this.srcMO = new MutationObserver(() => this.applyDataSrc());
    this.srcMO.observe(root, { childList: true, subtree: true });
    this.flowT = setInterval(() => {
      if (
        this.state.route.view === "overview" &&
        !this.reduced &&
        !document.hidden &&
        !this.flowHover
      )
        this.setState((st) => ({ flow: (st.flow + 1) % 6 }));
    }, 3400);
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    if (this.routeKey(ps.route) !== this.routeKey(this.state.route)) {
      const target = this.pendingScroll;
      this.pendingScroll = null;
      const c = this.cursorRef.current;
      if (c) c.style.opacity = "0";
      requestAnimationFrame(() => {
        if (target) this.go(target);
        else window.scrollTo({ top: 0, behavior: "instant" });
        this.afterView(false);
      });
    }
    this.applyDataSrc();
    if (
      ps.selected !== this.state.selected ||
      ps.duration !== this.state.duration ||
      ps.plan !== this.state.plan
    )
      this.syncBuilderUrl();
    if (ps.mod !== this.state.mod) {
      this.startModTimer();
      this.swapIn("[data-swap]");
    }
    if (ps.uc !== this.state.uc) this.swapIn("[data-uc-swap]");
    if (ps.flow !== this.state.flow && this.state.flow > ps.flow) {
      const root = this.rootRef.current,
        list = root && root.querySelector("[data-ctx-list]");
      if (list && !this.reduced)
        Array.from(list.children)
          .slice(-this.CTX.filter((x) => x[0] === this.state.flow).length)
          .forEach((el, i) =>
            el.animate(
              [
                {
                  opacity: 0,
                  filter: "blur(8px)",
                  transform: "translateY(10px) scale(.96)",
                },
                { opacity: 1, filter: "blur(0px)", transform: "none" },
              ],
              {
                duration: 700,
                delay: i * 90,
                easing: this.E,
                fill: "backwards",
              },
            ),
          );
    }
    if (pp.screen !== this.props.screen) this.applyScreen();
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    clearInterval(this.flowT);
    if (this.srcMO) this.srcMO.disconnect();
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    window.removeEventListener("hashchange", this.onHash);
    document.removeEventListener("visibilitychange", this.onVis);
    [this.io, this.modIO, this.heroIO].forEach((o) => o && o.disconnect());
    if (this.modAnim) this.modAnim.cancel();
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
    setTimeout(() => this.applyDataSrc(), 400);
    this.observeReveals();
    this.bindCursors();
    this.setupLoops();
    this.attachModIO();
    this.startModTimer();
    this.heroIntro(first);
  }
  applyScreen() {
    const v = this.props.screen || msg("Software:1"),
      s = this.state;
    if (v === "Plans") {
      setRoute(
        "#/plans/" +
          this.modeOf(s.selected) +
          "/" +
          s.duration +
          "/" +
          s.selected.join(","),
      );
      return;
    }
    const m = this.MODS.find((x) => "Product — " + x.formal === v);
    setRoute(m ? "#/product/" + m.id : "#/");
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
    const group = groupFromIds("software", sel || [], months);
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
  syncFlow() {
    if (!this.state.xwide || this.state.route.view !== "overview") return;
    const root = this.rootRef.current,
      sec = root && root.querySelector("#workspace");
    if (!sec) return;
    const sr = sec.getBoundingClientRect();
    if (sr.bottom < 0 || sr.top > window.innerHeight) return;
    const mid = window.innerHeight * 0.45;
    let best = 0,
      bd = Infinity;
    root.querySelectorAll("[data-flow-step]").forEach((el, i) => {
      const r = el.getBoundingClientRect(),
        d = Math.abs(r.top + Math.min(r.height, 110) / 2 - mid);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best !== this.state.flow) this.setState({ flow: best });
  }
  pickFlow(i) {
    if (this.state.flow !== i) this.setState({ flow: i });
    if (!this.state.xwide) return;
    const el =
      this.rootRef.current &&
      this.rootRef.current.querySelectorAll("[data-flow-step]")[i];
    if (!el) return;
    window.scrollTo({
      top:
        el.getBoundingClientRect().top +
        window.scrollY -
        window.innerHeight * 0.45 +
        50,
      behavior: this.reduced ? "auto" : "smooth",
    });
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
  attachModIO() {
    if (this.modIO) this.modIO.disconnect();
    this.modVisible = false;
    const ex = this.explorerRef.current;
    if (!ex) return;
    this.modIO = new IntersectionObserver(
      ([e]) => {
        this.modVisible = e.isIntersecting;
        if (this.modAnim)
          e.isIntersecting ? this.modAnim.play() : this.modAnim.pause();
      },
      { threshold: 0.3 },
    );
    this.modIO.observe(ex);
  }
  startModTimer() {
    if (this.modAnim) {
      this.modAnim.onfinish = null;
      this.modAnim.cancel();
      this.modAnim = null;
    }
    const root = this.rootRef.current;
    if (!root || this.reduced) return;
    const bar = root.querySelector(
      '[data-mod-timer="' + this.MODS[this.state.mod].id + '"]',
    );
    if (!bar) return;
    this.modAnim = bar.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: 8000, easing: "linear", fill: "forwards" },
    );
    if (!this.modVisible) this.modAnim.pause();
    this.modAnim.onfinish = () => this.selectMod((this.state.mod + 1) % 6);
  }
  selectMod(i) {
    this.setState((s) => {
      const t = -90 + i * 60,
        d = ((((t - s.lineDeg) % 360) + 540) % 360) - 180;
      return { mod: i, lineDeg: s.lineDeg + d };
    });
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

  onReq() {
    return this.props.prices === "On request";
  }
  chf(v) {
    return this.onReq()
      ? msg("Software:2")
      : msg("Software:3", [
          new Intl.NumberFormat("de-CH").format(Math.round(v)),
        ]);
  }

  modeOf(sel) {
    return softwareModeOf(sel);
  }

  // Keep the workspace builder shareable and restorable after refresh.
  syncBuilderUrl() {}

  renderVals() {
    const s = this.state,
      r = s.route,
      v = r.view,
      H = this.HOME;
    const M = v === "product" ? this.MODS.find((m) => m.id === r.id) : null;
    const byId = (id) => this.MODS.find((m) => m.id === id);
    const split = (t) => t.split(/(?<=\.) /);
    const modeName = (id) =>
      (this.PLAN_OPTIONS.find((o) => o.id === id) || {}).name;
    const durLabel = (id) =>
      (this.DURATIONS.find((d) => d.id === id) || this.DURATIONS[1]).label;
    const card = (m, ctx) => {
      const k = ctx + m.id,
        on = s.hoverCard === k;
      return {
        id: m.id,
        num: m.number,
        short: m.short,
        href: "#/product/" + m.id,
        image: m.image,
        icon: m.icon,
        name: m.name,
        formal: m.formal,
        desc: m.description,
        sub:
          ctx === "rel"
            ? msg("Software:4", [m.category, M ? M.formal : ""])
            : m.number + " · " + m.category,
        price: this.onReq()
          ? msg("Software:5")
          : msg("Software:6", [money(findItem(m.id, "software").monthlyMinor)]),
        imgT: on ? "scale(1.06)" : "scale(1)",
        arrowBg: on ? "#EEE3F7" : "#0D081459",
        arrowC: on ? "#28123B" : "#F6F1FA",
        arrowT: on ? "rotate(45deg)" : "none",
        enter: () => this.setState({ hoverCard: k }),
        leave: () => this.setState({ hoverCard: null }),
      };
    };
    let hero;
    if (M) {
      const p = split(M.title);
      hero = {
        hasCrumb: true,
        crumb: M.formal,
        crumbRootC: "#B5A6C4",
        eyebrow: msg("Software:7", [M.formal, M.category]),
        l1: p[0],
        l2: "",
        acc: p[1] || M.short,
        body: M.description,
        primary: msg("Software:8", [M.formal]),
        primaryGo: () => this.go("plans-section"),
        secondary: msg("Software:9"),
        secondaryGo: () => this.goBuilder("custom", [M.id]),
        showStrip: false,
        noStrip: true,
        stripLabel: msg("Software:10"),
        links: [],
        tags: M.tasks,
      };
    } else if (v === "plans") {
      const sel = r.modules.map(byId);
      hero = {
        hasCrumb: true,
        crumb: msg("Software:11"),
        crumbRootC: "#B5A6C4",
        eyebrow: msg("Software:12"),
        l1: msg("Software:13"),
        l2: "",
        acc: msg("Software:14"),
        body: msg("Software:15"),
        primary: msg("Software:16"),
        primaryGo: () => this.go("plan-builder"),
        secondary: "Edit your systems",
        secondaryGo: () => this.goBuilder(r.mode, r.modules, r.duration),
        showStrip: true,
        noStrip: false,
        stripLabel: sel.length ? "Your systems" : "No systems yet",
        links: sel.map((m) => ({
          href: "#/product/" + m.id,
          icon: m.icon,
          label: m.formal,
        })),
        tags: [],
      };
    } else
      hero = {
        hasCrumb: false,
        crumb: "",
        crumbRootC: "#FFFFFF",
        eyebrow: msg("Software:17"),
        l1: msg("Software:18"),
        l2: "Six systems.",
        acc: msg("Software:19"),
        body: msg("Software:20"),
        primary: msg("Software:21"),
        primaryGo: () => this.go("plan-builder"),
        secondary: msg("Software:22"),
        secondaryGo: () => this.go("workspace"),
        showStrip: false,
        noStrip: true,
        stripLabel: "Six systems",
        links: this.MODS.map((m) => ({
          href: "#/product/" + m.id,
          icon: m.icon,
          label: m.formal,
        })),
        tags: [],
      };
    Object.assign(
      hero,
      M
        ? {
            panelTitle: M.formal + " includes",
            items: M.tasks.map((t) => ({
              icon: "ph-check-circle",
              label: t,
              meta: "",
              href: "#/product/" + M.id,
            })),
            panelNote: this.onReq()
              ? msg("Software:23")
              : msg("Software:24", [
                  money(findItem(M.id, "software").monthlyMinor),
                  M.category,
                ]),
          }
        : v === "plans"
          ? {
              panelTitle: "Your systems",
              items: r.modules.map(byId).map((m) => ({
                icon: m.icon,
                label: m.formal,
                meta: m.category,
                href: "#/product/" + m.id,
              })),
              panelNote: modeName(r.mode) + " · " + durLabel(r.duration),
            }
          : {
              panelTitle: "Six systems",
              items: this.MODS.map((m) => ({
                icon: m.icon,
                label: m.formal,
                meta: m.category,
                href: "#/product/" + m.id,
              })),
              panelNote: msg("Software:25"),
            },
    );
    const MM = this.MODS[s.mod],
      mp = split(MM.title);

    let pm = {
      id: "",
      formal: "",
      short: "",
      desc: "",
      image: "brand-phone.webp",
      icon: "ph-squares-four",
      hl1: { title: "", body: "", task: "" },
      hlRest: [],
      ucs: [],
      ucTitle: "",
      ucBody: "",
      related: [],
    };
    if (M) {
      const imgs = [M.image].concat(this.UC_IMGS.filter((x) => x !== M.image));
      pm = {
        id: M.id,
        formal: M.formal,
        short: M.short,
        desc: M.description,
        image: M.image,
        icon: M.icon,
        hl1: {
          title: M.highlights[0].title,
          body: M.highlights[0].body,
          task: M.tasks[0],
        },
        hlRest: M.highlights.slice(1).map((h, i) => ({
          n: "0" + (i + 2),
          title: h.title,
          body: h.body,
          task: M.tasks[i + 1],
          icon: i ? "ph-sparkle" : "ph-circles-three-plus",
          col: s.narrow ? "auto" : "8 / span 5",
          row: s.narrow ? "auto" : String(i + 1),
        })),
        ucs: M.useCases.map((u, i) => {
          const on = s.uc === i;
          return {
            n: "0" + (i + 1),
            title: u.title,
            body: u.body,
            image: imgs[i % imgs.length],
            slot: M.id + "-uc-" + (i + 1),
            o: on ? 1 : 0,
            pe: on ? "auto" : "none",
            bg: on ? "#ffffff0d" : "transparent",
            border: on ? "#D4B7EC4d" : "#ffffff14",
            numBg: on ? "#EEE3F7" : "transparent",
            numC: on ? "#28123B" : "#D4B7EC",
            titleC: on ? "#FFFFFF" : "#CFC2DB",
            select: () => {
              if (this.state.uc !== i) this.setState({ uc: i });
            },
          };
        }),
        ucTitle: M.useCases[s.uc].title,
        ucBody: M.useCases[s.uc].body,
        related: this.CONNECT[M.id].map((id) => card(byId(id), "rel")),
      };
    }
    const toContact = () => {
      window.__orgNav
        ? window.__orgNav("Contact.dc.html")
        : (location.href = "Contact.dc.html");
    };
    const cta = M
      ? {
          eyebrow: msg("Software:26"),
          l1: msg("Software:27", [M.formal]),
          acc: msg("Software:28"),
          body: msg("Software:29", [M.formal]),
          label: msg("Software:30", [M.formal]),
          go: () => this.go("plans-section"),
          second: msg("Software:31"),
          secondGo: toContact,
        }
      : v === "plans"
        ? {
            eyebrow: msg("Software:32"),
            l1: msg("Software:33"),
            acc: msg("Software:34"),
            body: msg("Software:35"),
            label: msg("Software:36"),
            go: () => this.go("plan-builder"),
            second: "Edit your systems",
            secondGo: () => this.goBuilder(null, r.modules, r.duration),
          }
        : {
            eyebrow: msg("Software:37"),
            l1: msg("Software:38"),
            acc: msg("Software:39"),
            body: msg("Software:40"),
            label: msg("Software:41"),
            go: toContact,
            second: msg("Software:42"),
            secondGo: () => this.go("plan-builder"),
          };
    return {
      isOverview: v === "overview",
      isProduct: v === "product",

      showPlans: v === "product" || v === "plans",
      xwide: !!s.xwide,
      notXwide: !s.xwide,

      menuOpen: s.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      menuLinks: [
        ["Home", "OrgTik%20Home.dc.html"],
        ["Services", "Services.dc.html"],
        ["Software", "#/"],
        ["Work", "Work.dc.html"],
        ["About", "About.dc.html"],
        ["Insights", "Insights.dc.html"],
      ].map((x) => ({ label: x[0], href: x[1] })),
      hero: hero,
      tickerLabel: msg("Software:43"),
      tickerList: [0, 1].map(() =>
        this.MODS.map((m) => m.formal).concat(
          PURCHASE_BUNDLES.filter((b) => b.kind === "software").map(
            (b) => b.name,
          ),
        ),
      ),

      flow: this.FLOW.map((f, i) => {
        const on = s.flow === i,
          past = i < s.flow;
        return {
          n: "0" + (i + 1),
          icon: f[0],
          mod: f[1],
          short: f[1].split(" · ")[0],
          title: f[2],
          body: f[3],
          bg: on ? "#ffffff0b" : "transparent",
          border: on ? "#D4B7EC4d" : "#ffffff14",
          nodeBg: on ? "#EEE3F7" : past ? "#3B1E59" : "#190B25",
          nodeC: on ? "#28123B" : "#D4B7EC",
          nodeB: on || past ? "#D4B7EC" : "#D4B7EC3d",
          glow: on ? "0 0 0 8px #EEE3F71a, 0 0 44px #9458F48c" : "none",
          first: i === 0,
          bodyD: on ? "block" : "none",
          titleC: on ? "#FFFFFF" : "#CFC2DB",
          labelC: on || past ? "#FFFFFF" : "#9D8BAE",
          select: () => {
            if (this.state.flow !== i) this.setState({ flow: i });
          },
        };
      }),
      trackW: (s.flow / 5) * 100 + "%",
      ctxItems: this.CTX.filter((x) => x[0] <= s.flow).map((x) => {
        const fresh = x[0] === s.flow;
        return {
          icon: x[1],
          label: x[2],
          from: this.FLOW[x[0]][1].split(" · ")[0],
          bg: fresh ? "#EEE3F7" : "#ffffff0a",
          c: fresh ? "#28123B" : "#E9E0F0",
          border: fresh ? "#EEE3F7" : "#ffffff1f",
        };
      }),
      ctxCount: msg("Software:44", [
        this.CTX.filter((x) => x[0] <= s.flow).length,
      ]),
      flowNow: [
        msg("Software:45"),
        msg("Software:46"),
        msg("Software:47"),
        msg("Software:48"),
        msg("Software:49"),
        msg("Software:50"),
      ][s.flow],
      flowEnter: () => {
        this.flowHover = true;
      },
      flowLeave: () => {
        this.flowHover = false;
      },

      steps: this.STEPS,
      nsNum: v === "plans" ? "02" : "04",
      pm: pm,
      goDemo: () => this.go("demo"),
      bentoCols: s.narrow ? "minmax(0,1fr)" : "repeat(12,minmax(0,1fr))",
      bentoRows: s.narrow ? "none" : "minmax(300px,auto) minmax(300px,auto)",
      bentoL: s.narrow ? "auto" : "1 / span 7",
      bentoLR: s.narrow ? "auto" : "1 / span 2",

      cta: cta,
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
        ["Software", "/software"],
        ["Services", "/services"],
        ["Selected work", "/work"],
        ["Insights", "/insights"],
        ["About OrgTik", "/about"],
      ].map(([label, href]) => ({ label, href })),
      footStart: [
        ["Build a software plan", "/software#plan-builder"],
        ["Bundles & pricing", "/plans"],
        ["Tell us about your project", "/contact"],
        ["Roadmap", "/roadmap"],
        ["Imprint", "/legal/imprint"],
      ].map(([label, href]) => ({ label, href })),
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
          data-screen-label={"Software"}
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
                {run("pg_software|intro|div", 2)}
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
                      className={"reference-state-28"}
                    >
                      {run("gl_header|header|a", 1)}
                    </a>
                    <a
                      href={toSiteHref("Services.dc.html")}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#DCD0E6",
                        whiteSpace: "nowrap",
                        transition: "background .3s, color .3s",
                      }}
                      className={"reference-state-29"}
                    >
                      {run("gl_header|header|a-2", 1)}
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
                      className={"reference-state-30"}
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
                      className={"reference-state-31"}
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
                      className={"reference-state-32"}
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
                      className={"reference-state-33"}
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
                      className={"reference-state-35"}
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
                    alt={attr("pg_software|intro|img@alt")}
                    style={{ width: "104px" }}
                  />
                  <button
                    aria-label={attr("pg_software|intro|button@aria-label")}
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
                  {run("pg_software|intro|a", 1)}
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
                          className={"reference-state-36"}
                        >
                          {run("pg_software|hero|a", 1)}
                        </a>
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "12px", opacity: ".7" }}
                          className={"ph ph-caret-right"}
                        ></i>
                        <a
                          href={toSiteHref("#/")}
                          style={{ color: String(v.hero.crumbRootC) }}
                          className={"reference-state-37"}
                        >
                          {run("pg_software|hero|a-2", 1)}
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
                          className={"reference-state-38"}
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
                          className={"reference-state-39"}
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
                                className={"reference-state-40"}
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
                <section data-cms-section="workspace"
                  id={"workspace"}
                  data-screen-label={"Software — How it connects"}
                  style={{
                    position: "relative",
                    overflow: "clip",
                    borderTop: "1px solid #ffffff12",
                    background:
                      "radial-gradient(70% 60% at 85% 20%,#3B1E5999,transparent 65%),#0D0814",
                    padding: "var(--section-space) 0",
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
                            {run("pg_software|workspace|div", 2)}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {run("pg_software|workspace|div", 7)}
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
                              {run("pg_software|workspace|h2", 3)}
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
                              {run("pg_software|workspace|h2", 9)}
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "400px",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {run("pg_software|workspace|p", 1)}
                      </p>
                    </div>
                    <div
                      onMouseEnter={v.flowEnter}
                      onMouseLeave={v.flowLeave}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        gap: "20px",
                      }}
                    >
                      <div
                        data-reveal={"stagger"}
                        style={{
                          flex: "1 1 360px",
                          minWidth: "0",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {(v.flow || []).map((f, fIndex) => (
                          <React.Fragment key={fIndex}>
                            <button
                              onMouseEnter={f.select}
                              onClick={f.select}
                              onFocus={f.select}
                              style={{
                                position: "relative",
                                flex: "none",
                                display: "flex",
                                gap: "18px",
                                alignItems: "center",
                                padding: "12px 18px",
                                borderRadius: "20px",
                                border: "1px solid " + f.border,
                                background: String(f.bg),
                                color: "#F6F1FA",
                                textAlign: "start",
                                transition:
                                  "all .45s cubic-bezier(.22,1,.36,1)",
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: "0",
                                  display: "grid",
                                  placeItems: "center",
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "50%",
                                  border: "1px solid " + f.nodeB,
                                  background: String(f.nodeBg),
                                  color: String(f.nodeC),
                                  transition: "all .45s",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "18px" }}
                                  className={"ph " + f.icon}
                                ></i>
                              </span>
                              <span style={{ minWidth: "0" }}>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    letterSpacing: ".16em",
                                    textTransform: "uppercase",
                                    color: "#C9A0F3",
                                  }}
                                >
                                  {f.n + " · " + f.mod}
                                  {f.first && (
                                    <>
                                      <span
                                        style={{
                                          marginInlineStart: "10px",
                                          padding: "3px 8px",
                                          borderRadius: "999px",
                                          background: "#EEE3F7",
                                          color: "#28123B",
                                          fontSize: "10px",
                                          letterSpacing: ".12em",
                                          verticalAlign: "1px",
                                        }}
                                      >
                                        {"Start here"}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <span
                                  data-hw={""}
                                  style={{
                                    display: "block",
                                    marginTop: "6px",
                                    fontSize: "18px",
                                    fontWeight: "500",
                                    letterSpacing: "-.025em",
                                    color: String(f.titleC),
                                    transition: "color .4s",
                                  }}
                                >
                                  {f.title}
                                </span>
                                <span
                                  style={{
                                    fontFamily:
                                      '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                    display: String(f.bodyD),
                                    marginTop: "6px",
                                    fontSize: "15px",
                                    lineHeight: "1.55",
                                    color: "#B5A6C4",
                                  }}
                                >
                                  {f.body}
                                </span>
                              </span>
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                      <div
                        data-reveal={"clip"}
                        style={{
                          flex: "1.3 1 480px",
                          minWidth: "0",
                          display: "flex",
                          flexDirection: "column",
                          gap: "26px",
                          padding: "clamp(22px,2.6vw,34px)",
                          borderRadius: "26px",
                          border: "1px solid #ffffff1f",
                          background: "linear-gradient(160deg,#1A0D27,#0D0814)",
                          boxShadow: "0 40px 90px #0904118c",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              insetInlineStart: "8.333%",
                              insetInlineEnd: "8.333%",
                              top: "24px",
                              height: "2px",
                              background: "#ffffff1a",
                              borderRadius: "2px",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                height: "100%",
                                width: String(v.trackW),
                                background:
                                  "linear-gradient(90deg,#9458F4,#D4B7EC)",
                                borderRadius: "2px",
                                transition:
                                  "width .9s cubic-bezier(.22,1,.36,1)",
                              }}
                            ></span>
                          </span>
                          {(v.flow || []).map((f, fIndex) => (
                            <React.Fragment key={fIndex}>
                              <button
                                onClick={f.select}
                                style={{
                                  position: "relative",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "10px",
                                  color: "#F6F1FA",
                                }}
                              >
                                <span
                                  style={{
                                    display: "grid",
                                    placeItems: "center",
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "50%",
                                    border: "1px solid " + f.nodeB,
                                    background: String(f.nodeBg),
                                    color: String(f.nodeC),
                                    boxShadow: String(f.glow),
                                    transition:
                                      "all .6s cubic-bezier(.22,1,.36,1)",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "19px" }}
                                    className={"ph " + f.icon}
                                  ></i>
                                </span>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: String(f.labelC),
                                    textAlign: "center",
                                    transition: "color .4s",
                                  }}
                                >
                                  {f.short}
                                </span>
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                        <div
                          style={{
                            flex: "1",
                            display: "flex",
                            flexDirection: "column",
                            gap: "18px",
                            padding: "22px",
                            borderRadius: "20px",
                            background: "#0D0814b3",
                            border: "1px solid #ffffff17",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "14px",
                            }}
                          >
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "46px",
                                height: "46px",
                                borderRadius: "14px",
                                background: "#EEE3F7",
                                color: "#28123B",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "20px" }}
                                className={"ph ph-buildings"}
                              ></i>
                            </span>
                            <span>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "16px",
                                  fontWeight: "600",
                                }}
                              >
                                {"Customer record"}
                              </span>
                              <span
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  display: "block",
                                  marginTop: "2px",
                                  fontSize: "13px",
                                  color: "#B5A6C4",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {"Shared across every module"}
                              </span>
                            </span>
                            <span
                              style={{
                                marginInlineStart: "auto",
                                padding: "7px 12px",
                                borderRadius: "999px",
                                background: "#ffffff12",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#D4B7EC",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {v.ctxCount}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              letterSpacing: ".16em",
                              textTransform: "uppercase",
                              color: "#9D8BAE",
                            }}
                          >
                            {run("pg_software|workspace|div-2", 1)}
                          </div>
                          <div
                            data-ctx-list={""}
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              alignContent: "flex-start",
                              minHeight: "148px",
                            }}
                          >
                            {(v.ctxItems || []).map((x, xIndex) => (
                              <React.Fragment key={xIndex}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "9px 13px",
                                    borderRadius: "12px",
                                    border: "1px solid " + x.border,
                                    background: String(x.bg),
                                    color: String(x.c),
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    whiteSpace: "nowrap",
                                    transition:
                                      "all .5s cubic-bezier(.22,1,.36,1)",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "16px" }}
                                    className={"ph " + x.icon}
                                  ></i>
                                  {x.label}
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      opacity: ".7",
                                    }}
                                  >
                                    {x.from}
                                  </span>
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                          <div
                            style={{
                              marginTop: "auto",
                              paddingTop: "16px",
                              borderTop: "1px solid #ffffff14",
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "#E9E0F0",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{
                                color: "#D4B7EC",
                                marginInlineEnd: "8px",
                              }}
                              className={"ph ph-arrow-right"}
                            ></i>
                            {v.flowNow}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      data-reveal={"up"}
                      style={{
                        marginTop: "clamp(48px,5vw,72px)",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(min(100%,260px),1fr))",
                        gap: "1px",
                        background: "#ffffff17",
                        border: "1px solid #ffffff17",
                        borderRadius: "22px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "22px 24px",
                          background: "#0D0814",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "20px", color: "#D4B7EC" }}
                          className={"ph ph-compass"}
                        ></i>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "500",
                            lineHeight: "1.4",
                          }}
                        >
                          {run("pg_software|workspace|div-3", 3)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "22px 24px",
                          background: "#0D0814",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "20px", color: "#D4B7EC" }}
                          className={"ph ph-user-circle-gear"}
                        ></i>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "500",
                            lineHeight: "1.4",
                          }}
                        >
                          {run("pg_software|workspace|div-4", 3)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "22px 24px",
                          background: "#0D0814",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "20px", color: "#D4B7EC" }}
                          className={"ph ph-shield-check"}
                        ></i>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "500",
                            lineHeight: "1.4",
                          }}
                        >
                          {run("pg_software|workspace|div-5", 3)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
                <PurchasingOverview kind="software" />
              </>
            )}
            {v.isProduct && (
              <>
                <section data-cms-section="capabilities"
                  id={"capabilities"}
                  data-screen-label={"Software — Product capabilities"}
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
                            {run("pg_software|capabilities|div", 2)}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {run("pg_software|capabilities|div", 7)}
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
                              {v.pm.short}
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
                              {msg("Software:51", [v.pm.formal])}
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
                          maxWidth: "400px",
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
                          {v.pm.desc}
                        </p>
                        <button
                          onClick={v.goDemo}
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
                          className={"reference-state-48"}
                        >
                          {msg("Software:52", [v.pm.formal])}
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              background: "#28123B",
                              color: "#EEE3F7",
                              flexShrink: "0",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "16px" }}
                              className={"ph ph-arrow-up-right"}
                            ></i>
                          </span>
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: String(v.bentoCols),
                        gridTemplateRows: String(v.bentoRows),
                        gridAutoRows: "minmax(260px,auto)",
                        gap: "clamp(16px,1.6vw,22px)",
                      }}
                    >
                      <article
                        data-reveal={"clip"}
                        style={{
                          position: "relative",
                          gridColumn: String(v.bentoL),
                          gridRow: String(v.bentoLR),
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "24px",
                          padding: "clamp(24px,2.4vw,34px)",
                          borderRadius: "24px",
                          overflow: "hidden",
                          isolation: "isolate",
                          background: "#1A0D27",
                          color: "#F6F1FA",
                          minHeight: "364px",
                        }}
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
                            id={"sw-" + v.pm.id + "-hl"}
                            shape={"rect"}
                            data-src={"/assets/" + v.pm.image}
                            placeholder={msg("Software:53", [v.pm.formal])}
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
                              "linear-gradient(180deg,#0D081466 0%,#0D081400 30%,#0D0814f0 88%)",
                          }}
                        ></span>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            pointerEvents: "none",
                          }}
                        >
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "46px",
                              height: "46px",
                              borderRadius: "14px",
                              background: "#EEE3F7",
                              color: "#28123B",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "19px" }}
                              className={"ph ph-lightning"}
                            ></i>
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#DCD0E6",
                            }}
                          >
                            {"01"}
                          </span>
                        </div>
                        <div
                          style={{ pointerEvents: "none", maxWidth: "560px" }}
                        >
                          <h3
                            data-hw={""}
                            style={{
                              fontSize: "clamp(26px,2.46vw,37px)",
                              lineHeight: "1.02",
                              fontWeight: "500",
                              letterSpacing: "-.04em",
                            }}
                          >
                            {v.pm.hl1.title}
                          </h3>
                          <p
                            style={{
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              marginTop: "14px",
                              fontSize: "16px",
                              lineHeight: "1.6",
                              color: "#DCD0E6",
                            }}
                          >
                            {v.pm.hl1.body}
                          </p>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "22px",
                              padding: "9px 14px",
                              borderRadius: "999px",
                              background: "#EEE3F71f",
                              border: "1px solid #ffffff2b",
                              fontSize: "13px",
                              fontWeight: "600",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ color: "#D4B7EC" }}
                              className={"ph-fill ph-check-circle"}
                            ></i>
                            {v.pm.hl1.task}
                          </span>
                        </div>
                      </article>
                      {(v.pm.hlRest || []).map((h, hIndex) => (
                        <React.Fragment key={hIndex}>
                          <article
                            data-reveal={"up"}
                            style={{
                              gridColumn: String(h.col),
                              gridRow: String(h.row),
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "36px",
                              padding: "clamp(24px,2.4vw,32px)",
                              borderRadius: "24px",
                              border: "1px solid #ffffff17",
                              background:
                                "linear-gradient(160deg,#1A0D27,#120A1B)",
                              color: "#F6F1FA",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  display: "grid",
                                  placeItems: "center",
                                  width: "46px",
                                  height: "46px",
                                  borderRadius: "14px",
                                  border: "1px solid #D4B7EC4d",
                                  color: "#D4B7EC",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "19px" }}
                                  className={"ph " + h.icon}
                                ></i>
                              </span>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#B5A6C4",
                                }}
                              >
                                {h.n}
                              </span>
                            </div>
                            <div>
                              <h3
                                data-hw={""}
                                style={{
                                  fontSize: "clamp(22px,1.84vw,28px)",
                                  lineHeight: "1.08",
                                  fontWeight: "500",
                                  letterSpacing: "-.035em",
                                }}
                              >
                                {h.title}
                              </h3>
                              <p
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  marginTop: "12px",
                                  fontSize: "16px",
                                  lineHeight: "1.6",
                                  color: "#CFC2DB",
                                }}
                              >
                                {h.body}
                              </p>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginTop: "20px",
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#E9E0F0",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ color: "#D4B7EC" }}
                                  className={"ph-fill ph-check-circle"}
                                ></i>
                                {h.task}
                              </span>
                            </div>
                          </article>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
                <section data-cms-section="demo"
                  id={"demo"}
                  data-screen-label={"Software — Ways to use"}
                  style={{
                    background: "#190B25",
                    borderTop: "1px solid #ffffff12",
                    borderBottom: "1px solid #ffffff12",
                    padding: "var(--section-space) 0",
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
                            {"(02)"}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {msg("Software:54", [v.pm.formal])}
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
                              {run("pg_software|demo|h2", 3)}
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
                              {run("pg_software|demo|h2", 9)}
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
                          maxWidth: "400px",
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
                          {msg("Software:55", [v.pm.formal])}
                        </p>
                        <span
                          style={{
                            display: "flex",
                            gap: "8px",
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            fontSize: "13px",
                            lineHeight: "1.5",
                            color: "#B5A6C4",
                          }}
                        >
                          <i
                            aria-hidden={true}
                            style={{
                              fontSize: "16px",
                              flexShrink: "0",
                              marginTop: "1px",
                            }}
                            className={"ph ph-info"}
                          ></i>
                          {"Explore how work connects across OrgTik products."}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "stretch",
                        gap: "clamp(20px,3vw,44px)",
                      }}
                    >
                      <div
                        data-reveal={"stagger"}
                        style={{
                          flex: "1 1 360px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {(v.pm.ucs || []).map((u, uIndex) => (
                          <React.Fragment key={uIndex}>
                            <button
                              onMouseEnter={u.select}
                              onClick={u.select}
                              onFocus={u.select}
                              style={{
                                flex: "1",
                                display: "flex",
                                gap: "18px",
                                alignItems: "flex-start",
                                padding: "24px",
                                borderRadius: "20px",
                                border: "1px solid " + u.border,
                                background: String(u.bg),
                                color: "#F6F1FA",
                                textAlign: "start",
                                transition:
                                  "all .45s cubic-bezier(.22,1,.36,1)",
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: "0",
                                  display: "grid",
                                  placeItems: "center",
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  border: "1px solid #D4B7EC66",
                                  background: String(u.numBg),
                                  color: String(u.numC),
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  transition: "all .45s",
                                }}
                              >
                                {u.n}
                              </span>
                              <span>
                                <span
                                  data-hw={""}
                                  style={{
                                    display: "block",
                                    fontSize: "18px",
                                    fontWeight: "500",
                                    letterSpacing: "-.025em",
                                    color: String(u.titleC),
                                    transition: "color .4s",
                                  }}
                                >
                                  {u.title}
                                </span>
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "8px",
                                    fontFamily:
                                      '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                    fontSize: "15px",
                                    lineHeight: "1.55",
                                    color: "#B5A6C4",
                                  }}
                                >
                                  {u.body}
                                </span>
                              </span>
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                      <div
                        data-reveal={"clip"}
                        style={{
                          flex: "1.45 1 480px",
                          minWidth: "0",
                          display: "flex",
                          flexDirection: "column",
                          borderRadius: "24px",
                          overflow: "hidden",
                          border: "1px solid #ffffff1f",
                          background: "#0D0814",
                          boxShadow: "0 40px 90px #0904118c",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            padding: "14px 18px",
                            borderBottom: "1px solid #ffffff17",
                            background: "#120A1B",
                          }}
                        >
                          <span style={{ display: "flex", gap: "6px" }}>
                            <span
                              style={{
                                width: "9px",
                                height: "9px",
                                borderRadius: "50%",
                                background: "#ffffff2e",
                              }}
                            ></span>
                            <span
                              style={{
                                width: "9px",
                                height: "9px",
                                borderRadius: "50%",
                                background: "#ffffff2e",
                              }}
                            ></span>
                            <span
                              style={{
                                width: "9px",
                                height: "9px",
                                borderRadius: "50%",
                                background: "#ffffff2e",
                              }}
                            ></span>
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#CFC2DB",
                            }}
                          >
                            {v.pm.ucTitle}
                          </span>
                          <span
                            style={{
                              marginInlineStart: "auto",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#D4B7EC",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "15px" }}
                              className={"ph " + v.pm.icon}
                            ></i>
                            {v.pm.formal}
                          </span>
                        </div>
                        <div
                          style={{
                            position: "relative",
                            flex: "1",
                            minHeight: "clamp(260px,36svh,380px)",
                            color: "#D4B7EC",
                          }}
                        >
                          {(v.pm.ucs || []).map((u, uIndex) => (
                            <React.Fragment key={uIndex}>
                              <div
                                style={{
                                  position: "absolute",
                                  inset: "0",
                                  opacity: String(u.o),
                                  transition:
                                    "opacity .7s cubic-bezier(.22,1,.36,1)",
                                  pointerEvents: String(u.pe),
                                }}
                              >
                                <image-slot
                                  id={"sw-" + u.slot}
                                  shape={"rect"}
                                  data-src={"/assets/" + u.image}
                                  placeholder={msg("Software:56", [u.title])}
                                  style={{
                                    position: "absolute",
                                    inset: "0",
                                    width: "100%",
                                    height: "100%",
                                  }}
                                ></image-slot>
                              </div>
                            </React.Fragment>
                          ))}
                          <div
                            data-uc-swap={""}
                            style={{
                              position: "absolute",
                              insetInlineStart: "18px",
                              insetInlineEnd: "18px",
                              bottom: "18px",
                              pointerEvents: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "14px",
                              padding: "14px 16px",
                              borderRadius: "16px",
                              background: "#0D0814d9",
                              backdropFilter: "blur(14px)",
                              border: "1px solid #ffffff1f",
                            }}
                          >
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "38px",
                                height: "38px",
                                borderRadius: "11px",
                                background: "#EEE3F7",
                                color: "#28123B",
                                flexShrink: "0",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "17px" }}
                                className={"ph " + v.pm.icon}
                              ></i>
                            </span>
                            <span style={{ minWidth: "0" }}>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "15px",
                                  fontWeight: "600",
                                }}
                              >
                                {v.pm.ucTitle}
                              </span>
                              <span
                                style={{
                                  display: "block",
                                  marginTop: "3px",
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  fontSize: "13px",
                                  color: "#B5A6C4",
                                }}
                              >
                                {v.pm.ucBody}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.showPlans && (
              <>
                <React.Fragment>
                  {this.state.route.view === "plans" ? (
                    <PurchasingOverview
                      key={this.routeKey(this.state.route)}
                      kind="software"
                      initialIds={this.state.route.modules}
                      initialDuration={this.state.route.duration}
                    />
                  ) : (
                    <PackageSection
                      key={this.routeKey(this.state.route)}
                      kind="software"
                      id={this.state.route.id}
                    />
                  )}
                </React.Fragment>
              </>
            )}
            {v.showPlans && (
              <>
                <section data-cms-section="section-1"
                  data-screen-label={"Software — What happens next"}
                  style={{
                    padding: "clamp(60px,6vw,88px) 0",
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
                        gap: "24px 64px",
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
                            {"(" + v.nsNum + ")"}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {"What happens next"}
                          </span>
                        </div>
                        <h2
                          data-reveal={"mask"}
                          data-hw={""}
                          style={{
                            marginTop: "22px",
                            fontSize: "var(--section-title-size)",
                            lineHeight: "1",
                            fontWeight: "500",
                            letterSpacing: "-.045em",
                          }}
                        >
                          <span style={{ display: "block" }}>
                            <span data-line={""} style={{ display: "block" }}>
                              {run("pg_software|section-1|h2", 3)}
                              <span data-acc={""} style={{ color: "#D4B7EC" }}>
                                {run("pg_software|section-1|h2", 6)}
                              </span>
                            </span>
                          </span>
                        </h2>
                      </div>
                      <p
                        data-reveal={"up"}
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "400px",
                          fontSize: "16px",
                          lineHeight: "1.6",
                          color: "#CFC2DB",
                        }}
                      >
                        {run("pg_software|section-1|p", 1)}
                      </p>
                    </div>
                    <div
                      data-reveal={"stagger"}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(min(100%,260px),1fr))",
                        borderTop: "1px solid #ffffff1f",
                      }}
                    >
                      {(v.steps || []).map((st, stIndex) => (
                        <React.Fragment key={stIndex}>
                          <div
                            style={{
                              display: "flex",
                              gap: "18px",
                              padding: "28px 28px 0 0",
                            }}
                          >
                            <span
                              style={{
                                flexShrink: "0",
                                display: "grid",
                                placeItems: "center",
                                width: "44px",
                                height: "44px",
                                borderRadius: "50%",
                                border: "1px solid #D4B7EC66",
                                color: "#D4B7EC",
                                fontSize: "14px",
                                fontWeight: "600",
                              }}
                            >
                              {st.n}
                            </span>
                            <span>
                              <span
                                data-hw={""}
                                style={{
                                  display: "block",
                                  fontSize: "20px",
                                  fontWeight: "500",
                                  letterSpacing: "-.03em",
                                }}
                              >
                                {st.title}
                              </span>
                              <span
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  display: "block",
                                  marginTop: "8px",
                                  fontSize: "15px",
                                  lineHeight: "1.6",
                                  color: "#CFC2DB",
                                }}
                              >
                                {st.body}
                              </span>
                            </span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isProduct && (
              <>
                <section data-cms-section="section-2"
                  data-screen-label={"Software — Related"}
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
                            {run("pg_software|section-2|div", 2)}
                          </span>
                          <span
                            style={{
                              width: "36px",
                              height: "1px",
                              background: "#ffffff2e",
                            }}
                          ></span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {run("pg_software|section-2|div", 7)}
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
                              {run("pg_software|section-2|h2", 3)}
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
                              {run("pg_software|section-2|h2", 9)}
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
                          maxWidth: "400px",
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
                          {run("pg_software|section-2|p", 1)}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(min(100%,420px),1fr))",
                        gap: "clamp(16px,1.6vw,22px)",
                      }}
                    >
                      {(v.pm.related || []).map((c, cIndex) => (
                        <React.Fragment key={cIndex}>
                          <a
                            href={toSiteHref(c.href)}
                            data-reveal={"clip"}
                            data-cursor={"Explore"}
                            onMouseEnter={c.enter}
                            onMouseLeave={c.leave}
                            style={{
                              position: "relative",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "20px",
                              minHeight: "clamp(280px,36svh,360px)",
                              padding: "22px",
                              borderRadius: "22px",
                              overflow: "hidden",
                              isolation: "isolate",
                              background: "#1A0D27",
                              color: "#F6F1FA",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                inset: "0",
                                zIndex: "-2",
                                overflow: "hidden",
                                color: "#D4B7EC",
                              }}
                            >
                              <image-slot
                                id={"sw-card-" + c.id}
                                shape={"rect"}
                                data-src={"/assets/" + c.image}
                                placeholder={c.formal + " image"}
                                style={{
                                  position: "absolute",
                                  inset: "0",
                                  width: "100%",
                                  height: "100%",
                                  transform: String(c.imgT),
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
                                background:
                                  "linear-gradient(180deg,#0D081466 0%,#0D081400 26%,#0D081400 40%,#0D0814f2 86%)",
                              }}
                            ></span>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                pointerEvents: "none",
                              }}
                            >
                              <span
                                style={{
                                  display: "grid",
                                  placeItems: "center",
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "13px",
                                  background: "#EEE3F7",
                                  color: "#28123B",
                                }}
                              >
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "19px" }}
                                  className={"ph-fill " + c.icon}
                                ></i>
                              </span>
                              <span
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: "999px",
                                  background: "#0D081473",
                                  backdropFilter: "blur(10px)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: "#E9E0F0",
                                }}
                              >
                                {c.num}
                              </span>
                            </div>
                            <div style={{ pointerEvents: "none" }}>
                              <h3
                                data-hw={""}
                                style={{
                                  fontSize: "clamp(26px,2.21vw,33px)",
                                  lineHeight: "1",
                                  fontWeight: "500",
                                  letterSpacing: "-.04em",
                                }}
                              >
                                {c.formal}
                              </h3>
                              <p
                                style={{
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  marginTop: "10px",
                                  fontSize: "15px",
                                  lineHeight: "1.5",
                                  color: "#DCD0E6",
                                }}
                              >
                                {c.short}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "14px",
                                  marginTop: "16px",
                                  paddingTop: "14px",
                                  borderTop: "1px solid #ffffff24",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    color: "#E9E0F0",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.price}
                                </span>
                                <span
                                  style={{
                                    display: "grid",
                                    placeItems: "center",
                                    width: "38px",
                                    height: "38px",
                                    borderRadius: "50%",
                                    border: "1px solid #ffffff38",
                                    background: String(c.arrowBg),
                                    color: String(c.arrowC),
                                    transform: String(c.arrowT),
                                    transition:
                                      "all .5s cubic-bezier(.22,1,.36,1)",
                                  }}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "16px" }}
                                    className={"ph ph-arrow-up-right"}
                                  ></i>
                                </span>
                              </div>
                            </div>
                          </a>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {v.isOverview && <Testimonials data-cms-section="reviews" scope="software" />}
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
                    className={"reference-state-54"}
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
                    className={"reference-state-55"}
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
                  className={"reference-state-56"}
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
                  className={"reference-state-57"}
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
                        className={"reference-state-58"}
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
                        className={"reference-state-59"}
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
                      className={"reference-state-60"}
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
                  className={"reference-state-61 reference-state-62"}
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
      </>, "pg_software")
    );
  }
}
