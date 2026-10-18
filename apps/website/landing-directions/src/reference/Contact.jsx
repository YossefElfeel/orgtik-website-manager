import { managedPageTree } from "../content/managed-page";
import { SEND_FAILED, sendLead } from "../content/forms";
import { content } from "../content";
import React from "react";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";
import { ReferencePage } from "./ReferencePage";
import { routeHash, setRoute, toSiteHref } from "./navigation";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

export default class Contact extends ReferencePage {
  TOPICS = content.TOPICS();
  PATHS = content.PATHS();
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";
  H = "OrgTik%20Home.dc.html";
  CONTACT = "Contact.dc.html";
  state = {
    route: this.parseRoute(routeHash()) || { view: "index" },
    path: "start",
    topic: "A new project",
    sent: false,
    error: "",
    sentName: "",
    sentTopic: "",
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
  closingRef = React.createRef();
  glowRef = React.createRef();
  magnetRef = React.createRef();
  cursorRef = React.createRef();
  cursorBubble = React.createRef();
  parseRoute(hash) {
    const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
    if (h === "" || h === "/") return { view: "index" };
    if (h.charAt(0) !== "/") return null;
    const p = h.slice(1).split("/");
    return { view: "index" };
  }
  routeKey(r) {
    return JSON.stringify(r);
  }
  componentDidMount() {
    super.componentDidMount();
    const root = this.rootRef.current;
    if (!root) return;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
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
      if (r) this.setState({ route: r, menuOpen: false });
    };
    window.addEventListener("hashchange", this.onHash);
    this.srcMO = new MutationObserver(() => this.applyDataSrc());
    this.srcMO.observe(root, { childList: true, subtree: true });
    this.afterView(true);
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    if (this.routeKey(ps.route) !== this.routeKey(this.state.route)) {
      const c = this.cursorRef.current;
      if (c) c.style.opacity = "0";
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        this.afterView(false);
      });
    }
    this.applyDataSrc();
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    window.removeEventListener("hashchange", this.onHash);
    document.removeEventListener("visibilitychange", this.onVis);
    [this.io, this.heroIO, this.srcMO].forEach((o) => o && o.disconnect());
    (this.loops || []).forEach((a) => a.cancel());
  }
  afterView(first) {
    const hv = this.videoRef.current;
    if (hv && !hv.__ok) {
      hv.__ok = true;
      this.setupHeroVideo();
    }
    this.syncScroll();
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
  nav(u) {
    if (window.__orgNav) window.__orgNav(u);
    else location.href = u;
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
    const patch = {};
    if (mode) patch.mode = mode;
    if (sel && sel.length) patch.selected = sel;
    if (dur) patch.duration = dur;
    if (this.state.route.view === "overview") {
      this.setState(patch, () => this.go("plan-builder"));
      return;
    }
    this.pendingScroll = "plan-builder";
    this.setState(patch);
    setRoute("#/");
  }
  setupHeroVideo() {
    const v = this.videoRef.current;
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
      y > 40 || !this.videoRef.current
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
  price(sel, mode, durId) {
    const d = this.DURATIONS.find((x) => x.id === durId) || this.DURATIONS[1];
    const sub = this.MODS.filter((m) => sel.indexOf(m.id) >= 0).reduce(
      (a, m) => a + m.monthlyPrice,
      0,
    );
    const bd =
      mode === "complete"
        ? 0.25
        : mode === "operations" || mode === "growth"
          ? 0.15
          : sel.length > 1
            ? 0.1
            : 0;
    const monthly = Math.round(sub * (1 - bd) * (1 - d.discount));
    return { d: d, bd: bd, monthly: monthly, total: monthly * d.months };
  }

  renderVals() {
    const s = this.state,
      r = s.route,
      v = r.view,
      H = this.H;
    const hov = (k) => {
      const on = s.hoverCard === k;
      return {
        imgT: on ? "scale(1.06)" : "scale(1)",
        arrowBg: on ? "#EEE3F7" : "#0D081459",
        arrowC: on ? "#28123B" : "#F6F1FA",
        arrowT: on ? "rotate(45deg)" : "none",
        enter: () => this.setState({ hoverCard: k }),
        leave: () => this.setState({ hoverCard: null }),
      };
    };
    const toContact = () => this.nav(this.CONTACT);
    let hero = {},
      cta = {},
      ticker = [],
      page = {};
    hero = {
      hasCrumb: false,
      root: msg("Contact:1"),
      crumb: "",
      crumbRootC: "#FFFFFF",
      eyebrow: msg("Contact:2"),
      l1: msg("Contact:3"),
      l2: "",
      acc: msg("Contact:4"),
      body: msg("Contact:5"),
      primary: msg("Contact:6"),
      primaryGo: () => this.go("enquiry"),
      secondary: msg("Contact:7"),
      secondaryGo: () => this.go("paths"),
      panelTitle: msg("Contact:8"),
      items: [
        ["ph-map-pin", msg("Contact:9"), msg("Contact:10")],
        ["ph-phone", "+41 31 812 74 84", msg("Contact:11")],
        ["ph-circles-three-plus", msg("Contact:12"), msg("Contact:13")],
      ].map((x, i) => ({
        icon: x[0],
        label: x[1],
        meta: x[2],
        href: i === 2 ? "Software.dc.html" : "#/",
      })),
      panelNote: msg("Contact:14"),
    };
    cta = {};
    ticker = [
      msg("Contact:15"),
      "Explore software",
      "Get ongoing care",
      msg("Contact:16"),
      msg("Contact:17"),
    ];
    page = {
      paths: this.PATHS.map((p) => {
        const on = s.path === p[0];
        return {
          icon: p[1],
          title: p[2],
          body: p[3],
          note: p[4],
          bg: on ? "#1A0D27" : "transparent",
          border: on ? "#D4B7EC80" : "#ffffff1f",
          radioB: on ? "#D4B7EC" : "#ffffff40",
          dot: on ? "#D4B7EC" : "transparent",
          pick: () => {
            this.setState({ path: p[0], topic: p[5] });
            this.go("enquiry");
          },
        };
      }).map((o, i) => {
        const p = this.PATHS[i],
          on = s.path === p[0];
        return Object.assign(o, {
          on: on ? "true" : "false",
          bg: on ? "#190B25" : "#FFFFFF",
          c: on ? "#F6F1FA" : "#190B25",
          sub: on ? "#CFC2DB" : "#4A3A57",
          border: on ? "#190B25" : "#190B251f",
          tileBg: on ? "#EEE3F7" : "#190B25",
          tileC: on ? "#28123B" : "#F6F1FA",
          radioB: on ? "#D4B7EC" : "#190B2540",
          dot: on ? "#D4B7EC" : "transparent",
          pick: () => this.setState({ path: p[0], topic: p[5] }),
        });
      }),
      formKicker: (this.PATHS.find((p) => p[0] === s.path) || this.PATHS[0])[2],
      topics: this.TOPICS.map((t) => {
        const on = s.topic === t;
        return {
          label: t,
          bg: on ? "#190B25" : "#FFFFFF",
          c: on ? "#F6F1FA" : "#190B25",
          border: on ? "#190B25" : "#190B2526",
          pick: () => this.setState({ topic: t }),
        };
      }),
      notSent: !s.sent,
      sent: s.sent,
      hasError: !!s.error,
      error: s.error,
      sentName: s.sentName,
      sentTopic: s.sentTopic,
      submit: (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          n = String(f.get("name") || "").trim(),
          em = String(f.get("email") || "").trim(),
          m = String(f.get("message") || "").trim();
        if (!n || !em || !m) {
          this.setState({
            error: msg("Contact:18"),
          });
          return;
        }
        const done = () =>
          this.setState({
            sent: true,
            error: "",
            sentName: n.split(" ")[0],
            sentTopic: s.topic,
          });
        sendLead({ name: n, email: em, message: m, topic: s.topic })
          .then(done)
          .catch(() => this.setState({ error: SEND_FAILED }));
      },
      reset: () => this.setState({ sent: false, error: "" }),
    };
    Object.assign(hero, {
      showStrip: false,
      noStrip: true,
      stripLabel: "",
      links: [],
      tags: [],
    });
    return Object.assign(
      {
        xwide: !!s.xwide,
        notXwide: !s.xwide,
        narrow: s.narrow,
        menuOpen: s.menuOpen,
        openMenu: () => this.setState({ menuOpen: true }),
        closeMenu: () => this.setState({ menuOpen: false }),
        menuLinks: [
          ["Home", "OrgTik%20Home.dc.html"],
          ["Services", "Services.dc.html"],
          ["Software", "Software.dc.html"],
          ["Work", "Work.dc.html"],
          ["About", "About.dc.html"],
          ["Insights", "Insights.dc.html"],
        ].map((x) => ({ label: x[0], href: x[1] })),
        hero: hero,
        cta: cta,
        tickerLabel: msg("Contact:19"),
        tickerList: [ticker, ticker],
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
          ["Plans & pricing", "/plans"],
          ["Tell us about your project", "Contact.dc.html"],
          ["Roadmap", "Roadmap.dc.html"],
          ["Imprint", "/legal/imprint"],
        ].map((x) => ({ label: x[0], href: x[1] })),
        footTalk: () => this.go("enquiry"),
        showHero: false,
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
      },
      page,
    );
  }

  render() {
    const v = this.renderVals();
    return (
      managedPageTree(<>
        <div
          ref={v.rootRef}
          data-screen-label={"Contact"}
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
                {run("pg_contact|intro|div", 2)}
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
                      className={"reference-state-109"}
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
                      className={"reference-state-110"}
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
                      className={"reference-state-111"}
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
                      className={"reference-state-112"}
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
                      className={"reference-state-113"}
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
                      className={"reference-state-114"}
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
                      className={"reference-state-116"}
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
                    alt={attr("pg_contact|intro|img@alt")}
                    style={{ width: "104px" }}
                  />
                  <button
                    aria-label={attr("pg_contact|intro|button@aria-label")}
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
                  {run("pg_contact|intro|a", 1)}
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
          <main id={"top"} className="content-page">
            <section data-cms-section="hero"
              id={"enquiry"}
              style={{
                background:
                  "radial-gradient(70% 60% at 100% 0%,#9458F424,transparent 70%),#EEE8F7",
                color: "#190B25",
                padding: "var(--section-space) 0 var(--section-space)",
              }}
            >
              <header className="contact-intro">
                <div className="contact-intro__title">
                  <p className="contact-intro__eyebrow">
                    {run("pg_contact|hero|p", 0)}
                  </p>
                  <h1>
                    {v.hero.l1}
                    <span>{v.hero.acc}</span>
                  </h1>
                </div>
                <p className="contact-intro__subtitle">{v.hero.body}</p>
              </header>
              <div
                style={{
                  maxWidth: "1440px",
                  margin: "0 auto",
                  padding: "0 clamp(20px,4.4vw,64px)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  gap: "20px",
                }}
              >
                <div
                  data-reveal={"up"}
                  style={{
                    flex: "2 1 560px",
                    minWidth: "0",
                    padding: "clamp(24px,3vw,44px)",
                    borderRadius: "28px",
                    background: "#FFFFFFb8",
                    border: "1px solid #190B2514",
                    boxShadow: "0 30px 70px #190B2512",
                  }}
                >
                  {v.notSent && (
                    <>
                      <form
                        onSubmit={v.submit}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "20px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              letterSpacing: ".16em",
                              textTransform: "uppercase",
                              color: "#6C3CAA",
                            }}
                          >
                            {v.formKicker}
                          </div>
                          <div
                            data-hw={""}
                            style={{
                              marginTop: "10px",
                              fontSize: "clamp(25px,2.3vw,34px)",
                              fontWeight: "500",
                              letterSpacing: "-.04em",
                              lineHeight: "1.05",
                              color: "#190B25",
                            }}
                          >
                            {run("pg_contact|enquiry|div", 1)}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                              marginBottom: "10px",
                            }}
                          >
                            {run("pg_contact|enquiry|div-2", 1)}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {(v.topics || []).map((tp, tpIndex) => (
                              <React.Fragment key={tpIndex}>
                                <button
                                  type={"button"}
                                  onClick={tp.pick}
                                  style={{
                                    padding: "10px 16px",
                                    borderRadius: "999px",
                                    border: "1px solid " + tp.border,
                                    background: String(tp.bg),
                                    color: String(tp.c),
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    whiteSpace: "nowrap",
                                    transition: "all .3s",
                                  }}
                                >
                                  {tp.label}
                                </button>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(min(100%,240px),1fr))",
                            gap: "16px",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                            }}
                          >
                            {"Your name *"}
                            <input
                              name={"name"}
                              type={"text"}
                              placeholder={attr(
                                "pg_contact|enquiry|input@placeholder",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily:
                                  '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-122"}
                            />
                          </label>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                            }}
                          >
                            {"Email *"}
                            <input
                              name={"email"}
                              type={"email"}
                              placeholder={attr(
                                "pg_contact|enquiry|input@placeholder-2",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily:
                                  '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-123"}
                            />
                          </label>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                            }}
                          >
                            {"Company"}
                            <input
                              name={"company"}
                              type={"text"}
                              placeholder={attr(
                                "pg_contact|enquiry|input@placeholder-3",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily:
                                  '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-124"}
                            />
                          </label>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                            }}
                          >
                            {"Phone"}
                            <input
                              name={"phone"}
                              type={"tel"}
                              placeholder={attr(
                                "pg_contact|enquiry|input@placeholder-4",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily:
                                  '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-125"}
                            />
                          </label>
                        </div>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#3B1E59",
                          }}
                        >
                          {"A little about your project *"}
                          <textarea
                            name={"message"}
                            rows={"5"}
                            placeholder={attr(
                              "pg_contact|enquiry|textarea@placeholder",
                            )}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "14px",
                              border: "1px solid #190B2526",
                              background: "#FFFFFF",
                              color: "#190B25",
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              fontSize: "15px",
                              lineHeight: "1.6",
                              resize: "vertical",
                              outline: "none",
                            }}
                            className={"reference-state-126"}
                          ></textarea>
                        </label>
                        {v.hasError && (
                          <>
                            <div
                              role={"alert"}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                background: "#A0254414",
                                color: "#8A1F3A",
                                fontSize: "14px",
                                fontWeight: "600",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "17px" }}
                                className={"ph ph-warning-circle"}
                              ></i>
                              {v.error}
                            </div>
                          </>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                          }}
                        >
                          <span
                            style={{
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              display: "flex",
                              gap: "8px",
                              fontSize: "13px",
                              lineHeight: "1.5",
                              color: "#4A3A57",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{
                                fontSize: "16px",
                                color: "#6C3CAA",
                                flexShrink: "0",
                              }}
                              className={"ph ph-info"}
                            ></i>
                            {
                              "Message delivery is not connected in this environment."
                            }
                          </span>
                          <button
                            type={"submit"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "16px",
                              minHeight: "52px",
                              padding: "7px 7px 7px 24px",
                              borderRadius: "999px",
                              background: "#190B25",
                              color: "#F6F1FA",
                              fontSize: "15px",
                              fontWeight: "600",
                              transition:
                                "background .3s, transform .45s cubic-bezier(.22,1,.36,1)",
                            }}
                            className={"reference-state-127"}
                          >
                            {run("pg_contact|enquiry|button", 1)}
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                background: "#EEE3F7",
                                color: "#190B25",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "16px" }}
                                className={"ph ph-paper-plane-tilt"}
                              ></i>
                            </span>
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                  {v.sent && (
                    <>
                      <div
                        role={"status"}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "16px",
                          padding: "12px 0",
                        }}
                      >
                        <span
                          style={{
                            display: "grid",
                            placeItems: "center",
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            background: "#6C3CAA",
                            color: "#FFFFFF",
                          }}
                        >
                          <i
                            aria-hidden={true}
                            style={{ fontSize: "27px" }}
                            className={"ph ph-check"}
                          ></i>
                        </span>
                        <div
                          data-hw={""}
                          style={{
                            fontSize: "clamp(25px,2.3vw,34px)",
                            fontWeight: "500",
                            letterSpacing: "-.04em",
                            color: "#190B25",
                          }}
                        >
                          {msg("Contact:20", [v.sentName])}
                        </div>
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            maxWidth: "52ch",
                            fontSize: "16px",
                            lineHeight: "1.65",
                            color: "#4A3A57",
                          }}
                        >
                          {msg("Contact:21", [v.sentTopic])}
                        </p>
                        <button
                          onClick={v.reset}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "12px 18px",
                            borderRadius: "999px",
                            border: "1px solid #190B2533",
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#190B25",
                          }}
                        >
                          <i
                            aria-hidden={true}
                            className={"ph ph-arrow-counter-clockwise"}
                          ></i>
                          {run("pg_contact|enquiry|button-2", 2)}
                        </button>
                        <div
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            paddingTop: "18px",
                            borderTop: "1px solid #190B251f",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              letterSpacing: ".16em",
                              textTransform: "uppercase",
                              color: "#6C3CAA",
                            }}
                          >
                            {run("pg_contact|enquiry|div-3", 1)}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "10px",
                              marginTop: "12px",
                            }}
                          >
                            <a
                              href={toSiteHref("Work.dc.html")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "11px 16px",
                                borderRadius: "999px",
                                background: "#190B25",
                                color: "#F6F1FA",
                                fontSize: "14px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                transition: "background .3s",
                              }}
                              className={"reference-state-128"}
                            >
                              {run("pg_contact|enquiry|a", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                            <a
                              href={toSiteHref("Insights.dc.html")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "11px 16px",
                                borderRadius: "999px",
                                background: "#190B25",
                                color: "#F6F1FA",
                                fontSize: "14px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                transition: "background .3s",
                              }}
                              className={"reference-state-129"}
                            >
                              {run("pg_contact|enquiry|a-2", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                            <a
                              href={toSiteHref("Software.dc.html")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "11px 16px",
                                borderRadius: "999px",
                                background: "#190B25",
                                color: "#F6F1FA",
                                fontSize: "14px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                transition: "background .3s",
                              }}
                              className={"reference-state-130"}
                            >
                              {run("pg_contact|enquiry|a-3", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                            <a
                              href={toSiteHref("OrgTik%20Home.dc.html")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "11px 16px",
                                borderRadius: "999px",
                                background: "#190B25",
                                color: "#F6F1FA",
                                fontSize: "14px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                transition: "background .3s",
                              }}
                              className={"reference-state-131"}
                            >
                              {run("pg_contact|enquiry|a-4", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <aside
                  data-reveal={"up"}
                  style={{
                    flex: "1 1 320px",
                    position: "sticky",
                    top: "104px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div
                    role={"radiogroup"}
                    aria-label={attr("pg_contact|enquiry|div@aria-label")}
                    style={{
                      padding: "16px",
                      borderRadius: "24px",
                      background: "#FFFFFF",
                      border: "1px solid #190B2514",
                      color: "#190B25",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "#6C3CAA",
                        margin: "4px 6px 12px",
                      }}
                    >
                      {run("pg_contact|enquiry|div-4", 1)}
                    </div>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {(v.paths || []).map((pt, ptIndex) => (
                        <React.Fragment key={ptIndex}>
                          <button
                            type={"button"}
                            role={"radio"}
                            aria-checked={pt.on}
                            onClick={pt.pick}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "12px",
                              borderRadius: "16px",
                              border: "1px solid " + pt.border,
                              background: String(pt.bg),
                              color: String(pt.c),
                              textAlign: "start",
                              transition:
                                "background .4s cubic-bezier(.22,1,.36,1), border-color .4s, color .4s",
                            }}
                            className={"reference-state-132"}
                          >
                            <span
                              style={{
                                flexShrink: "0",
                                display: "grid",
                                placeItems: "center",
                                width: "36px",
                                height: "36px",
                                borderRadius: "11px",
                                background: String(pt.tileBg),
                                color: String(pt.tileC),
                                transition: "background .4s",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "17px" }}
                                className={"ph " + pt.icon}
                              ></i>
                            </span>
                            <span style={{ flex: "1", minWidth: "0" }}>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "15px",
                                  fontWeight: "600",
                                }}
                              >
                                {pt.title}
                              </span>
                              <span
                                style={{
                                  display: "block",
                                  marginTop: "2px",
                                  fontFamily:
                                    '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                                  fontSize: "13px",
                                  lineHeight: "1.45",
                                  color: String(pt.sub),
                                }}
                              >
                                {pt.body}
                              </span>
                            </span>
                            <span
                              style={{
                                flexShrink: "0",
                                display: "grid",
                                placeItems: "center",
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                border: "1.5px solid " + pt.radioB,
                              }}
                            >
                              <span
                                style={{
                                  width: "9px",
                                  height: "9px",
                                  borderRadius: "50%",
                                  background: String(pt.dot),
                                }}
                              ></span>
                            </span>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "28px",
                      borderRadius: "26px",
                      background: "#190B25",
                      color: "#F6F1FA",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "#C9A0F3",
                      }}
                    >
                      {run("pg_contact|enquiry|div-5", 1)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        padding: "16px 0",
                        borderTop: "1px solid #ffffff14",
                        marginTop: "14px",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: "1px solid #D4B7EC66",
                          color: "#D4B7EC",
                          fontSize: "13px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_contact|enquiry|div-6", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "16px",
                            fontWeight: "600",
                          }}
                        >
                          {run("pg_contact|enquiry|div-6", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            display: "block",
                            marginTop: "4px",
                            fontSize: "14px",
                            lineHeight: "1.5",
                            color: "#CFC2DB",
                          }}
                        >
                          {run("pg_contact|enquiry|div-6", 11)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        padding: "16px 0",
                        borderTop: "1px solid #ffffff14",
                        marginTop: "14px",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: "1px solid #D4B7EC66",
                          color: "#D4B7EC",
                          fontSize: "13px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_contact|enquiry|div-7", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "16px",
                            fontWeight: "600",
                          }}
                        >
                          {run("pg_contact|enquiry|div-7", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            display: "block",
                            marginTop: "4px",
                            fontSize: "14px",
                            lineHeight: "1.5",
                            color: "#CFC2DB",
                          }}
                        >
                          {run("pg_contact|enquiry|div-7", 11)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        padding: "16px 0",
                        borderTop: "1px solid #ffffff14",
                        marginTop: "14px",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: "1px solid #D4B7EC66",
                          color: "#D4B7EC",
                          fontSize: "13px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_contact|enquiry|div-8", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "16px",
                            fontWeight: "600",
                          }}
                        >
                          {run("pg_contact|enquiry|div-8", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            display: "block",
                            marginTop: "4px",
                            fontSize: "14px",
                            lineHeight: "1.5",
                            color: "#CFC2DB",
                          }}
                        >
                          {run("pg_contact|enquiry|div-8", 11)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "24px 28px",
                      borderRadius: "26px",
                      background: "#FFFFFFb8",
                      border: "1px solid #190B2514",
                      color: "#190B25",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "#6C3CAA",
                      }}
                    >
                      {run("pg_contact|enquiry|div-9", 1)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        marginTop: "16px",
                        fontSize: "15px",
                        fontWeight: "600",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "17px", color: "#6C3CAA" }}
                        className={"ph ph-map-pin"}
                      ></i>
                      <span>
                        {run("pg_contact|enquiry|div-10", 3)}
                        <br />
                        {run("pg_contact|enquiry|div-10", 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        marginTop: "14px",
                        fontSize: "15px",
                        fontWeight: "600",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "17px", color: "#6C3CAA" }}
                        className={"ph ph-phone"}
                      ></i>
                      <span>{"+41 31 812 74 84"}</span>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          </main>
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
                  className={"reference-state-133"}
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
                  className={"reference-state-134"}
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
                        className={"reference-state-135"}
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
                        className={"reference-state-136"}
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
                      className={"reference-state-137"}
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
                  className={"reference-state-138 reference-state-139"}
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
      </>, "pg_contact")
    );
  }
}
