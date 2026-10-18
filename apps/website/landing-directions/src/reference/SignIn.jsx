import { managedPageTree } from "../content/managed-page";
import { content } from "../content";
import { bare } from "../content/locale";
import React from "react";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";
import { ReferencePage } from "./ReferencePage";
import { routeHash, setRoute, toSiteHref } from "./navigation";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";
import {
  getPreviewCustomer,
  subscribePreviewCustomer,
  signInPreviewCustomer,
} from "./purchase-identity.js";
import { resetInSuite, signInToSuite, signUpToSuite } from "./suite-session.js";

let accountTabToFocus = null;

export default class SignIn extends ReferencePage {
  X = 0;
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";
  H = "OrgTik%20Home.dc.html";
  CONTACT = "Contact.dc.html";
  state = {
    route: this.parseRoute(routeHash()) || { view: "index" },
    mode: bare(window.location.pathname) === "/sign-up" ? "signup" : "signin",
    done:
      bare(window.location.pathname) !== "/sign-up" && !!getPreviewCustomer(),
    error: "",
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
    this.unsubscribeIdentity = subscribePreviewCustomer(() =>
      this.setState({ done: !!getPreviewCustomer(), error: "" }),
    );
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
      if (r) this.setState({ route: r, menuOpen: false });
    };
    window.addEventListener("hashchange", this.onHash);
    this.onAccountPath = () => {
      const mode =
        bare(window.location.pathname) === "/sign-up" ? "signup" : "signin";
      if (this.state.mode !== mode)
        this.setState({ mode, done: false, error: "" });
    };
    window.addEventListener("popstate", this.onAccountPath);
    this.srcMO = new MutationObserver(() => this.applyDataSrc());
    this.srcMO.observe(root, { childList: true, subtree: true });
    this.afterView(true);
    if (accountTabToFocus) {
      document.getElementById(`account-${accountTabToFocus}-tab`)?.focus();
      accountTabToFocus = null;
    }
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    const accountMode =
      bare(window.location.pathname) === "/sign-up" ? "signup" : "signin";
    if (this.state.mode !== "recover" && this.state.mode !== accountMode) {
      this.setState({ mode: accountMode, done: false, error: "" });
      return;
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
    this.unsubscribeIdentity?.();
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("popstate", this.onAccountPath);
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
    ticker = [
      msg("SignIn:1"),
      msg("SignIn:2"),
      msg("SignIn:3"),
      msg("SignIn:4"),
      msg("SignIn:5"),
      msg("SignIn:6"),
      msg("SignIn:7"),
    ];
    hero = {
      hasCrumb: false,
      root: msg("SignIn:8"),
      crumb: "",
      crumbRootC: "#FFFFFF",
      eyebrow: msg("SignIn:9"),
      l1: msg("SignIn:10"),
      l2: "",
      acc: msg("SignIn:11"),
      body: msg("SignIn:12"),
      primary: msg("SignIn:13"),
      primaryGo: () => this.go("signin"),
      secondary: msg("SignIn:14"),
      secondaryGo: () => this.nav("Software.dc.html"),
    };
    const rec = s.mode === "recover";
    const signup = s.mode === "signup";
    const pickMode = (mode) => {
      const path = mode === "signup" ? "/sign-up" : "/sign-in";
      if (bare(window.location.pathname) !== path && window.__orgNav) {
        accountTabToFocus = mode;
        window.__orgNav(path);
        return;
      }
      this.setState({ mode, done: false, error: "" }, () => {
        const selector =
          mode === "recover"
            ? "#account-panel input[name=email]"
            : `#account-${mode}-tab`;
        this.rootRef.current?.querySelector(selector)?.focus();
      });
    };
    page = {
      modes: [
        ["signin", msg("SignIn:15")],
        ["signup", msg("SignIn:16")],
      ].map((m) => ({
        id: m[0],
        label: m[1],
        active: signup ? m[0] === "signup" : m[0] === "signin",
        pick: () => pickMode(m[0]),
      })),
      activeTabId: "account-" + (signup ? "signup" : "signin") + "-tab",
      showReset: !rec && !signup,
      isRecover: rec,
      resetPassword: () => pickMode("recover"),
      backToSignin: () => pickMode("signin"),
      showForm: !s.done,
      done: s.done,
      isSignin: !rec,
      isSignup: signup,
      hasError: !!s.error,
      error: s.error,
      title: rec
        ? msg("SignIn:18")
        : signup
          ? msg("SignIn:19")
          : msg("SignIn:20"),
      sub: rec
        ? msg("SignIn:21")
        : signup
          ? msg("SignIn:22")
          : msg("SignIn:23"),
      cta: rec
        ? msg("SignIn:24")
        : signup
          ? msg("SignIn:25")
          : msg("SignIn:26"),
      doneTitle: rec
        ? msg("SignIn:27")
        : signup
          ? msg("SignIn:28")
          : msg("SignIn:29"),
      doneBody: rec
        ? msg("SignIn:30")
        : signup
          ? msg("SignIn:31")
          : msg("SignIn:32"),
      back: () => this.setState({ done: false }),
      submit: (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          em = String(f.get("email") || "").trim(),
          pw = String(f.get("password") || ""),
          name = String(f.get("name") || "").trim(),
          confirm = String(f.get("confirmPassword") || "");
        if (!em || (!rec && !pw)) {
          this.setState({
            error: rec ? msg("SignIn:33") : msg("SignIn:34"),
          });
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          this.setState({ error: msg("SignIn:35") });
          return;
        }
        if (signup && !name) {
          this.setState({ error: msg("SignIn:36") });
          return;
        }
        if (signup && pw.length < 8) {
          this.setState({
            error: msg("SignIn:37"),
          });
          return;
        }
        if (signup && pw !== confirm) {
          this.setState({ error: msg("SignIn:38") });
          return;
        }
        // Reset password continues in the suite: it sends the code, its page takes the new password.
        if (rec) {
          if (this.signingIn) return;
          this.signingIn = true;
          resetInSuite(em)
            .then((href) => window.location.assign(href))
            .catch(() => {
              this.signingIn = false;
              this.setState({ error: msg("SuiteSignIn:2") });
            });
          return;
        }
        // Sign in and Create account open the suite, signed in with that account.
        if (this.signingIn) return;
        this.signingIn = true;
        (signup
          ? signUpToSuite({ name, email: em, password: pw })
          : signInToSuite(em, pw)
        )
          .then(({ user, href }) => {
            signInPreviewCustomer({
              name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
              email: em,
              company: "",
            });
            window.location.assign(href);
          })
          .catch((err) => {
            this.signingIn = false;
            this.setState({
              error:
                err.message === "credentials"
                  ? msg("SuiteSignIn:1")
                  : err.message === "exists"
                    ? msg("SuiteSignIn:3")
                    : msg("SuiteSignIn:2"),
            });
          });
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
        menuLinks: content.MENU(),
        hero: hero,
        cta: cta,
        tickerLabel: msg("SignIn:39"),
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
        footExplore: content.FOOT_EXPLORE(),
        footStart: content.FOOT_START(),
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
    return (
      managedPageTree(<>
        <div
          ref={v.rootRef}
          data-screen-label={v.isSignup ? "Create account" : "Sign in"}
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
                {run("pg_signIn|intro|div", 2)}
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
                      className={"reference-state-194"}
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
                      className={"reference-state-195"}
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
                      className={"reference-state-196"}
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
                      className={"reference-state-197"}
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
                      className={"reference-state-198"}
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
                      className={"reference-state-199"}
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
                      className={"reference-state-201"}
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
                    onClick={v.openMenu}
                    aria-label={attr("gl_header|header|button@aria-label")}
                    aria-expanded={v.menuOpen}
                    data-menu-toggle=""
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
                    alt={attr("pg_signIn|intro|img@alt")}
                    style={{ width: "104px" }}
                  />
                  <button
                    aria-label={attr("pg_signIn|intro|button@aria-label")}
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
                  {run("pg_signIn|intro|a", 1)}
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
            <section data-cms-section="signin"
              id={"signin"}
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
                  justifyContent: "center",
                }}
              >
                <div
                  data-reveal={"up"}
                  style={{
                    width: "100%",
                    maxWidth: "520px",
                    padding: "clamp(26px,3vw,44px)",
                    borderRadius: "28px",
                    background: "#FFFFFFc7",
                    border: "1px solid #190B2514",
                    boxShadow: "0 30px 70px #190B2514",
                  }}
                >
                  <div
                    className="account-modes"
                    role="tablist"
                    aria-label={attr("pg_signIn|signin|div@aria-label")}
                    style={{
                      display: "flex",
                      gap: "6px",
                      padding: "5px",
                      borderRadius: "999px",
                      background: "#190B250d",
                      marginBottom: "26px",
                    }}
                  >
                    {(v.modes || []).map((m, mIndex) => (
                      <React.Fragment key={mIndex}>
                        <button
                          type="button"
                          id={`account-${m.id}-tab`}
                          role="tab"
                          aria-controls="account-panel"
                          aria-selected={m.active}
                          tabIndex={m.active ? 0 : -1}
                          onClick={m.pick}
                          onKeyDown={(event) => {
                            let index;
                            if (event.key === "ArrowRight")
                              index = (mIndex + 1) % v.modes.length;
                            else if (event.key === "ArrowLeft")
                              index =
                                (mIndex + v.modes.length - 1) % v.modes.length;
                            else if (event.key === "Home") index = 0;
                            else if (event.key === "End")
                              index = v.modes.length - 1;
                            else return;
                            event.preventDefault();
                            v.modes[index].pick();
                          }}
                          style={{
                            flex: "1 1 0",
                            minHeight: "44px",
                            padding: "11px 14px",
                            borderRadius: "999px",
                            background: m.active ? "#190B25" : "transparent",
                            color: m.active ? "#F6F1FA" : "#190B25",
                            fontSize: "14px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div
                    id="account-panel"
                    role="tabpanel"
                    aria-labelledby={v.activeTabId}
                  >
                    {v.showForm && (
                      <>
                        <form
                          onSubmit={v.submit}
                          noValidate
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                          }}
                        >
                          <h1
                            data-hw={""}
                            style={{
                              fontSize: "clamp(26px,2.21vw,33px)",
                              fontWeight: "500",
                              letterSpacing: "-.04em",
                            }}
                          >
                            {v.title}
                          </h1>
                          <p
                            style={{
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              fontSize: "15px",
                              lineHeight: "1.6",
                              color: "#4A3A57",
                            }}
                          >
                            {v.sub}
                          </p>
                          {v.isSignup && (
                            <label className="account-field">
                              {run("pg_signIn|signin|label", 0)}
                              <input
                                name="name"
                                type="text"
                                autoComplete="name"
                                placeholder={attr(
                                  "pg_signIn|signin|input@placeholder",
                                )}
                              />
                            </label>
                          )}
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
                            {"Work email"}
                            <input
                              name={"email"}
                              type={"email"}
                              placeholder={attr(
                                "pg_signIn|signin|input@placeholder-2",
                              )}
                              autoComplete={v.isSignup ? "email" : "username"}
                              style={{
                                height: "54px",
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
                              className={"reference-state-206"}
                            />
                          </label>
                          {v.isSignin && (
                            <>
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
                                {"Password"}
                                <input
                                  name={"password"}
                                  type={"password"}
                                  placeholder={"••••••••"}
                                  autoComplete={
                                    v.isSignup
                                      ? "new-password"
                                      : "current-password"
                                  }
                                  style={{
                                    height: "54px",
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
                                  className={"reference-state-207"}
                                />
                              </label>
                            </>
                          )}
                          {v.isSignup && (
                            <label className="account-field">
                              {run("pg_signIn|signin|label-2", 0)}
                              <input
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                              />
                            </label>
                          )}
                          {v.hasError && (
                            <>
                              <div
                                role={"alert"}
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: "12px",
                                  background: "#A0254414",
                                  color: "#8A1F3A",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                }}
                              >
                                {v.error}
                              </div>
                            </>
                          )}
                          <button
                            type={"submit"}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              minHeight: "52px",
                              padding: "7px 7px 7px 24px",
                              borderRadius: "999px",
                              background: "#190B25",
                              color: "#F6F1FA",
                              fontSize: "15px",
                              fontWeight: "600",
                            }}
                          >
                            {v.cta}
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
                                className={"ph ph-arrow-right"}
                              ></i>
                            </span>
                          </button>
                          {(v.showReset || v.isRecover) && (
                            <button
                              type="button"
                              className="account-recovery-link"
                              onClick={
                                v.isRecover ? v.backToSignin : v.resetPassword
                              }
                            >
                              {v.isRecover
                                ? msg("SignIn:40")
                                : msg("SignIn:41")}
                            </button>
                          )}
                          <p
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
                              style={{ color: "#6C3CAA", flexShrink: "0" }}
                              className={"ph ph-info"}
                            ></i>
                            {run("pg_signIn|signin|p", 2)}
                          </p>
                        </form>
                      </>
                    )}
                    {v.done && (
                      <>
                        <div
                          role={"status"}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px",
                          }}
                        >
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: "60px",
                              height: "60px",
                              borderRadius: "50%",
                              background: "#6C3CAA",
                              color: "#FFFFFF",
                            }}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "25px" }}
                              className={"ph ph-check"}
                            ></i>
                          </span>
                          <h1
                            data-hw={""}
                            style={{
                              fontSize: "27px",
                              fontWeight: "500",
                              letterSpacing: "-.04em",
                            }}
                          >
                            {v.doneTitle}
                          </h1>
                          <p
                            style={{
                              fontFamily:
                                '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                              fontSize: "15px",
                              lineHeight: "1.6",
                              color: "#4A3A57",
                            }}
                          >
                            {v.doneBody}
                          </p>
                          <button
                            onClick={v.back}
                            style={{
                              alignSelf: "flex-start",
                              padding: "12px 18px",
                              borderRadius: "999px",
                              border: "1px solid #190B2533",
                              fontSize: "14px",
                              fontWeight: "600",
                            }}
                          >
                            {run("pg_signIn|signin|button", 1)}
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
                              {run("pg_signIn|signin|div", 1)}
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
                                className={"reference-state-208"}
                              >
                                {run("pg_signIn|signin|a", 1)}
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
                                className={"reference-state-209"}
                              >
                                {run("pg_signIn|signin|a-2", 1)}
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
                                className={"reference-state-210"}
                              >
                                {run("pg_signIn|signin|a-3", 1)}
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
                  className={"reference-state-211"}
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
                  className={"reference-state-212"}
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
                        className={"reference-state-213"}
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
                        className={"reference-state-214"}
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
                      className={"reference-state-215"}
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
                  className={"reference-state-216 reference-state-217"}
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
      </>, "pg_signIn")
    );
  }
}
