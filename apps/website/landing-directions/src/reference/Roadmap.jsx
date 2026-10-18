import { managedPageTree, SectionMedia } from "../content/managed-page";
import { content } from "../content";
import { SEND_FAILED, sendIdea } from "../content/forms";
import { ideaFormCopy } from "../content/idea-form";
import { SiteHeader } from "./SiteHeader";
import React from "react";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";
import { ReferencePage } from "./ReferencePage";
import { routeHash, setRoute, toSiteHref } from "./navigation";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings.js";

export default class Roadmap extends ReferencePage {
  RM = content.RM();
  IDEAS = content.IDEAS();
  onKey = (e) => {
    if (e.key === "Tab" && this.state.active) {
      const elements = [
        ...this.rootRef.current
          .querySelector('[role="dialog"]')
          .querySelectorAll(
            'button, a[href], input, select, textarea, [tabindex="0"]',
          ),
      ];
      const first = elements[0],
        last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (e.key === "Escape" && this.state.active)
      this.setState({ active: null });
  };
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";
  H = "OrgTik%20Home.dc.html";
  CONTACT = "Contact.dc.html";
  state = {
    route: this.parseRoute(routeHash()) || { view: "index" },
    period: msg("Roadmap:1"),
    theme: msg("Roadmap:2"),
    q: "",
    year: "2026",
    iq: "",
    votes: {},
    active: null,
    copied: false,
    topic: "",
    ideaSent: false,
    ideaSending: false,
    ideaErr: "",
    ideaName: "",
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
      const r = this.parseRoute(location.hash);
      if (r) this.setState({ route: r, menuOpen: false });
    };
    window.addEventListener("hashchange", this.onHash);
    this.srcMO = new MutationObserver(() => this.applyDataSrc());
    this.srcMO.observe(root, { childList: true, subtree: true });
    this.afterView(true);
    window.addEventListener("keydown", this.onKey);
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    if (ps.active !== this.state.active) {
      if (this.state.active) {
        this.dialogReturn = document.activeElement;
        requestAnimationFrame(() =>
          this.rootRef.current
            ?.querySelector('[role="dialog"] button')
            ?.focus(),
        );
      } else this.dialogReturn?.focus();
    }
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
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    window.removeEventListener("hashchange", this.onHash);
    document.removeEventListener("visibilitychange", this.onVis);
    [this.io, this.heroIO, this.srcMO].forEach((o) => o && o.disconnect());
    (this.loops || []).forEach((a) => a.cancel());
  }
  afterView(first) {
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
      y > 40
        ? {
            left: "20px",
            right: "20px",
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
            left: "0",
            right: "0",
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
    const RM = this.RM,
      ST = ["Open", "Planned", "In progress", "Shipped"],
      q = s.q.trim().toLowerCase();
    const match = RM.filter(
      (x) =>
        (s.period === "All" || x.period === s.period) &&
        (s.theme === "All themes" || x.theme === s.theme) &&
        (x.title + " " + x.theme + " " + x.body).toLowerCase().indexOf(q) >= 0,
    );
    const years = Array.from(new Set(match.map((x) => x.year))).sort(),
      ay =
        years.indexOf(s.year) >= 0
          ? s.year
          : years.indexOf("2026") >= 0
            ? "2026"
            : years[years.length - 1],
      vis = match.filter((x) => x.year === ay),
      N = Math.max(years.length, 1),
      ai = Math.max(years.indexOf(ay), 0);
    const SC = {
      Shipped: ["#EEE3F7", "#28123B", "#EEE3F7"],
      "In progress": ["#9458F4", "#FFFFFF", "#9458F4"],
      Open: ["#ffffff1f", "#F6F1FA", "#F6F1FA"],
      Planned: ["#C9A0F326", "#EEE3F7", "#C9A0F3"],
    };
    const DESC = {
      Open: msg("Roadmap:3"),
      Planned: msg("Roadmap:4"),
      "In progress": msg("Roadmap:5"),
      Shipped: msg("Roadmap:6"),
    };
    const open = (it) => this.setState({ active: it, copied: false }),
      A = s.active,
      iq = s.iq.trim().toLowerCase(),
      ideas = this.IDEAS.filter(
        (x) =>
          (x.title + " " + x.theme + " " + x.body).toLowerCase().indexOf(iq) >=
          0,
      ),
      mv = Object.keys(s.votes).length;
    ticker = RM.map((x) => x.title);
    page = {
      periods: [msg("Roadmap:7"), "Past", "Now", "Next"].map((p) => {
        const on = s.period === p;
        return {
          label: p,
          pressed: on,
          n: p === "All" ? RM.length : RM.filter((x) => x.period === p).length,
          bg: on ? "#EEE3F7" : "transparent",
          c: on ? "#28123B" : "#E9E0F0",
          nBg: on ? "#28123B1a" : "#ffffff12",
          pick: () => this.setState({ period: p }),
        };
      }),
      theme: s.theme,
      onTheme: (e) => this.setState({ theme: e.target.value }),
      q: s.q,
      onQ: (e) => this.setState({ q: e.target.value }),
      hasQ: !!s.q,
      clearQ: () => this.setState({ q: "" }),
      countLabel: msg("Roadmap:8", [
        match.length,
        match.length === 1 ? "project" : "projects",
        years.length,
        years.length === 1 ? " year" : " years",
      ]),
      hasVis: vis.length > 0,
      noMatch: match.length === 0,
      resetAll: () =>
        this.setState({
          period: msg("Roadmap:9"),
          theme: msg("Roadmap:10"),
          q: "",
        }),
      railCols:
        "repeat(" + N + ",minmax(" + (s.narrow ? "110px" : "0") + ",1fr))",
      trackL: 50 / N + "%",
      trackW: ((N - 1) * 100) / N + "%",
      fillW: (ai * 100) / N + "%",
      rail: years.map((y, i) => {
        const on = i === ai,
          past = i < ai,
          n = match.filter((x) => x.year === y).length;
        return {
          y: y,
          n: n + (n === 1 ? " milestone" : " milestones"),
          pressed: on ? "true" : "false",
          dot: on ? "#EEE3F7" : past ? "#D4B7EC" : "#2A1B38",
          ring: on ? "#9458F4" : past ? "#D4B7EC" : "#ffffff33",
          glow: on ? "0 0 0 6px #9458F42e, 0 0 26px #9458F4" : "none",
          yc: on ? "#FFFFFF" : past ? "#CFC2DB" : "#8E7BA0",
          nc: on ? "#D4B7EC" : "#8E7BA0",
          pick: () => this.setState({ year: y }),
        };
      }),
      ay: ay,
      yearCount: vis.length + (vis.length === 1 ? " milestone" : " milestones"),
      summary: ST.map((k) => ({
        k: k,
        n: vis.filter((x) => x.status === k).length,
        dot: SC[k][2],
      })).filter((x) => x.n > 0),
      miles: vis.map((x) => {
        const hv = hov("m" + x.title);
        return {
          status: x.status,
          theme: x.theme,
          timing: x.timing,
          title: x.title,
          body: x.body,
          pLabel:
            x.status === "Shipped" ? msg("Roadmap:11") : msg("Roadmap:12"),
          pct: x.progress + "%",
          sBg: SC[x.status][0],
          sC: SC[x.status][1],
          accent:
            x.status === "Shipped"
              ? "#EEE3F7"
              : x.status === "In progress"
                ? "linear-gradient(90deg,#9458F4,#D4B7EC)"
                : x.status === "Planned"
                  ? "#C9A0F366"
                  : "#ffffff26",
          arrowBg: hv.arrowBg,
          arrowC: hv.arrowC,
          arrowT: hv.arrowT,
          enter: hv.enter,
          leave: hv.leave,
          open: () => open(Object.assign({ kind: "m" }, x)),
        };
      }),
      iq: s.iq,
      onIQ: (e) => this.setState({ iq: e.target.value }),
      myVotes: mv
        ? msg("Roadmap:13", [mv, mv === 1 ? " idea" : " ideas"])
        : msg("Roadmap:14"),
      boardCols: s.xwide
        ? "repeat(4,minmax(0,1fr))"
        : "repeat(4,minmax(280px,1fr))",
      cols: ST.map((k, ci) => {
        const list = ideas.filter((x) => x.status === k);
        return {
          k: k,
          n: list.length,
          idx: "0" + (ci + 1),
          desc: DESC[k],
          accent:
            k === "In progress"
              ? "linear-gradient(90deg,#9458F4,#D4B7EC)"
              : SC[k][2],
          arrow: ci < 3,
          empty: list.length === 0,
          cards: list.map((x) => {
            const vd = !!s.votes[x.id],
              vt = x.votes + (vd ? 1 : 0);
            return {
              theme: x.theme,
              title: x.title,
              body: x.body,
              votes: vt,
              vBg: vd ? "#EEE3F7" : "transparent",
              vC: vd ? "#28123B" : "#F6F1FA",
              vB: vd ? "#EEE3F7" : "#ffffff2e",
              vLabel: (vd ? msg("Roadmap:15") : msg("Roadmap:16")) + x.title,
              vPressed: vd ? "true" : "false",
              vote: () =>
                this.setState((st) => {
                  const o = Object.assign({}, st.votes);
                  if (o[x.id]) delete o[x.id];
                  else o[x.id] = true;
                  return { votes: o };
                }),
              comments:
                x.comments + (x.comments === 1 ? " comment" : " comments"),
              comment: () =>
                open({
                  kind: "c",
                  id: x.id,
                  status: x.status,
                  theme: x.theme,
                  title: x.title,
                  votes: vt,
                  comments: x.comments,
                  body: x.body,
                }),
            };
          }),
        };
      }),
      topics: [
        msg("Roadmap:17"),
        msg("Roadmap:18"),
        msg("Roadmap:19"),
        msg("Roadmap:20"),
      ].map((t) => {
        const on = s.topic === t;
        return {
          label: t,
          pressed: on ? "true" : "false",
          bg: on ? "#190B25" : "#FFFFFF",
          c: on ? "#F6F1FA" : "#190B25",
          border: on ? "#190B25" : "#190B2526",
          pick: () => this.setState({ topic: t, ideaErr: "" }),
        };
      }),
      ideaForm: !s.ideaSent,
      ideaSent: s.ideaSent,
      ideaErr: s.ideaErr,
      ideaSending: s.ideaSending,
      hasIdeaErr: !!s.ideaErr,
      ideaName: s.ideaName,
      submitIdea: (e) => {
        e.preventDefault();
        if (this.state.ideaSending) return;
        const f = new FormData(e.currentTarget),
          n = String(f.get("name") || "").trim(),
          em = String(f.get("email") || "").trim(),
          title = String(f.get("title") || "").trim(),
          m = String(f.get("message") || "").trim();
        if (!title || title.length > 180) {
          this.setState({ ideaErr: ideaFormCopy().titleError });
          return;
        }
        if (!this.state.topic) {
          this.setState({ ideaErr: msg("Roadmap:21") });
          return;
        }
        if (!n || !em || !m) {
          this.setState({
            ideaErr: msg("Roadmap:22"),
          });
          return;
        }
        const done = () =>
          this.setState({
            ideaSent: true,
            ideaSending: false,
            ideaErr: "",
            ideaName: n.split(" ")[0],
          });
        this.setState({ ideaSending: true, ideaErr: "" });
        sendIdea({
          name: n,
          email: em,
          title,
          message: m,
          topic: this.state.topic,
          consent: f.get("consent") === "on",
        })
          .then(done)
          .catch(() =>
            this.setState({ ideaErr: SEND_FAILED, ideaSending: false }),
          );
      },
      goTL: (e) => {
        e.preventDefault();
        this.go("timeline");
      },
      goCM: (e) => {
        e.preventDefault();
        this.go("community");
      },
      ideaReset: () =>
        this.setState({ ideaSent: false, ideaErr: "", topic: "" }),
      hasActive: !!A,
      closeDlg: () => this.setState({ active: null }),
      stop: (e) => e.stopPropagation(),
      dlg: A
        ? {
            eyebrow: msg("Roadmap:23", [A.status, A.theme]),
            title: A.title,
            body: A.body,
            media: A.media ?? [],
            hasComments: A.kind === "c",
            commentThread: content.IDEA_COMMENTS(A.id),
            facts: (A.kind === "m"
              ? [
                  [msg("Roadmap:24"), A.year],
                  [msg("Roadmap:25"), A.timing],
                  [msg("Roadmap:26"), A.theme],
                ]
              : [
                  [msg("Roadmap:27"), String(A.votes)],
                  [msg("Roadmap:28"), String(A.comments)],
                  [msg("Roadmap:29"), A.theme],
                ]
            ).map((x) => ({ k: x[0], v: x[1] })),
            hasBar: A.kind === "m",
            pct: (A.kind === "m" ? A.progress : 0) + "%",
            pLabel:
              A.status === "Shipped" ? msg("Roadmap:30") : msg("Roadmap:31"),
            steps: ST.map((k) => {
              const d =
                k === "Open" ||
                (k === "Planned" && A.status !== "Open") ||
                (k === "In progress" &&
                  (A.status === "In progress" || A.status === "Shipped")) ||
                (k === "Shipped" && A.status === "Shipped");
              return {
                k: k,
                bg: d ? "#EEE3F7" : "transparent",
                c: d ? "#28123B" : "#9D8BAE",
                b: d ? "#EEE3F7" : "#ffffff26",
                icon: d ? "ph-fill ph-check-circle" : "ph ph-circle",
              };
            }),
          }
        : {
            eyebrow: "",
            title: "",
            body: "",
            facts: [],
            hasBar: false,
            pct: "0%",
            pLabel: "",
            steps: [],
          },
      copyLabel: s.copied ? msg("Roadmap:32") : msg("Roadmap:33"),
      copy: () => {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(location.href);
        } catch (err) {}
        this.setState({ copied: true });
      },
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
        tickerLabel: msg("Roadmap:34"),
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
      },
      page,
    );
  }

  render() {
    const v = this.renderVals();
    return managedPageTree(
      <>
        <div
          ref={v.rootRef}
          data-screen-label={"Roadmap"}
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
              left: "0",
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
                {run("pg_roadmap|intro|div", 2)}
              </span>
              <i
                aria-hidden={true}
                style={{ fontSize: "17px" }}
                className={"ph ph-arrow-up-right"}
              ></i>
            </span>
          </div>
          <SiteHeader />

          <main id={"top"}>
            <section
              data-cms-section="hero"
              className="purchase-surface"
              style={{
                paddingTop: 136,
                paddingBottom: 24,
                paddingInline:
                  "max(clamp(20px,4.4vw,64px), calc((100% - 1312px) / 2))",
              }}
            >
              <div className="commerce-intro">
                <h1>{run("pg_roadmap|hero|h1", 0)}</h1>
                <p>{run("pg_roadmap|hero|p", 0)}</p>
              </div>
              <p role="note" style={{ maxWidth: 760, lineHeight: 1.7 }}>
                {run("pg_roadmap|hero|p-2", 0)}
              </p>
            </section>
            <section
              data-cms-section="timeline"
              id={"timeline"}
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
                    marginBottom: "clamp(28px,2.8vw,40px)",
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
                      <span style={{ color: "#C9A0F3" }}>
                        {run("pg_roadmap|timeline|div", 1)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      <span style={{ whiteSpace: "nowrap" }}>
                        {run("pg_roadmap|timeline|div", 5)}
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
                          {run("pg_roadmap|timeline|h2", 3)}
                        </span>
                      </span>
                      <span style={{ display: "block" }}>
                        <span
                          data-line={""}
                          data-acc={""}
                          style={{ display: "block", color: "#D4B7EC" }}
                        >
                          {run("pg_roadmap|timeline|h2", 9)}
                        </span>
                      </span>
                    </h2>
                  </div>
                  <p
                    data-reveal={"up"}
                    style={{
                      fontFamily: "Arial,Helvetica,sans-serif",
                      maxWidth: "440px",
                      fontSize: "16px",
                      lineHeight: "1.65",
                      color: "#CFC2DB",
                    }}
                  >
                    {run("pg_roadmap|timeline|p", 1)}
                  </p>
                </div>
                <div
                  data-reveal={"up"}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div
                    role={"group"}
                    aria-label={attr("pg_roadmap|timeline|div@aria-label")}
                    style={{
                      flex: "0 0 auto",
                      maxWidth: "100%",
                      overflowX: "auto",
                      display: "flex",
                      flexWrap: "nowrap",
                      gap: "4px",
                      padding: "5px",
                      borderRadius: "999px",
                      background: "#120A1B",
                      border: "1px solid #ffffff17",
                    }}
                  >
                    {(v.periods || []).map((pr, prIndex) => (
                      <React.Fragment key={prIndex}>
                        <button
                          onClick={pr.pick}
                          aria-pressed={pr.pressed}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "9px 16px",
                            borderRadius: "999px",
                            background: String(pr.bg),
                            color: String(pr.c),
                            fontSize: "13px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                            transition: "all .3s",
                          }}
                        >
                          {pr.label}
                          <span
                            style={{
                              minWidth: "22px",
                              padding: "1px 7px",
                              borderRadius: "999px",
                              background: String(pr.nBg),
                              fontSize: "11px",
                              fontWeight: "700",
                              textAlign: "center",
                            }}
                          >
                            {pr.n}
                          </span>
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      flex: "1 1 380px",
                      justifyContent: "flex-end",
                    }}
                  >
                    <label
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        flex: "0 1 220px",
                        minWidth: "180px",
                      }}
                    >
                      <select
                        aria-label={attr(
                          "pg_roadmap|timeline|select@aria-label",
                        )}
                        value={v.theme}
                        onChange={v.onTheme}
                        style={{
                          width: "100%",
                          height: "46px",
                          padding: "0 40px 0 18px",
                          borderRadius: "999px",
                          border: "1px solid #ffffff26",
                          background: "#120A1B",
                          color: "#F6F1FA",
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: "13px",
                          fontWeight: "600",
                          appearance: "none",
                          WebkitAppearance: "none",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option
                          value={"All themes"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option", 1)}
                        </option>
                        <option
                          value={"Brand"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-2", 1)}
                        </option>
                        <option
                          value={"Website"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-3", 1)}
                        </option>
                        <option
                          value={"Platform"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-4", 1)}
                        </option>
                        <option
                          value={"Hosting"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-5", 1)}
                        </option>
                        <option
                          value={"Accessibility"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-6", 1)}
                        </option>
                        <option
                          value={"Support"}
                          style={{ background: "#FFFFFF", color: "#190B25" }}
                        >
                          {run("pg_roadmap|timeline|option-7", 1)}
                        </option>
                      </select>
                      <i
                        aria-hidden={true}
                        style={{
                          position: "absolute",
                          right: "16px",
                          fontSize: "14px",
                          color: "#B5A6C4",
                          pointerEvents: "none",
                        }}
                        className={"ph ph-caret-down"}
                      ></i>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flex: "1 1 240px",
                        maxWidth: "360px",
                        height: "46px",
                        padding: "0 16px",
                        borderRadius: "999px",
                        border: "1px solid #ffffff26",
                        background: "#0D0814",
                        color: "#B5A6C4",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "16px" }}
                        className={"ph ph-magnifying-glass"}
                      ></i>
                      <input
                        aria-label={attr(
                          "pg_roadmap|timeline|input@aria-label",
                        )}
                        value={v.q}
                        onChange={v.onQ}
                        placeholder={attr(
                          "pg_roadmap|timeline|input@placeholder",
                        )}
                        style={{
                          flex: "1",
                          minWidth: "0",
                          background: "transparent",
                          border: "0",
                          outline: "none",
                          color: "#F6F1FA",
                          fontFamily: "Arial,Helvetica,sans-serif",
                          fontSize: "14px",
                        }}
                      />
                      {v.hasQ && (
                        <>
                          <button
                            onClick={v.clearQ}
                            aria-label={attr(
                              "pg_roadmap|timeline|button@aria-label",
                            )}
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              color: "#CFC2DB",
                            }}
                            className={"reference-state-174"}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "13px" }}
                              className={"ph ph-x"}
                            ></i>
                          </button>
                        </>
                      )}
                    </label>
                  </div>
                </div>
                <p
                  aria-live={"polite"}
                  style={{
                    margin: "18px 4px 0",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#B5A6C4",
                  }}
                >
                  {v.countLabel}
                </p>
                {v.hasVis && (
                  <>
                    <div
                      data-reveal={"up"}
                      style={{
                        marginTop: "16px",
                        borderRadius: "30px",
                        border: "1px solid #ffffff17",
                        background:
                          "radial-gradient(60% 90% at 50% 0%,#9458F41f,transparent 70%),#110A19",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          overflowX: "auto",
                          padding:
                            "clamp(26px,2.8vw,38px) clamp(12px,2vw,28px) 24px",
                          borderBottom: "1px solid #ffffff12",
                        }}
                      >
                        <div
                          role={"group"}
                          aria-label={attr(
                            "pg_roadmap|timeline|div@aria-label-2",
                          )}
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: String(v.railCols),
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: String(v.trackL),
                              width: String(v.trackW),
                              height: "2px",
                              background: "#ffffff1f",
                            }}
                          ></span>
                          <span
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: String(v.trackL),
                              width: String(v.fillW),
                              height: "2px",
                              background:
                                "linear-gradient(90deg,#9458F4,#D4B7EC)",
                              transition: "width .8s cubic-bezier(.16,1,.3,1)",
                            }}
                          ></span>
                          {(v.rail || []).map((yr, yrIndex) => (
                            <React.Fragment key={yrIndex}>
                              <button
                                onClick={yr.pick}
                                aria-pressed={yr.pressed}
                                style={{
                                  position: "relative",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "14px",
                                  padding: "0 6px 4px",
                                  color: "#F6F1FA",
                                }}
                              >
                                <span
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "50%",
                                    background: String(yr.dot),
                                    border: "2px solid " + yr.ring,
                                    boxShadow: String(yr.glow),
                                    transition: "all .5s",
                                  }}
                                ></span>
                                <span
                                  style={{
                                    fontSize: "clamp(18px,1.66vw,24px)",
                                    fontWeight: "500",
                                    letterSpacing: "-.02em",
                                    fontVariantNumeric: "tabular-nums",
                                    color: String(yr.yc),
                                    transition: "color .4s",
                                  }}
                                >
                                  {yr.y}
                                </span>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: String(yr.nc),
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {yr.n}
                                </span>
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "clamp(20px,2.6vw,36px)" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            marginBottom: "22px",
                          }}
                        >
                          <h3
                            data-hw={""}
                            style={{
                              fontSize: "clamp(25px,2.3vw,34px)",
                              lineHeight: "1.05",
                              fontWeight: "500",
                              letterSpacing: "-.04em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {v.ay}
                            <span style={{ color: "#D4B7EC" }}>
                              {" · " + v.yearCount}
                            </span>
                          </h3>
                          <div
                            aria-label={attr(
                              "pg_roadmap|timeline|div@aria-label-3",
                            )}
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {(v.summary || []).map((sm, smIndex) => (
                              <React.Fragment key={smIndex}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 13px",
                                    borderRadius: "999px",
                                    border: "1px solid #ffffff1f",
                                    background: "#ffffff08",
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "8px",
                                      height: "8px",
                                      borderRadius: "50%",
                                      background: String(sm.dot),
                                    }}
                                  ></span>
                                  {sm.n + " " + sm.k}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(min(100%,340px),1fr))",
                            gap: "16px",
                          }}
                        >
                          {(v.miles || []).map((m, mIndex) => (
                            <React.Fragment key={mIndex}>
                              <button
                                onClick={m.open}
                                onMouseEnter={m.enter}
                                onMouseLeave={m.leave}
                                style={{
                                  position: "relative",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "stretch",
                                  gap: "16px",
                                  minHeight: "252px",
                                  padding: "26px",
                                  textAlign: "left",
                                  borderRadius: "24px",
                                  border: "1px solid #ffffff17",
                                  background:
                                    "linear-gradient(160deg,#1C0F2B,#140B1F)",
                                  color: "#F6F1FA",
                                  overflow: "hidden",
                                  transition:
                                    "border-color .4s, transform .6s cubic-bezier(.22,1,.36,1)",
                                }}
                                className={"reference-state-175"}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "0",
                                    right: "0",
                                    top: "0",
                                    height: "3px",
                                    background: String(m.accent),
                                  }}
                                ></span>
                                <span
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: "5px 11px",
                                      borderRadius: "999px",
                                      background: String(m.sBg),
                                      color: String(m.sC),
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m.status}
                                  </span>
                                  <span
                                    style={{
                                      padding: "5px 11px",
                                      borderRadius: "999px",
                                      border: "1px solid #ffffff26",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      color: "#E9E0F0",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m.theme}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      color: "#9D8BAE",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <i
                                      aria-hidden={true}
                                      style={{ fontSize: "14px" }}
                                      className={"ph ph-clock"}
                                    ></i>
                                    {m.timing}
                                  </span>
                                </span>
                                <span
                                  data-hw={""}
                                  style={{
                                    fontSize: "clamp(22px,1.93vw,29px)",
                                    lineHeight: "1.08",
                                    fontWeight: "500",
                                    letterSpacing: "-.035em",
                                    textWrap: "balance",
                                  }}
                                >
                                  {m.title}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "Arial,Helvetica,sans-serif",
                                    maxWidth: "52ch",
                                    fontSize: "15px",
                                    lineHeight: "1.6",
                                    color: "#CFC2DB",
                                  }}
                                >
                                  {m.body}
                                </span>
                                <span
                                  style={{
                                    marginTop: "auto",
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: "20px",
                                  }}
                                >
                                  <span
                                    style={{
                                      flex: "1",
                                      minWidth: "0",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "8px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          fontWeight: "600",
                                          color: "#9D8BAE",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {m.pLabel}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "14px",
                                          fontWeight: "700",
                                          fontVariantNumeric: "tabular-nums",
                                        }}
                                      >
                                        {m.pct}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        display: "block",
                                        height: "6px",
                                        borderRadius: "6px",
                                        background: "#ffffff14",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <span
                                        style={{
                                          display: "block",
                                          height: "100%",
                                          width: String(m.pct),
                                          borderRadius: "6px",
                                          background:
                                            "linear-gradient(90deg,#9458F4,#D4B7EC)",
                                        }}
                                      ></span>
                                    </span>
                                  </span>
                                  <span
                                    style={{
                                      flexShrink: "0",
                                      display: "grid",
                                      placeItems: "center",
                                      width: "46px",
                                      height: "46px",
                                      borderRadius: "50%",
                                      border: "1px solid #ffffff38",
                                      background: String(m.arrowBg),
                                      color: String(m.arrowC),
                                      transform: String(m.arrowT),
                                      transition:
                                        "all .5s cubic-bezier(.22,1,.36,1)",
                                    }}
                                  >
                                    <i
                                      aria-hidden={true}
                                      style={{ fontSize: "17px" }}
                                      className={"ph ph-arrow-up-right"}
                                    ></i>
                                  </span>
                                </span>
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {v.noMatch && (
                  <>
                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        padding: "64px 24px",
                        borderRadius: "30px",
                        border: "1px dashed #ffffff2e",
                        textAlign: "center",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "25px", color: "#D4B7EC" }}
                        className={"ph ph-magnifying-glass"}
                      ></i>
                      <div
                        data-hw={""}
                        style={{ fontSize: "24px", fontWeight: "500" }}
                      >
                        {run("pg_roadmap|timeline|div-2", 1)}
                      </div>
                      <p
                        style={{
                          fontFamily: "Arial,Helvetica,sans-serif",
                          fontSize: "15px",
                          color: "#CFC2DB",
                        }}
                      >
                        {run("pg_roadmap|timeline|p-2", 1)}
                      </p>
                      <button
                        onClick={v.resetAll}
                        style={{
                          padding: "11px 20px",
                          borderRadius: "999px",
                          background: "#EEE3F7",
                          color: "#28123B",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        {run("pg_roadmap|timeline|button", 1)}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
            <section
              data-cms-section="community"
              id={"community"}
              style={{
                padding: "var(--section-space) 0",
                background: "#190B25",
                borderTop: "1px solid #ffffff12",
                borderBottom: "1px solid #ffffff12",
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
                    marginBottom: "clamp(28px,2.8vw,40px)",
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
                      <span style={{ color: "#C9A0F3" }}>
                        {run("pg_roadmap|community|div", 1)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      <span style={{ whiteSpace: "nowrap" }}>
                        {run("pg_roadmap|community|div", 5)}
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
                          {run("pg_roadmap|community|h2", 3)}
                        </span>
                      </span>
                      <span style={{ display: "block" }}>
                        <span
                          data-line={""}
                          data-acc={""}
                          style={{ display: "block", color: "#D4B7EC" }}
                        >
                          {run("pg_roadmap|community|h2", 9)}
                        </span>
                      </span>
                    </h2>
                  </div>
                  <p
                    data-reveal={"up"}
                    style={{
                      fontFamily: "Arial,Helvetica,sans-serif",
                      maxWidth: "440px",
                      fontSize: "16px",
                      lineHeight: "1.65",
                      color: "#CFC2DB",
                    }}
                  >
                    {run("pg_roadmap|community|p", 1)}
                  </p>
                </div>
                <div
                  data-reveal={"up"}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    marginBottom: "20px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flex: "1 1 240px",
                      maxWidth: "360px",
                      height: "46px",
                      padding: "0 16px",
                      borderRadius: "999px",
                      border: "1px solid #ffffff26",
                      background: "#0D0814",
                      color: "#B5A6C4",
                    }}
                  >
                    <i
                      aria-hidden={true}
                      style={{ fontSize: "16px" }}
                      className={"ph ph-magnifying-glass"}
                    ></i>
                    <input
                      aria-label={attr("pg_roadmap|community|input@aria-label")}
                      value={v.iq}
                      onChange={v.onIQ}
                      placeholder={attr(
                        "pg_roadmap|community|input@placeholder",
                      )}
                      style={{
                        flex: "1",
                        minWidth: "0",
                        background: "transparent",
                        border: "0",
                        outline: "none",
                        color: "#F6F1FA",
                        fontFamily: "Arial,Helvetica,sans-serif",
                        fontSize: "14px",
                      }}
                    />
                  </label>
                  <span
                    aria-live={"polite"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "11px 16px",
                      borderRadius: "999px",
                      border: "1px solid #ffffff1f",
                      background: "#ffffff08",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#E9E0F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <i
                      aria-hidden={true}
                      style={{ fontSize: "15px", color: "#D4B7EC" }}
                      className={"ph-fill ph-arrow-fat-up"}
                    ></i>
                    {v.myVotes}
                  </span>
                </div>
                <div
                  data-reveal={"up"}
                  style={{ overflowX: "auto", paddingBottom: "6px" }}
                  className="roadmap-board-scroll"
                  tabIndex={0}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: String(v.boardCols),
                      gap: "14px",
                      alignItems: "start",
                    }}
                  >
                    {(v.cols || []).map((cl, clIndex) => (
                      <React.Fragment key={clIndex}>
                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            padding: "16px",
                            borderRadius: "22px",
                            border: "1px solid #ffffff17",
                            background: "#0D0814b3",
                            overflow: "hidden",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: "0",
                              right: "0",
                              top: "0",
                              height: "3px",
                              background: String(cl.accent),
                            }}
                          ></span>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                              padding: "6px 4px 0",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  color: "#9D8BAE",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {cl.idx}
                              </span>
                              <span
                                style={{ fontSize: "16px", fontWeight: "600" }}
                              >
                                {cl.k}
                              </span>
                              <span
                                style={{
                                  minWidth: "24px",
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background: "#ffffff12",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                {cl.n}
                              </span>
                            </span>
                            {cl.arrow && (
                              <>
                                <i
                                  aria-hidden={true}
                                  style={{ fontSize: "15px", color: "#6B5680" }}
                                  className={"ph ph-arrow-right"}
                                ></i>
                              </>
                            )}
                          </div>
                          <p
                            style={{
                              fontFamily: "Arial,Helvetica,sans-serif",
                              padding: "0 4px",
                              fontSize: "14px",
                              lineHeight: "1.5",
                              color: "#B5A6C4",
                            }}
                          >
                            {cl.desc}
                          </p>
                          {(cl.cards || []).map((cd, cdIndex) => (
                            <React.Fragment key={cdIndex}>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                  padding: "16px",
                                  borderRadius: "16px",
                                  border: "1px solid #ffffff14",
                                  background: "#1A0D27",
                                  transition: "border-color .3s",
                                }}
                                className={"reference-state-176"}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "10px",
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      border: "1px solid #ffffff26",
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      letterSpacing: ".06em",
                                      textTransform: "uppercase",
                                      color: "#D4B7EC",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {cd.theme}
                                  </span>
                                  <button
                                    onClick={cd.vote}
                                    aria-pressed={cd.vPressed}
                                    aria-label={cd.vLabel}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "6px 12px",
                                      borderRadius: "999px",
                                      border: "1px solid " + cd.vB,
                                      background: String(cd.vBg),
                                      color: String(cd.vC),
                                      fontSize: "13px",
                                      fontWeight: "700",
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "nowrap",
                                      transition: "all .3s",
                                    }}
                                  >
                                    <i
                                      aria-hidden={true}
                                      style={{ fontSize: "14px" }}
                                      className={"ph ph-arrow-fat-up"}
                                    ></i>
                                    {cd.votes}
                                  </button>
                                </div>
                                <span
                                  style={{
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    lineHeight: "1.3",
                                    letterSpacing: "-.01em",
                                  }}
                                >
                                  {cd.title}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "Arial,Helvetica,sans-serif",
                                    fontSize: "14px",
                                    lineHeight: "1.55",
                                    color: "#CFC2DB",
                                  }}
                                >
                                  {cd.body}
                                </span>
                                <button
                                  onClick={cd.comment}
                                  style={{
                                    alignSelf: "flex-start",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    color: "#D4B7EC",
                                    whiteSpace: "nowrap",
                                  }}
                                  className={"reference-state-177"}
                                >
                                  <i
                                    aria-hidden={true}
                                    style={{ fontSize: "15px" }}
                                    className={"ph ph-chat-circle-text"}
                                  ></i>
                                  {cd.comments}
                                </button>
                              </div>
                            </React.Fragment>
                          ))}
                          {cl.empty && (
                            <>
                              <div
                                style={{
                                  padding: "18px",
                                  borderRadius: "14px",
                                  border: "1px dashed #ffffff26",
                                  fontFamily: "Arial,Helvetica,sans-serif",
                                  fontSize: "13px",
                                  color: "#9D8BAE",
                                  textAlign: "center",
                                }}
                              >
                                {run("pg_roadmap|community|div-2", 1)}
                              </div>
                            </>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    marginTop: "20px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    border: "1px dashed #ffffff33",
                    fontFamily: "Arial,Helvetica,sans-serif",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    color: "#CFC2DB",
                  }}
                >
                  <i
                    aria-hidden={true}
                    style={{
                      fontSize: "16px",
                      color: "#D4B7EC",
                      flexShrink: "0",
                      marginTop: "1px",
                    }}
                    className={"ph ph-info"}
                  ></i>
                  <span>{run("pg_roadmap|community|div-3", 3)}</span>
                </div>
              </div>
            </section>
            <section
              data-cms-section="submit-idea"
              id={"submit-idea"}
              style={{
                background:
                  "radial-gradient(70% 60% at 100% 0%,#9458F424,transparent 70%),#EEE8F7",
                color: "#190B25",
                padding: "var(--section-space) 0",
              }}
            >
              <div
                style={{
                  maxWidth: "1440px",
                  margin: "0 auto",
                  padding: "0 clamp(20px,4.4vw,64px)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  gap: "40px clamp(40px,5vw,80px)",
                }}
              >
                <div style={{ flex: "1 1 420px", minWidth: "0" }}>
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
                      color: "#6E6178",
                    }}
                  >
                    <span style={{ color: "#6C3CAA" }}>
                      {run("pg_roadmap|submit-idea|div", 1)}
                    </span>
                    <span
                      style={{
                        width: "36px",
                        height: "1px",
                        background: "#190B252e",
                      }}
                    ></span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {run("pg_roadmap|submit-idea|div", 4)}
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
                        {run("pg_roadmap|submit-idea|h2", 3)}
                      </span>
                    </span>
                    <span style={{ display: "block" }}>
                      <span
                        data-line={""}
                        data-acc={""}
                        style={{ display: "block", color: "#6C3CAA" }}
                      >
                        {run("pg_roadmap|submit-idea|h2", 9)}
                      </span>
                    </span>
                  </h2>
                  <p
                    data-reveal={"up"}
                    style={{
                      fontFamily: "Arial,Helvetica,sans-serif",
                      marginTop: "22px",
                      maxWidth: "520px",
                      fontSize: "16px",
                      lineHeight: "1.65",
                      color: "#4A3A57",
                    }}
                  >
                    {run("pg_roadmap|submit-idea|p", 1)}
                  </p>
                  <div
                    data-reveal={"stagger"}
                    style={{
                      marginTop: "32px",
                      display: "flex",
                      flexDirection: "column",
                      borderTop: "1px solid #190B251f",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "18px 0",
                        borderBottom: "1px solid #190B251f",
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
                          background: "#190B25",
                          color: "#EEE3F7",
                          fontSize: "14px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_roadmap|submit-idea|div-2", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#190B25",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-2", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily: "Arial,Helvetica,sans-serif",
                            display: "block",
                            marginTop: "4px",
                            fontSize: "15px",
                            lineHeight: "1.55",
                            color: "#4A3A57",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-2", 11)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "18px 0",
                        borderBottom: "1px solid #190B251f",
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
                          background: "#190B25",
                          color: "#EEE3F7",
                          fontSize: "14px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_roadmap|submit-idea|div-3", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#190B25",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-3", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily: "Arial,Helvetica,sans-serif",
                            display: "block",
                            marginTop: "4px",
                            fontSize: "15px",
                            lineHeight: "1.55",
                            color: "#4A3A57",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-3", 11)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        padding: "18px 0",
                        borderBottom: "1px solid #190B251f",
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
                          background: "#190B25",
                          color: "#EEE3F7",
                          fontSize: "14px",
                          fontWeight: "700",
                        }}
                      >
                        {run("pg_roadmap|submit-idea|div-4", 2)}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#190B25",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-4", 7)}
                        </span>
                        <span
                          style={{
                            fontFamily: "Arial,Helvetica,sans-serif",
                            display: "block",
                            marginTop: "4px",
                            fontSize: "15px",
                            lineHeight: "1.55",
                            color: "#4A3A57",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|div-4", 11)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  data-reveal={"up"}
                  style={{
                    flex: "1 1 480px",
                    minWidth: "0",
                    padding: "clamp(24px,3vw,40px)",
                    borderRadius: "30px",
                    background: "#FFFFFFd9",
                    border: "1px solid #190B2514",
                    boxShadow: "0 40px 90px #3B1E591f",
                    color: "#190B25",
                  }}
                >
                  {v.ideaForm && (
                    <>
                      <form
                        onSubmit={v.submitIdea}
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
                            {run("pg_roadmap|submit-idea|div-5", 1)}
                          </div>
                          <div
                            data-hw={""}
                            style={{
                              marginTop: "8px",
                              fontSize: "clamp(24px,2.21vw,31px)",
                              fontWeight: "500",
                              letterSpacing: "-.035em",
                              lineHeight: "1.08",
                            }}
                          >
                            {run("pg_roadmap|submit-idea|div-6", 1)}
                          </div>
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
                          {ideaFormCopy().title}
                          <input
                            name="title"
                            type="text"
                            required
                            maxLength={180}
                            dir="auto"
                            placeholder={ideaFormCopy().placeholder}
                            className="reference-state-178"
                            style={{
                              minWidth: 0,
                              height: "52px",
                              padding: "0 16px",
                              borderRadius: "14px",
                              border: "1px solid #190B2526",
                              background: "#FFFFFF",
                              color: "#190B25",
                              font: "inherit",
                            }}
                          />
                        </label>
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#3B1E59",
                              marginBottom: "10px",
                            }}
                          >
                            {run("pg_roadmap|submit-idea|div-7", 1)}
                          </div>
                          <div
                            role={"group"}
                            aria-label={attr(
                              "pg_roadmap|submit-idea|div@aria-label",
                            )}
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
                                  aria-pressed={tp.pressed}
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
                              "repeat(auto-fit,minmax(min(100%,220px),1fr))",
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
                            {"Your name"}
                            <input
                              name={"name"}
                              required
                              type={"text"}
                              placeholder={attr(
                                "pg_roadmap|submit-idea|input@placeholder",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily: "Arial,Helvetica,sans-serif",
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-178"}
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
                            {"Email address"}
                            <input
                              name={"email"}
                              required
                              type={"email"}
                              placeholder={attr(
                                "pg_roadmap|submit-idea|input@placeholder-2",
                              )}
                              autoComplete={"off"}
                              style={{
                                height: "52px",
                                padding: "0 16px",
                                borderRadius: "14px",
                                border: "1px solid #190B2526",
                                background: "#FFFFFF",
                                color: "#190B25",
                                fontFamily: "Arial,Helvetica,sans-serif",
                                fontSize: "15px",
                                outline: "none",
                              }}
                              className={"reference-state-179"}
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
                          {"Message"}
                          <textarea
                            name={"message"}
                            required
                            maxLength={5000}
                            rows={"5"}
                            placeholder={attr(
                              "pg_roadmap|submit-idea|textarea@placeholder",
                            )}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "14px",
                              border: "1px solid #190B2526",
                              background: "#FFFFFF",
                              color: "#190B25",
                              fontFamily: "Arial,Helvetica,sans-serif",
                              fontSize: "15px",
                              lineHeight: "1.6",
                              resize: "vertical",
                              outline: "none",
                            }}
                            className={"reference-state-180"}
                          ></textarea>
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                            fontSize: "13px",
                            lineHeight: 1.6,
                            color: "#4A3A57",
                          }}
                        >
                          <input
                            name="consent"
                            type="checkbox"
                            required
                            style={{
                              marginTop: "4px",
                              accentColor: "#6C3CAA",
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            {ideaFormCopy().consent}{" "}
                            <a
                              href={toSiteHref("/legal/privacy")}
                              style={{
                                color: "#3B1E59",
                                textDecoration: "underline",
                              }}
                            >
                              {ideaFormCopy().privacy}
                            </a>
                          </span>
                        </label>
                        {v.hasIdeaErr && (
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
                              {v.ideaErr}
                            </div>
                          </>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "16px",
                          }}
                        >
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
                              whiteSpace: "nowrap",
                              transition:
                                "background .3s, transform .45s cubic-bezier(.22,1,.36,1)",
                            }}
                            className={"reference-state-181"}
                            disabled={v.ideaSending}
                            aria-busy={v.ideaSending ? "true" : "false"}
                          >
                            {run("pg_roadmap|submit-idea|button", 1)}
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
                                className={"ph ph-lightbulb"}
                              ></i>
                            </span>
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                  {v.ideaSent && (
                    <>
                      <div
                        role={"status"}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "16px",
                          padding: "8px 0",
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
                          }}
                        >
                          {msg("Roadmap:35", [v.ideaName])}
                        </div>
                        <p
                          style={{
                            fontFamily: "Arial,Helvetica,sans-serif",
                            maxWidth: "52ch",
                            fontSize: "16px",
                            lineHeight: "1.65",
                            color: "#4A3A57",
                          }}
                        >
                          {run("pg_roadmap|submit-idea|p-2", 1)}
                        </p>
                        <button
                          onClick={v.ideaReset}
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
                          {run("pg_roadmap|submit-idea|button-2", 2)}
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
                            {run("pg_roadmap|submit-idea|div-8", 1)}
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
                              href={toSiteHref("#timeline")}
                              onClick={v.goTL}
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
                              className={"reference-state-182"}
                            >
                              {run("pg_roadmap|submit-idea|a", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                            <a
                              href={toSiteHref("#community")}
                              onClick={v.goCM}
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
                              className={"reference-state-183"}
                            >
                              {run("pg_roadmap|submit-idea|a-2", 1)}
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "14px" }}
                                className={"ph ph-arrow-up-right"}
                              ></i>
                            </a>
                            <a
                              href={toSiteHref("Contact.dc.html")}
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
                              className={"reference-state-184"}
                            >
                              {run("pg_roadmap|submit-idea|a-3", 1)}
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
              </div>
            </section>
            {v.hasActive && (
              <>
                <div
                  onClick={v.closeDlg}
                  style={{
                    position: "fixed",
                    inset: "0",
                    zIndex: "300",
                    display: "grid",
                    placeItems: "center",
                    padding: "20px",
                    background: "#0D0814b8",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div
                    role={"dialog"}
                    aria-modal={"true"}
                    aria-labelledby={"rm-dlg-title"}
                    onClick={v.stop}
                    style={{
                      width: "100%",
                      maxWidth: "660px",
                      maxHeight: "calc(100vh - 40px)",
                      overflow: "auto",
                      padding: "clamp(24px,3vw,38px)",
                      borderRadius: "28px",
                      border: "1px solid #ffffff1f",
                      background: "linear-gradient(160deg,#1E1030,#120A1B)",
                      boxShadow: "0 40px 120px #000000a6",
                      color: "#F6F1FA",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".16em",
                          textTransform: "uppercase",
                          color: "#C9A0F3",
                        }}
                      >
                        {v.dlg.eyebrow}
                      </span>
                      <button
                        onClick={v.closeDlg}
                        aria-label={attr("pg_roadmap|intro|button@aria-label")}
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          border: "1px solid #ffffff26",
                          color: "#F6F1FA",
                        }}
                        className={"reference-state-185"}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "17px" }}
                          className={"ph ph-x"}
                        ></i>
                      </button>
                    </div>
                    <h2
                      id={"rm-dlg-title"}
                      data-hw={""}
                      style={{
                        marginTop: "18px",
                        fontSize: "var(--section-title-size)",
                        lineHeight: "1.04",
                        fontWeight: "500",
                        letterSpacing: "-.04em",
                        textWrap: "balance",
                      }}
                    >
                      {v.dlg.title}
                    </h2>
                    <p
                      style={{
                        fontFamily: "Arial,Helvetica,sans-serif",
                        marginTop: "14px",
                        fontSize: "16px",
                        lineHeight: "1.65",
                        color: "#CFC2DB",
                      }}
                    >
                      {v.dlg.body}
                    </p>
                    <SectionMedia items={v.dlg.media} />

                    {v.dlg.hasComments && (
                      <section
                        data-cms-section="section-1"
                        aria-labelledby="rm-comments-title"
                        data-idea-comments=""
                        style={{ marginTop: 22 }}
                      >
                        <h3
                          id="rm-comments-title"
                          style={{ fontSize: 20, fontWeight: 600 }}
                        >
                          {run("pg_roadmap|section-1|h3", 0)}
                        </h3>
                        <p
                          role="note"
                          style={{
                            marginTop: 8,
                            color: "#CFC2DB",
                            fontSize: 14,
                            lineHeight: 1.6,
                          }}
                        >
                          {run("pg_roadmap|section-1|p", 0)}
                        </p>
                        {v.dlg.commentThread.length ? (
                          <ol
                            style={{
                              listStyle: "none",
                              padding: 0,
                              margin: "16px 0 0",
                              display: "grid",
                              gap: 12,
                            }}
                          >
                            {v.dlg.commentThread.map((comment) => (
                              <li
                                key={comment.id}
                                data-idea-comment={comment.id}
                                style={{
                                  padding: "16px 18px",
                                  border: "1px solid #ffffff26",
                                  borderRadius: 16,
                                  background: "#ffffff05",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                <p
                                  style={{
                                    color: "#D4B7EC",
                                    fontSize: 13,
                                    fontWeight: 600,
                                  }}
                                >
                                  {comment.author}
                                </p>
                                <p
                                  style={{
                                    marginTop: 8,
                                    color: "#F6F1FA",
                                    fontSize: 16,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {comment.body}
                                </p>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p
                            style={{
                              marginTop: 16,
                              color: "#CFC2DB",
                              fontSize: 16,
                              lineHeight: 1.6,
                            }}
                          >
                            {run("pg_roadmap|section-1|p-2", 0)}
                          </p>
                        )}
                      </section>
                    )}
                    <div
                      style={{
                        marginTop: "22px",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(140px,1fr))",
                        gap: "1px",
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "1px solid #ffffff17",
                        background: "#ffffff17",
                      }}
                    >
                      {(v.dlg.facts || []).map((fc, fcIndex) => (
                        <React.Fragment key={fcIndex}>
                          <div
                            style={{
                              padding: "14px 16px",
                              background: "#150C20",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                letterSpacing: ".14em",
                                textTransform: "uppercase",
                                color: "#9D8BAE",
                              }}
                            >
                              {fc.k}
                            </div>
                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "15px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {fc.v}
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {v.dlg.hasBar && (
                      <>
                        <div style={{ marginTop: "18px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#9D8BAE",
                            }}
                          >
                            <span>{v.dlg.pLabel}</span>
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                color: "#F6F1FA",
                              }}
                            >
                              {v.dlg.pct}
                            </span>
                          </div>
                          <div
                            style={{
                              marginTop: "8px",
                              height: "6px",
                              borderRadius: "6px",
                              background: "#ffffff14",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: String(v.dlg.pct),
                                borderRadius: "6px",
                                background:
                                  "linear-gradient(90deg,#9458F4,#D4B7EC)",
                              }}
                            ></div>
                          </div>
                        </div>
                      </>
                    )}
                    <div
                      aria-label={attr("pg_roadmap|intro|div@aria-label")}
                      style={{
                        marginTop: "22px",
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(120px,1fr))",
                        gap: "8px",
                      }}
                    >
                      {(v.dlg.steps || []).map((st, stIndex) => (
                        <React.Fragment key={stIndex}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "10px 12px",
                              borderRadius: "12px",
                              border: "1px solid " + st.b,
                              background: String(st.bg),
                              color: String(st.c),
                              fontSize: "13px",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "15px" }}
                              className={st.icon}
                            ></i>
                            {st.k}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                        marginTop: "20px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        border: "1px dashed #ffffff33",
                        fontFamily: "Arial,Helvetica,sans-serif",
                        fontSize: "14px",
                        lineHeight: "1.5",
                        color: "#CFC2DB",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{
                          fontSize: "16px",
                          color: "#D4B7EC",
                          flexShrink: "0",
                          marginTop: "1px",
                        }}
                        className={"ph ph-info"}
                      ></i>
                      <span>{run("pg_roadmap|intro|div-2", 3)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "22px",
                      }}
                    >
                      <button
                        onClick={v.closeDlg}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "13px 20px",
                          borderRadius: "999px",
                          background: "#EEE3F7",
                          color: "#28123B",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          className={"ph ph-arrow-left"}
                        ></i>
                        {run("pg_roadmap|intro|button", 2)}
                      </button>
                      <button
                        onClick={v.copy}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "13px 20px",
                          borderRadius: "999px",
                          border: "1px solid #ffffff2e",
                          color: "#F6F1FA",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                        className={"reference-state-186"}
                      >
                        <i aria-hidden={true} className={"ph ph-copy"}></i>
                        {v.copyLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
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
                left: "7%",
                right: "7%",
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
                  className={"reference-state-187"}
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
                    fontFamily: "Arial,Helvetica,sans-serif",
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
                  className={"reference-state-188"}
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
                        className={"reference-state-189"}
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
                        className={"reference-state-190"}
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
                      className={"reference-state-191"}
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
                  className={"reference-state-192 reference-state-193"}
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
      </>,
      "pg_roadmap",
    );
  }
}
