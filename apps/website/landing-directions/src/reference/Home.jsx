import { managedPageTree } from "../content/managed-page";
import { content } from "../content";
import { Testimonials } from "./Testimonials";
import { FAQSection } from "./FAQSection";
import { PartnerStrip } from "./Partners";
import React from "react";
import { nudge } from "../content/locale";
import { LanguageMenu } from "./LanguageMenu";
import { AccountControl } from "./AccountControl";
import { CartLink } from "./CartControls";
import { ReferencePage } from "./ReferencePage";
import { toSiteHref } from "./navigation";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

export default class Home extends ReferencePage {
  state = {
    heroIdx: 0,
    xwide: window.innerWidth >= 1180,
    side: null,
    svcHover: null,
    svcOpen: 0,
    workHover: null,
    mod: 0,
    lineDeg: -90,
    proc: 0,
    narrow: window.innerWidth < 900,
    menuOpen: false,
  };
  rootRef = React.createRef();
  headerRef = React.createRef();
  videoRef = React.createRef();
  heroMediaRef = React.createRef();
  parallaxRef = React.createRef();
  svcListRef = React.createRef();
  floatRef = React.createRef();
  explorerRef = React.createRef();
  procRef = React.createRef();
  closingRef = React.createRef();
  glowRef = React.createRef();
  magnetRef = React.createRef();
  cursorRef = React.createRef();
  cursorBubble = React.createRef();
  floatImgRef = React.createRef();
  MODS = content.HOME_MODS();
  HERO_WORDS = content.HERO_WORDS();
  SVCS = content.SVCS();
  STEPS = content.STEPS();
  FAQS = content.FAQS();
  SOCIALS = content.SOCIALS();
  E = "cubic-bezier(.16,1,.3,1)";

  PAL = {
    "Lavender mist": {
      base: "#EEE8F7",
      alt: "#E5DDF2",
      tile: "#DCD1EC",
      glow: "#9458F424",
    },
    Porcelain: {
      base: "#F4F1F9",
      alt: "#EBE6F4",
      tile: "#E2DBEE",
      glow: "#9458F41a",
    },
    Moonstone: {
      base: "#ECEBF1",
      alt: "#E2E0EA",
      tile: "#D8D5E2",
      glow: "#6C3CAA1f",
    },
    "Paper (original)": {
      base: "#F5F3EF",
      alt: "#ECE8E1",
      tile: "#E4DFD7",
      glow: "#9458F414",
    },
  };
  pal() {
    return this.PAL[this.props.surface] || this.PAL[msg("Home:1")];
  }
  applySurface() {
    const root = this.rootRef.current;
    if (!root) return;
    const p = this.pal();
    const map = {
      base: p.base,
      alt: p.alt,
      tile: p.tile,
      "base-glow":
        "radial-gradient(70% 60% at 100% 0%, " +
        p.glow +
        ", transparent 70%), " +
        p.base,
      "alt-glow":
        "radial-gradient(60% 70% at 0% 100%, " +
        p.glow +
        ", transparent 70%), " +
        p.alt,
      halo:
        "radial-gradient(55% 60% at 92% 0%, " + p.glow + ", transparent 72%)",
    };
    root.querySelectorAll("[data-surface]").forEach((el) => {
      const v = map[el.getAttribute("data-surface")];
      if (v) el.style.background = v;
    });
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
  mirrorFloat(i) {
    const root = this.rootRef.current,
      fi = this.floatImgRef.current;
    if (!root || !fi) return;
    const slot = root.querySelector("#a-svc-0" + (i + 1));
    const img =
      slot && slot.hasAttribute("data-filled") && slot.shadowRoot
        ? slot.shadowRoot.querySelector(".frame img")
        : null;
    fi.src = (img && img.src) || "/assets/" + this.SVCS[i].image;
    fi.style.opacity = "1";
  }
  setupMarquees() {
    const root = this.rootRef.current;
    if (!root || this.reduced || !root.animate) return;
    this.loops = this.loops || [];
    root.querySelectorAll("[data-marquee]").forEach((el) => {
      if (el.__loop) return;
      el.__loop = true;
      const a = el.animate(
        [
          { transform: "translate3d(0,0,0)" },
          { transform: "translate3d(-50%,0,0)" },
        ],
        { duration: +el.getAttribute("data-marquee"), iterations: Infinity },
      );
      a.playbackRate = this.props.motion === "Subtle" ? 0.4 : 1;
      this.loops.push(a);
      if (el.hasAttribute("data-logo-track")) this.logoAnim = a;
    });
  }
  setupLogoMirrors() {
    const root = this.rootRef.current;
    if (!root || !window.customElements) return;
    customElements.whenDefined("image-slot").then(() => {
      if (!this.rootRef.current) return;
      this.logoMO = this.logoMO || [];
      root.querySelectorAll("image-slot[data-logo]").forEach((slot) => {
        const mirror = root.querySelector(
          '[data-logo-mirror="' + slot.id + '"]',
        );
        if (!mirror || !slot.shadowRoot) return;
        const sync = () => {
          const im = slot.shadowRoot.querySelector(".frame img");
          const src =
            slot.hasAttribute("data-filled") && im && im.src
              ? im.currentSrc || im.src
              : slot.getAttribute("src") || slot.getAttribute("data-src");
          if (
            src &&
            src.indexOf("{{") < 0 &&
            mirror.getAttribute("src") !== src
          )
            mirror.src = src;
        };
        const mo = new MutationObserver(sync);
        mo.observe(slot, { attributes: true });
        mo.observe(slot.shadowRoot, {
          subtree: true,
          attributes: true,
          attributeFilter: ["src"],
        });
        this.logoMO.push(mo);
        sync();
      });
    });
  }
  rotateHero() {
    const root = this.rootRef.current;
    if (!root || this.reduced || document.hidden) return;
    const el = root.querySelector("[data-rot]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const next = () =>
      this.setState((st) => ({
        heroIdx: (st.heroIdx + 1) % this.HERO_WORDS.length,
      }));
    if (!el.animate) return next();
    const out = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "translateY(-108%)", opacity: 0 },
      ],
      { duration: 420, easing: "cubic-bezier(.7,0,.84,0)", fill: "forwards" },
    );
    out.onfinish = () =>
      this.setState(
        (st) => ({ heroIdx: (st.heroIdx + 1) % this.HERO_WORDS.length }),
        () => {
          out.cancel();
          el.animate(
            [
              { transform: "translateY(108%)", opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
            { duration: 760, easing: this.E, fill: "backwards" },
          );
        },
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
  applyHeadings() {
    const root = this.rootRef.current;
    if (!root) return;
    const m = this.props.headings || msg("Home:2");
    const hw = m === "Medium" ? "500" : "600",
      aw = m === "Contrast" ? "300" : hw,
      ai = m === "Contrast" ? "italic" : "normal";
    root.querySelectorAll("[data-hw]").forEach((el) => {
      el.style.fontWeight = hw;
    });
    root.querySelectorAll("[data-acc]").forEach((el) => {
      el.style.fontWeight = aw;
      el.style.fontStyle = ai;
    });
  }
  applyMotion() {
    const sub = this.props.motion === "Subtle";
    (this.loops || []).forEach((a) => {
      a.playbackRate = sub ? 0.4 : 1;
    });
    if (sub && this.parallaxRef.current)
      this.parallaxRef.current.style.transform = "";
    if (sub && this.magnetRef.current)
      this.magnetRef.current.style.transform = "";
  }
  componentDidMount() {
    super.componentDidMount();
    const root = this.rootRef.current;
    if (!root) return;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.setupHeroVideo();
    this.applySurface();
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
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(root);
    this.heroIntro();
    this.setupReveals();
    this.setupLoops();
    this.setupCursor();
    this.applyDataSrc();
    this.applyMotion();
    this.applyHeadings();
    this.heroRotT = setTimeout(() => {
      this.heroRot = setInterval(() => this.rotateHero(), 3000);
    }, 1800);
    this.setupLogoMirrors();
    this.modVisible = false;
    this.modIO = new IntersectionObserver(
      ([e]) => {
        this.modVisible = e.isIntersecting;
        if (this.modAnim)
          e.isIntersecting ? this.modAnim.play() : this.modAnim.pause();
      },
      { threshold: 0.3 },
    );
    if (this.explorerRef.current) this.modIO.observe(this.explorerRef.current);
    this.startModTimer();
    this.procIO = new IntersectionObserver(
      ([e]) => {
        this.procVisible = e.isIntersecting;
      },
      { threshold: 0.35 },
    );
    if (this.procRef.current) this.procIO.observe(this.procRef.current);
    this.procTimer = setInterval(() => {
      if (
        this.procVisible &&
        !this.procHover &&
        !this.reduced &&
        !document.hidden
      )
        this.setState((s) => ({ proc: (s.proc + 1) % 4 }));
    }, 3800);
  }
  componentDidUpdate(pp, ps) {
    pp = pp || {};
    ps = ps || this._prev || this.state;
    this._prev = this.state;
    if (pp.ticker !== this.props.ticker)
      requestAnimationFrame(() => this.setupMarquees());
    this.applyDataSrc();
    if (pp.motion !== this.props.motion) this.applyMotion();
    if (pp.headings !== this.props.headings) this.applyHeadings();
    if (ps.mod !== this.state.mod) {
      this.startModTimer();
      this.swapIn();
    }
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.measure);
    clearTimeout(this.heroRotT);
    clearInterval(this.heroRot);
    (this.logoMO || []).forEach((m) => m.disconnect());
    clearTimeout(this.logoT);
    if (this.heroIO) this.heroIO.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    [this.io, this.modIO, this.procIO].forEach((o) => o && o.disconnect());
    if (this.ro) this.ro.disconnect();
    clearInterval(this.procTimer);
    (this.loops || []).forEach((a) => a.cancel());
    if (this.modAnim) this.modAnim.cancel();
    cancelAnimationFrame(this.fRaf);
  }
  syncScroll() {
    const h = this.headerRef.current;
    if (!h) return;
    const y = window.scrollY,
      s = y > 40;
    Object.assign(
      h.style,
      s
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
    if (p && !this.reduced && this.props.motion !== "Subtle" && y < 1400)
      p.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
  }
  heroIntro() {
    const root = this.rootRef.current;
    if (this.reduced || !root.animate) return;
    root.querySelectorAll("[data-hero-line]").forEach((l, i) =>
      l.animate([{ transform: "translateY(112%)" }, { transform: "none" }], {
        duration: 1400,
        delay: 200 + i * 130,
        easing: this.E,
        fill: "backwards",
      }),
    );
    root.querySelectorAll("[data-hero-fade]").forEach((l, i) =>
      l.animate(
        [
          { opacity: 0, transform: "translateY(26px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 1100,
          delay: 650 + i * 110,
          easing: this.E,
          fill: "backwards",
        },
      ),
    );
    const hm = this.heroMediaRef.current;
    if (hm)
      hm.animate(
        [
          { transform: "scale(1.14)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 2600, easing: this.E, fill: "backwards" },
      );
  }
  setupReveals() {
    const root = this.rootRef.current;
    if (this.reduced || !root.animate) return;
    const E = this.E;
    const run = (el) => {
      if (el.hasAttribute("data-count")) return this.countUp(el);
      const t = el.getAttribute("data-reveal");
      if (t === "mask")
        el.querySelectorAll("[data-line]").forEach((l, i) =>
          l.animate(
            [
              {
                opacity: 0,
                filter: "blur(18px)",
                transform: "translateY(22px)",
              },
              { opacity: 1, filter: "blur(0px)", transform: "none" },
            ],
            { duration: 1300, delay: i * 160, easing: E, fill: "backwards" },
          ),
        );
      else if (t === "words")
        el.querySelectorAll("[data-ph]").forEach((c, i) =>
          c.animate(
            [
              { opacity: 0.06, filter: "blur(8px)" },
              { opacity: 1, filter: "blur(0px)" },
            ],
            { duration: 1100, delay: i * 180, easing: E, fill: "backwards" },
          ),
        );
      else if (t === "stagger")
        [...el.children].forEach((c, i) =>
          c.animate(
            [
              {
                opacity: 0,
                filter: "blur(12px)",
                transform: "translateY(28px)",
              },
              { opacity: 1, filter: "blur(0px)", transform: "none" },
            ],
            {
              duration: 1150,
              delay: Math.min(i * 100, 500),
              easing: E,
              fill: "backwards",
            },
          ),
        );
      else if (t === "clip") {
        el.animate(
          [
            { clipPath: "inset(12% 8% 12% 8% round 24px)" },
            { clipPath: "inset(0% 0% 0% 0% round 24px)" },
          ],
          { duration: 1400, easing: E, fill: "backwards" },
        );
        const img = el.querySelector("image-slot, img");
        if (img)
          img.animate(
            [{ transform: "scale(1.3)" }, { transform: "scale(1)" }],
            { duration: 1800, easing: E, fill: "backwards" },
          );
      } else
        el.animate(
          [
            { opacity: 0, filter: "blur(12px)", transform: "translateY(26px)" },
            { opacity: 1, filter: "blur(0px)", transform: "none" },
          ],
          { duration: 1150, easing: E, fill: "backwards" },
        );
    };
    this.io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            run(e.target);
            this.io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    root
      .querySelectorAll("[data-reveal], [data-count]")
      .forEach((el) => this.io.observe(el));
  }
  countUp(el) {
    const n = +el.getAttribute("data-count"),
      t0 = performance.now(),
      d = 1500;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / d);
      el.textContent = String(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  setupLoops() {
    const root = this.rootRef.current;
    this.loops = [];
    if (this.reduced || !root.animate) return;
    this.setupMarquees();
    root.querySelectorAll("[data-spin]").forEach((el) =>
      this.loops.push(
        el.animate([{ rotate: "0deg" }, { rotate: "360deg" }], {
          duration: +el.getAttribute("data-spin"),
          iterations: Infinity,
        }),
      ),
    );
    root.querySelectorAll("[data-aurora]").forEach((el) =>
      this.loops.push(
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
      ),
    );
    root.querySelectorAll("[data-pulse]").forEach((el) =>
      this.loops.push(
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
      ),
    );
  }
  setupCursor() {
    const root = this.rootRef.current,
      c = this.cursorRef.current,
      b = this.cursorBubble.current;
    if (!c || !this.fine || this.reduced) return;
    const label = b.querySelector("[data-cursor-label]");
    root.querySelectorAll("[data-cursor]").forEach((t) => {
      t.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse" || this.props.motion === "Subtle") {
          t.style.cursor = "";
          return;
        }
        t.style.cursor = "none";
        label.textContent = t.getAttribute("data-cursor");
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
        c.style.transform = `translate3d(${(e.clientX - r.left) / k}px, ${(e.clientY - r.top) / k}px, 0)`;
      });
    });
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
      `[data-mod-timer="${this.MODS[this.state.mod].id}"]`,
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
      const target = -90 + i * 60;
      const d = ((((target - s.lineDeg) % 360) + 540) % 360) - 180;
      return { mod: i, lineDeg: s.lineDeg + d };
    });
  }
  swapIn() {
    const root = this.rootRef.current;
    if (!root || this.reduced) return;
    root.querySelectorAll("[data-swap]").forEach((el) =>
      el.animate(
        [
          { opacity: 0, filter: "blur(10px)", transform: "translateY(14px)" },
          { opacity: 1, filter: "blur(0px)", transform: "none" },
        ],
        { duration: 800, easing: this.E },
      ),
    );
  }
  fTick = () => {
    const f = this.floatRef.current;
    if (!f || !this.fTarget) {
      this.fRaf = null;
      return;
    }
    if (!this.fPos) this.fPos = { ...this.fTarget };
    this.fPos.x += (this.fTarget.x - this.fPos.x) * 0.14;
    this.fPos.y += (this.fTarget.y - this.fPos.y) * 0.14;
    const vx = this.fTarget.x - this.fPos.x;
    f.style.transform = `translate3d(${this.fPos.x}px, ${this.fPos.y}px, 0) translate(-50%,-50%) rotate(${Math.max(-9, Math.min(9, vx * 0.08))}deg)`;
    if (Math.abs(vx) > 0.3 || Math.abs(this.fTarget.y - this.fPos.y) > 0.3)
      this.fRaf = requestAnimationFrame(this.fTick);
    else this.fRaf = null;
  };
  renderVals() {
    const s = this.state;
    const M = this.MODS[s.mod];
    const parts = M.title.split(/(?<=\.) /);
    const side = (k) => {
      const on = s.side === k,
        off = s.side !== null && !on;
      return {
        enter: () => this.setState({ side: k }),
        grow: on ? 1.45 : off ? 0.7 : 1,
        imgT: on ? "scale(1.06)" : "scale(1)",
        listO: off ? 0.55 : 1,
        arrowBg: on ? "#EEE3F7" : "#0D081440",
        arrowC: on ? "#28123B" : "#F6F1FA",
        arrowT: on ? "rotate(45deg)" : "none",
      };
    };
    const showFloat = false;
    const work = (i, col, row) => {
      const on = s.workHover === i;
      return {
        col: s.narrow ? "auto" : col,
        row: s.narrow ? "auto" : row,
        enter: () => this.setState({ workHover: i }),
        imgT: on ? "scale(1.06)" : "scale(1)",
        arrowBg: on ? "#EEE3F7" : "#0D081459",
        arrowC: on ? "#28123B" : "#F6F1FA",
        arrowT: on ? "rotate(45deg)" : "none",
        titleX: on ? nudge("6px") : "0px",
      };
    };
    return {
      heroWord: this.HERO_WORDS[s.heroIdx],
      wide: !s.narrow,
      narrow: s.narrow,
      menuOpen: s.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      menuLinks: content.MENU(),
      sideA: side(0),
      sideB: side(1),
      sideLeave: () => this.setState({ side: null }),
      logos: [],
      logoPause: () => {
        clearTimeout(this.logoT);
        if (this.logoAnim) this.logoAnim.pause();
      },
      logoPlay: () => {
        clearTimeout(this.logoT);
        this.logoT = setTimeout(() => {
          if (this.logoAnim) this.logoAnim.play();
        }, 250);
      },
      logoPlayLater: () => {
        clearTimeout(this.logoT);
        this.logoT = setTimeout(() => {
          if (this.logoAnim) this.logoAnim.play();
        }, 1800);
      },
      svcs: this.SVCS.map((x, i) => {
        const open = s.svcOpen === i,
          hov = s.svcHover === i,
          on = open || hov;
        return {
          ...x,
          index: "0" + (i + 1),
          titleC: on ? "#DDBBFA" : "#F4EEF8",
          shift: hov ? nudge("8px") : "0px",
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
      }),
      floatTitle: s.svcHover !== null ? this.SVCS[s.svcHover].title : "",
      floatO: showFloat ? 1 : 0,
      floatS: showFloat ? 1 : 0.6,
      svcMove: (e) => {
        if (!this.fine) return;
        const list = this.svcListRef.current;
        const r = list.getBoundingClientRect(),
          k = r.width / list.offsetWidth || 1;
        this.fTarget = {
          x: (e.clientX - r.left) / k + 220,
          y: (e.clientY - r.top) / k,
        };
        if (!this.fRaf) this.fRaf = requestAnimationFrame(this.fTick);
      },
      svcLeave: () => this.setState({ svcHover: null }),
      mods: this.MODS.map((x, i) => {
        const sel = i === s.mod;
        return {
          ...x,
          sel,
          color: sel ? "#28123B" : "#DCD0E6",
          bg: sel ? "#EEE3F7" : "#ffffff08",
          border: sel ? "#EEE3F7" : "#ffffff1a",
          select: () => this.selectMod(i),
        };
      }),
      mod: {
        num: "0" + (s.mod + 1),
        category: M.category,
        t1: parts[0],
        t2: parts.length > 1 ? " " + parts.slice(1).join(" ") : "",
        desc: M.desc,
        tasks: M.tasks,
      },
      lineDeg: s.lineDeg,
      nodes: this.MODS.map((x, i) => {
        const a = ((-90 + i * 60) * Math.PI) / 180,
          sel = i === s.mod;
        return {
          icon: x.icon,
          formal: x.formal,
          x: (50 + 39 * Math.cos(a)).toFixed(2) + "%",
          y: (50 + 39 * Math.sin(a)).toFixed(2) + "%",
          bg: sel ? "#EEE3F7" : "#190B25",
          border: sel ? "#EEE3F7" : "#D4B7EC3d",
          color: sel ? "#28123B" : "#DCD0E6",
          shadow: sel ? "0 0 0 8px #EEE3F71a, 0 0 50px #9458F48c" : "none",
          labelC: sel ? "#FFFFFF" : "#9D8BAE",
          select: () => this.selectMod(i),
        };
      }),
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
      faqs: this.FAQS.map((x, i) => {
        const o = i === s.faq;
        return {
          q: x[0],
          a: x[1],
          qC: o ? "#6C3CAA" : "#190B25",
          tBg: o ? "#190B25" : "transparent",
          tC: o ? "#F6F1FA" : "#190B25",
          tBorder: o ? "#190B25" : "#190B2533",
          tRot: o ? "rotate(135deg)" : "none",
          rows: o ? "1fr" : "0fr",
          o: o ? 1 : 0,
          toggle: () => this.setState({ faq: o ? null : i }),
        };
      }),
      closingMove: (e) => {
        const sec = this.closingRef.current,
          g = this.glowRef.current;
        if (!sec || !g || !this.fine || this.props.motion === "Subtle") return;
        const r = sec.getBoundingClientRect(),
          k = r.width / sec.offsetWidth || 1;
        g.style.left = (e.clientX - r.left) / k + "px";
        g.style.top = (e.clientY - r.top) / k + "px";
        const m = this.magnetRef.current;
        if (!m) return;
        const mr = m.getBoundingClientRect(),
          dx = e.clientX - (mr.left + mr.width / 2),
          dy = e.clientY - (mr.top + mr.height / 2);
        m.style.transform =
          Math.hypot(dx, dy) < 170
            ? `translate3d(${(dx * 0.14) / k}px, ${(dy * 0.18) / k}px, 0)`
            : "";
      },
      closingLeave: () => {
        const m = this.magnetRef.current;
        if (m) m.style.transform = "";
      },
      workCols: s.narrow ? "minmax(0,1fr)" : "repeat(12,minmax(0,1fr))",
      workRows: s.narrow
        ? "none"
        : "clamp(240px,26svh,280px) clamp(240px,26svh,280px) clamp(280px,30svh,320px)",
      w1: work(0, "1 / span 7", "1 / span 2"),
      w2: work(1, "8 / span 5", "1"),
      w3: work(2, "8 / span 5", "2"),
      w4: work(3, "1 / span 12", "3"),
      workLeave: () => this.setState({ workHover: null }),
      svcCols: s.xwide
        ? "48px minmax(0,1fr) auto 48px"
        : "48px minmax(0,1fr) 48px",
      xwide: !!s.xwide,
      notXwide: !s.xwide,
      detailCols: s.narrow
        ? "minmax(0,1fr)"
        : "minmax(0,1.16fr) minmax(300px,.84fr)",
      detailPad: s.narrow ? "0px" : "calc(48px + clamp(14px,2vw,28px))",
      showTicker: this.props.ticker ?? true,
      noTicker: !(this.props.ticker ?? true),
      footExplore: content.FOOT_EXPLORE(),
      footStart: content.FOOT_START(),
      footStudio: this.SVCS.map((x) => x.title),
      footSoftware: ["HR", "CRM", "Files", "Tasks", "Marketing", msg("Home:3")],
      footCompany: [
        msg("Home:4"),
        msg("Home:5"),
        msg("Home:6"),
        msg("Home:7"),
        msg("Home:8"),
      ],
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
      svcListRef: this.svcListRef,
      floatRef: this.floatRef,
      explorerRef: this.explorerRef,
      procRef: this.procRef,
      closingRef: this.closingRef,
      glowRef: this.glowRef,
      magnetRef: this.magnetRef,
      cursorRef: this.cursorRef,
      cursorBubble: this.cursorBubble,
      floatImgRef: this.floatImgRef,
    };
  }

  render() {
    const v = this.renderVals();
    return (
      managedPageTree(<>
        <div
          ref={v.rootRef}
          data-screen-label={"Home"}
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
              <span data-cursor-label={""}>{run("pg_home|intro|div", 2)}</span>
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
                href={toSiteHref("#top")}
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
                      href={toSiteHref("#top")}
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
                      className={"reference-state-1"}
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
                      className={"reference-state-2"}
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
                      className={"reference-state-3"}
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
                      className={"reference-state-4"}
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
                      className={"reference-state-5"}
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
                      className={"reference-state-6"}
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
                      className={"reference-state-8"}
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
                    alt={attr("pg_home|intro|img@alt")}
                    style={{ width: "104px" }}
                  />
                  <button
                    aria-label={attr("pg_home|intro|button@aria-label")}
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
                  {run("pg_home|intro|a", 1)}
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
          <main id={"top"}>
            <section data-cms-section="hero"
              style={{
                position: "relative",
                minHeight: "100svh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
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
                    "linear-gradient(90deg,#0D0814 0%,#0D0814f0 24%,#0D0814a8 46%,#0D081400 74%),linear-gradient(0deg,#0D0814 0%,#0D081400 42%),linear-gradient(180deg,#0D0814c7 0%,#0D081400 24%)",
                }}
              ></div>
              <div
                style={{
                  width: "100%",
                  maxWidth: "1440px",
                  margin: "0 auto",
                  padding: "clamp(110px,16vh,170px) clamp(20px,4.4vw,64px) 0",
                }}
              >
                <div
                  data-hero-fade={""}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "12px 28px",
                    fontSize: "12px",
                    fontWeight: "600",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: "#DCD0E6",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
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
                    {run("pg_home|hero|div", 3)}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#B5A6C4",
                    }}
                  >
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        background: "#DA291C",
                        borderRadius: "2px",
                      }}
                      className={"reference-state-9 reference-state-10"}
                    ></span>
                    {run("pg_home|hero|div", 8)}
                  </span>
                </div>
                <h1
                  data-hw={""}
                  style={{
                    fontSize: "clamp(32px,min(7.71vw,10.25vh),107px)",
                    lineHeight: ".95",
                    fontWeight: "500",
                    letterSpacing: "-.05em",
                    margin: "34px 0 0",
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
                    <span data-hero-line={""} style={{ display: "block" }}>
                      {"Build the"}
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
                    <span data-hero-line={""} style={{ display: "block" }}>
                      {"business."}
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
                        fontWeight: "500",
                        color: "#D4B7EC",
                        letterSpacing: "-.045em",
                      }}
                    >
                      <span
                        data-rot={""}
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          willChange: "transform",
                        }}
                      >
                        {v.heroWord}
                      </span>
                    </span>
                  </span>
                </h1>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "36px 48px",
                    marginTop: "44px",
                  }}
                >
                  <div style={{ maxWidth: "560px" }}>
                    <p
                      data-hero-fade={""}
                      style={{
                        fontFamily:
                          '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                        fontSize: "clamp(16px,1.2vw,18px)",
                        lineHeight: "1.6",
                        color: "#DCD0E6",
                        textWrap: "pretty",
                      }}
                    >
                      {run("pg_home|hero|p", 1)}
                    </p>
                    <div
                      data-hero-fade={""}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "14px",
                        marginTop: "32px",
                      }}
                    >
                      <a
                        href={toSiteHref("Contact.dc.html")}
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
                        className={"reference-state-11"}
                      >
                        {run("pg_home|hero|a", 1)}
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
                            className={"ph ph-arrow-up-right"}
                          ></i>
                        </span>
                      </a>
                      <a
                        href={toSiteHref("Software.dc.html")}
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
                        className={"reference-state-12"}
                      >
                        {run("pg_home|hero|a-2", 1)}
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
                      </a>
                    </div>
                  </div>
                  <a
                    href={toSiteHref("#two-sides")}
                    data-hero-fade={""}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      fontSize: "12px",
                      fontWeight: "600",
                      letterSpacing: ".2em",
                      textTransform: "uppercase",
                      color: "#B5A6C4",
                    }}
                  >
                    {run("pg_home|hero|a-3", 1)}
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        border: "1px solid #ffffff2e",
                        color: "#F6F1FA",
                      }}
                    >
                      <i
                        aria-hidden={true}
                        style={{ fontSize: "17px" }}
                        className={"ph ph-arrow-down"}
                      ></i>
                    </span>
                  </a>
                </div>
              </div>
              {v.showTicker && (
                <>
                  <div
                    style={{
                      marginTop: "clamp(52px,6vw,84px)",
                      borderTop: "1px solid #ffffff1a",
                      background: "linear-gradient(180deg,#0D081400,#0D0814d9)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      data-marquee={"70000"}
                      style={{ display: "flex", width: "max-content" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "34px",
                          padding: "24px 34px 24px 0",
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
                          {"Studio"}
                        </span>
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Brand & digital design"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Web & app development"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Marketing & growth"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"IT & ongoing support"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"OrgTik hosting"}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".24em",
                            textTransform: "uppercase",
                            color: "#C9A0F3",
                            marginInlineStart: "22px",
                          }}
                        >
                          {"Software"}
                        </span>
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"HR"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"CRM"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Files"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Tasks"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Marketing"}
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
                        <span
                          style={{
                            fontSize: "17px",
                            color: "#E9E0F0",
                            marginInlineEnd: "22px",
                          }}
                        >
                          {"Website Manager"}
                        </span>
                      </div>
                      <div
                        aria-hidden={"true"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "34px",
                          padding: "24px 34px 24px 0",
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
                          {"Studio"}
                        </span>
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Brand & digital design"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Web & app development"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Marketing & growth"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"IT & ongoing support"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"OrgTik hosting"}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".24em",
                            textTransform: "uppercase",
                            color: "#C9A0F3",
                            marginInlineStart: "22px",
                          }}
                        >
                          {"Software"}
                        </span>
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"HR"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"CRM"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Files"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Tasks"}
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
                        <span style={{ fontSize: "17px", color: "#E9E0F0" }}>
                          {"Marketing"}
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
                        <span
                          style={{
                            fontSize: "17px",
                            color: "#E9E0F0",
                            marginInlineEnd: "22px",
                          }}
                        >
                          {"Website Manager"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {v.noTicker && (
                <>
                  <div style={{ height: "clamp(56px,6vw,90px)" }}></div>
                </>
              )}
            </section>
            <section data-cms-section="two-sides"
              id={"two-sides"}
              style={{
                padding: "var(--section-space) 0 var(--section-space)",
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
                        {run("pg_home|two-sides|div", 2)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      {run("pg_home|two-sides|div", 6)}
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
                          {run("pg_home|two-sides|h2", 3)}
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
                          {run("pg_home|two-sides|h2", 9)}
                        </span>
                      </span>
                    </h2>
                  </div>
                  <p
                    data-reveal={"up"}
                    style={{
                      fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                      maxWidth: "400px",
                      fontSize: "16px",
                      lineHeight: "1.65",
                      color: "#CFC2DB",
                    }}
                  >
                    {run("pg_home|two-sides|p", 1)}
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  <a
                    href={toSiteHref("Services.dc.html")}
                    onMouseEnter={v.sideA.enter}
                    onMouseLeave={v.sideLeave}
                    data-cursor={"Let’s build"}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      flex: v.sideA.grow + " 1 440px",
                      minHeight: "auto",
                      containerType: "inline-size",
                      borderRadius: "28px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1A0D27",
                      color: "#F6F1FA",
                      padding: "clamp(24px,3vw,40px)",
                      transition: "flex-grow .9s cubic-bezier(.22,1,.36,1)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        insetInlineStart: "0",
                        insetInlineEnd: "0",
                        top: "0",
                        height:
                          "calc(clamp(24px,3vw,40px) + clamp(200px,20vw,300px) + 110px)",
                        zIndex: "-1",
                        overflow: "hidden",
                        WebkitMaskImage:
                          "linear-gradient(180deg,#000 0%,#000 50%,transparent 100%)",
                        maskImage:
                          "linear-gradient(180deg,#000 0%,#000 50%,transparent 100%)",
                        color: "#D4B7EC",
                      }}
                    >
                      <image-slot
                        id={"a-side-studio"}
                        shape={"rect"}
                        src={"/assets/brand-tablet.webp"}
                        placeholder={attr(
                          "pg_home|two-sides|image-slot@placeholder",
                        )}
                        style={{
                          position: "absolute",
                          inset: "0",
                          width: "100%",
                          height: "100%",
                          transform: String(v.sideA.imgT),
                          transformOrigin: "50% 40%",
                          transition:
                            "transform 1.6s cubic-bezier(.22,1,.36,1)",
                        }}
                      ></image-slot>
                      <span
                        style={{
                          position: "absolute",
                          inset: "0",
                          pointerEvents: "none",
                          background:
                            "linear-gradient(180deg,#0D081466 0%,#0D081400 34%)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        minHeight: "clamp(200px,20vw,300px)",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 16px 8px 8px",
                          borderRadius: "999px",
                          background: "#0D081466",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".18em",
                          textTransform: "uppercase",
                        }}
                      >
                        <span
                          style={{
                            display: "grid",
                            placeItems: "center",
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: "#EEE3F7",
                            color: "#28123B",
                            fontSize: "11px",
                            letterSpacing: "0",
                          }}
                        >
                          {run("pg_home|two-sides|div-2", 3)}
                        </span>
                        {run("pg_home|two-sides|div-2", 6)}
                      </span>
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          background: String(v.sideA.arrowBg),
                          color: String(v.sideA.arrowC),
                          border: "1px solid #ffffff38",
                          transform: String(v.sideA.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                    <div
                      style={{
                        pointerEvents: "none",
                        flex: "1",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".2em",
                          textTransform: "uppercase",
                          color: "#D4B7EC",
                        }}
                      >
                        {run("pg_home|two-sides|div-3", 1)}
                      </div>
                      <h3
                        data-hw={""}
                        style={{
                          fontSize: "clamp(30px,8.61cqi,70px)",
                          lineHeight: ".98",
                          fontWeight: "500",
                          letterSpacing: "-.045em",
                          whiteSpace: "nowrap",
                          margin: "18px 0 20px",
                        }}
                      >
                        {run("pg_home|two-sides|h3", 1)}
                      </h3>
                      <p
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "42ch",
                          fontSize: "16px",
                          lineHeight: "1.6",
                          color: "#E4DAEC",
                        }}
                      >
                        {run("pg_home|two-sides|p-2", 1)}
                      </p>
                      <ul
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill,minmax(max(170px,calc((100% - 28px) / 2)),1fr))",
                          columnGap: "28px",
                          marginTop: "auto",
                          paddingTop: "30px",
                          opacity: String(v.sideA.listO),
                          transition: "opacity .6s",
                        }}
                      >
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-2", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-2", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-3", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-3", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-4", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-4", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-5", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-5", 4)}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </a>
                  <a
                    href={toSiteHref("Software.dc.html")}
                    onMouseEnter={v.sideB.enter}
                    onMouseLeave={v.sideLeave}
                    data-cursor={"Explore plans"}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      flex: v.sideB.grow + " 1 440px",
                      minHeight: "auto",
                      containerType: "inline-size",
                      borderRadius: "28px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1A0D27",
                      color: "#F6F1FA",
                      padding: "clamp(24px,3vw,40px)",
                      transition: "flex-grow .9s cubic-bezier(.22,1,.36,1)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        insetInlineStart: "0",
                        insetInlineEnd: "0",
                        top: "0",
                        height:
                          "calc(clamp(24px,3vw,40px) + clamp(200px,20vw,300px) + 110px)",
                        zIndex: "-1",
                        overflow: "hidden",
                        WebkitMaskImage:
                          "linear-gradient(180deg,#000 0%,#000 50%,transparent 100%)",
                        maskImage:
                          "linear-gradient(180deg,#000 0%,#000 50%,transparent 100%)",
                        color: "#D4B7EC",
                      }}
                    >
                      <image-slot
                        id={"a-side-software"}
                        shape={"rect"}
                        src={"/assets/brand-phone.webp"}
                        placeholder={attr(
                          "pg_home|two-sides|image-slot@placeholder-2",
                        )}
                        style={{
                          position: "absolute",
                          inset: "0",
                          width: "100%",
                          height: "100%",
                          transform: String(v.sideB.imgT),
                          transformOrigin: "50% 40%",
                          transition:
                            "transform 1.6s cubic-bezier(.22,1,.36,1)",
                        }}
                      ></image-slot>
                      <span
                        style={{
                          position: "absolute",
                          inset: "0",
                          pointerEvents: "none",
                          background:
                            "linear-gradient(180deg,#0D081466 0%,#0D081400 34%)",
                        }}
                      ></span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        minHeight: "clamp(200px,20vw,300px)",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 16px 8px 8px",
                          borderRadius: "999px",
                          background: "#0D081466",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".18em",
                          textTransform: "uppercase",
                        }}
                      >
                        <span
                          style={{
                            display: "grid",
                            placeItems: "center",
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: "#EEE3F7",
                            color: "#28123B",
                            fontSize: "11px",
                            letterSpacing: "0",
                          }}
                        >
                          {run("pg_home|two-sides|div-4", 3)}
                        </span>
                        {run("pg_home|two-sides|div-4", 6)}
                      </span>
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          background: String(v.sideB.arrowBg),
                          color: String(v.sideB.arrowC),
                          border: "1px solid #ffffff38",
                          transform: String(v.sideB.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                    <div
                      style={{
                        pointerEvents: "none",
                        flex: "1",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".2em",
                          textTransform: "uppercase",
                          color: "#D4B7EC",
                        }}
                      >
                        {run("pg_home|two-sides|div-5", 1)}
                      </div>
                      <h3
                        data-hw={""}
                        style={{
                          fontSize: "clamp(30px,8.61cqi,70px)",
                          lineHeight: ".98",
                          fontWeight: "500",
                          letterSpacing: "-.045em",
                          whiteSpace: "nowrap",
                          margin: "18px 0 20px",
                        }}
                      >
                        {run("pg_home|two-sides|h3-2", 1)}
                      </h3>
                      <p
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          maxWidth: "42ch",
                          fontSize: "16px",
                          lineHeight: "1.6",
                          color: "#E4DAEC",
                        }}
                      >
                        {run("pg_home|two-sides|p-3", 1)}
                      </p>
                      <ul
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill,minmax(max(170px,calc((100% - 28px) / 2)),1fr))",
                          columnGap: "28px",
                          marginTop: "auto",
                          paddingTop: "30px",
                          opacity: String(v.sideB.listO),
                          transition: "opacity .6s",
                        }}
                      >
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-6", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-6", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-7", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-7", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-8", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-8", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-9", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-9", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-10", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-10", 4)}
                          </span>
                        </li>
                        <li
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "13px 0",
                            borderTop: "1px solid #ffffff21",
                            fontSize: "15px",
                          }}
                        >
                          <span>{run("pg_home|two-sides|li-11", 1)}</span>
                          <span style={{ fontSize: "12px", color: "#B5A6C4" }}>
                            {run("pg_home|two-sides|li-11", 4)}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </a>
                </div>
              </div>
            </section>

            <PartnerStrip data-cms-section="partners" />
            <section data-cms-section="work"
              id={"work"}
              style={{ padding: "0 0 var(--section-space)" }}
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
                    marginBottom: "clamp(48px,5vw,64px)",
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
                        {run("pg_home|work|div", 2)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      {run("pg_home|work|div", 6)}
                    </div>
                    <h2
                      data-reveal={"mask"}
                      data-hw={""}
                      style={{
                        fontSize: "var(--section-title-size)",
                        lineHeight: "1.06",
                        fontWeight: "500",
                        letterSpacing: "-.045em",
                        marginTop: "28px",
                      }}
                    >
                      <span style={{ display: "block" }}>
                        <span data-line={""} style={{ display: "block" }}>
                          {run("pg_home|work|h2", 3)}
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
                          {run("pg_home|work|h2", 9)}
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
                      gap: "30px",
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
                      {run("pg_home|work|p", 1)}
                    </p>
                    <a
                      href={toSiteHref("Work.dc.html")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "20px",
                        minHeight: "50px",
                        padding: "7px 7px 7px 24px",
                        borderRadius: "999px",
                        border: "1px solid #D4B7EC55",
                        color: "#F6F1FA",
                        fontSize: "14px",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                        transition: "background .3s, border-color .3s",
                      }}
                      className={"reference-state-15"}
                    >
                      {run("pg_home|work|a", 1)}
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#EEE3F7",
                          color: "#28123B",
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
                  style={{
                    display: "grid",
                    gridTemplateColumns: String(v.workCols),
                    gridTemplateRows: String(v.workRows),
                    gridAutoRows: "360px",
                    gap: "clamp(28px,2.8vw,40px)",
                  }}
                >
                  <a
                    href={toSiteHref(
                      "Work.dc.html#/project/orgtik-identity-system",
                    )}
                    data-reveal={"clip"}
                    data-cursor={"View project"}
                    onMouseEnter={v.w1.enter}
                    onMouseLeave={v.workLeave}
                    style={{
                      position: "relative",
                      gridColumn: String(v.w1.col),
                      gridRow: String(v.w1.row),
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "24px",
                      padding: "clamp(26px,2.7vw,38px)",
                      borderRadius: "24px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1C1029",
                      color: "#F6F1FA",
                    }}
                  >
                    <image-slot
                      id={"h-work-01"}
                      shape={"rect"}
                      src={"/assets/brand-cards.webp"}
                      placeholder={attr("pg_home|work|image-slot@placeholder")}
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-2",
                        width: "100%",
                        height: "100%",
                        transform: String(v.w1.imgT),
                        transition: "transform 1.6s cubic-bezier(.22,1,.36,1)",
                      }}
                    ></image-slot>
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-1",
                        pointerEvents: "none",
                        background:
                          "linear-gradient(180deg,#0D081473 0%,#0D081400 24%,#0D081400 44%,#0D0814e6 100%)",
                      }}
                    ></span>
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
                          padding: "8px 14px",
                          borderRadius: "999px",
                          background: "#0D081473",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#F6F1FA",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {run("pg_home|work|div-2", 2)}
                      </span>
                      <span
                        style={{
                          padding: "8px 12px",
                          borderRadius: "999px",
                          background: "#0D081459",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".08em",
                          fontVariantNumeric: "tabular-nums",
                          color: "#F6F1FA",
                        }}
                      >
                        {run("pg_home|work|div-2", 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        gap: "24px",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          transform: "translateX(" + v.w1.titleX + ")",
                          transition: "transform .6s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#D4B7EC",
                          }}
                        >
                          {run("pg_home|work|div-3", 1)}
                        </div>
                        <h3
                          style={{
                            marginTop: "20px",
                            fontSize: "clamp(25px,2.46vw,37px)",
                            lineHeight: "1.04",
                            fontWeight: "500",
                            letterSpacing: "-.035em",
                          }}
                          data-hw={""}
                        >
                          {run("pg_home|work|h3", 1)}
                        </h3>
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            marginTop: "18px",
                            fontSize: "15px",
                            lineHeight: "1.5",
                            color: "#DCD0E6",
                          }}
                        >
                          {run("pg_home|work|p-2", 1)}
                        </p>
                      </div>
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          border: "1px solid #ffffff38",
                          background: String(v.w1.arrowBg),
                          color: String(v.w1.arrowC),
                          transform: String(v.w1.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                  </a>
                  <a
                    href={toSiteHref(
                      "Work.dc.html#/project/orgtik-identity-system",
                    )}
                    data-reveal={"clip"}
                    data-cursor={"View project"}
                    onMouseEnter={v.w2.enter}
                    onMouseLeave={v.workLeave}
                    style={{
                      position: "relative",
                      gridColumn: String(v.w2.col),
                      gridRow: String(v.w2.row),
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "24px",
                      padding: "clamp(26px,2.7vw,38px)",
                      borderRadius: "24px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1C1029",
                      color: "#F6F1FA",
                    }}
                  >
                    <image-slot
                      id={"h-work-02"}
                      shape={"rect"}
                      src={"/assets/brand-tablet.webp"}
                      alt={attr("pg_home|work|image-slot@alt")}
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-2",
                        width: "100%",
                        height: "100%",
                        transform: String(v.w2.imgT),
                        transition: "transform 1.6s cubic-bezier(.22,1,.36,1)",
                      }}
                    ></image-slot>
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-1",
                        pointerEvents: "none",
                        background:
                          "linear-gradient(180deg,#0D081473 0%,#0D081400 24%,#0D081400 44%,#0D0814e6 100%)",
                      }}
                    ></span>
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
                          padding: "8px 14px",
                          borderRadius: "999px",
                          background: "#0D081473",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#F6F1FA",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {run("pg_home|work|div-4", 2)}
                      </span>
                      <span
                        style={{
                          padding: "8px 12px",
                          borderRadius: "999px",
                          background: "#0D081459",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".08em",
                          fontVariantNumeric: "tabular-nums",
                          color: "#F6F1FA",
                        }}
                      >
                        {run("pg_home|work|div-4", 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        gap: "24px",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          transform: "translateX(" + v.w2.titleX + ")",
                          transition: "transform .6s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#D4B7EC",
                          }}
                        >
                          {run("pg_home|work|div-5", 1)}
                        </div>
                        <h3
                          style={{
                            marginTop: "20px",
                            fontSize: "clamp(20px,1.75vw,28px)",
                            lineHeight: "1.04",
                            fontWeight: "500",
                            letterSpacing: "-.035em",
                          }}
                          data-hw={""}
                        >
                          {run("pg_home|work|h3-2", 1)}
                        </h3>
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            marginTop: "18px",
                            fontSize: "15px",
                            lineHeight: "1.5",
                            color: "#DCD0E6",
                          }}
                        >
                          {run("pg_home|work|p-3", 1)}
                        </p>
                      </div>
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          border: "1px solid #ffffff38",
                          background: String(v.w2.arrowBg),
                          color: String(v.w2.arrowC),
                          transform: String(v.w2.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                  </a>
                  <a
                    href={toSiteHref(
                      "Work.dc.html#/project/orgtik-identity-system",
                    )}
                    data-reveal={"clip"}
                    data-cursor={"View project"}
                    onMouseEnter={v.w3.enter}
                    onMouseLeave={v.workLeave}
                    style={{
                      position: "relative",
                      gridColumn: String(v.w3.col),
                      gridRow: String(v.w3.row),
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "24px",
                      padding: "clamp(26px,2.7vw,38px)",
                      borderRadius: "24px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1C1029",
                      color: "#F6F1FA",
                    }}
                  >
                    <image-slot
                      id={"h-work-03"}
                      shape={"rect"}
                      src={"/assets/brand-phone.webp"}
                      alt={attr("pg_home|work|image-slot@alt-2")}
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-2",
                        width: "100%",
                        height: "100%",
                        transform: String(v.w3.imgT),
                        transition: "transform 1.6s cubic-bezier(.22,1,.36,1)",
                      }}
                    ></image-slot>
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-1",
                        pointerEvents: "none",
                        background:
                          "linear-gradient(180deg,#0D081473 0%,#0D081400 24%,#0D081400 44%,#0D0814e6 100%)",
                      }}
                    ></span>
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
                          padding: "8px 14px",
                          borderRadius: "999px",
                          background: "#0D081473",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#F6F1FA",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {run("pg_home|work|div-6", 2)}
                      </span>
                      <span
                        style={{
                          padding: "8px 12px",
                          borderRadius: "999px",
                          background: "#0D081459",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".08em",
                          fontVariantNumeric: "tabular-nums",
                          color: "#F6F1FA",
                        }}
                      >
                        {run("pg_home|work|div-6", 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        gap: "24px",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          transform: "translateX(" + v.w3.titleX + ")",
                          transition: "transform .6s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#D4B7EC",
                          }}
                        >
                          {run("pg_home|work|div-7", 1)}
                        </div>
                        <h3
                          style={{
                            marginTop: "20px",
                            fontSize: "clamp(20px,1.75vw,28px)",
                            lineHeight: "1.04",
                            fontWeight: "500",
                            letterSpacing: "-.035em",
                          }}
                          data-hw={""}
                        >
                          {run("pg_home|work|h3-3", 1)}
                        </h3>
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            marginTop: "18px",
                            fontSize: "15px",
                            lineHeight: "1.5",
                            color: "#DCD0E6",
                          }}
                        >
                          {run("pg_home|work|p-4", 1)}
                        </p>
                      </div>
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          border: "1px solid #ffffff38",
                          background: String(v.w3.arrowBg),
                          color: String(v.w3.arrowC),
                          transform: String(v.w3.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                  </a>
                  <a
                    href={toSiteHref(
                      "Work.dc.html#/project/orgtik-identity-system",
                    )}
                    data-reveal={"clip"}
                    data-cursor={"View project"}
                    onMouseEnter={v.w4.enter}
                    onMouseLeave={v.workLeave}
                    style={{
                      position: "relative",
                      gridColumn: String(v.w4.col),
                      gridRow: String(v.w4.row),
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "24px",
                      padding: "clamp(26px,2.7vw,38px)",
                      borderRadius: "24px",
                      overflow: "hidden",
                      isolation: "isolate",
                      background: "#1C1029",
                      color: "#F6F1FA",
                    }}
                  >
                    <image-slot
                      id={"h-work-04"}
                      shape={"rect"}
                      src={"/assets/brand-glass.webp"}
                      alt={attr("pg_home|work|image-slot@alt-3")}
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-2",
                        width: "100%",
                        height: "100%",
                        transform: String(v.w4.imgT),
                        transition: "transform 1.6s cubic-bezier(.22,1,.36,1)",
                      }}
                    ></image-slot>
                    <span
                      style={{
                        position: "absolute",
                        inset: "0",
                        zIndex: "-1",
                        pointerEvents: "none",
                        background:
                          "linear-gradient(180deg,#0D081473 0%,#0D081400 24%,#0D081400 44%,#0D0814e6 100%)",
                      }}
                    ></span>
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
                          padding: "8px 14px",
                          borderRadius: "999px",
                          background: "#0D081473",
                          border: "1px solid #ffffff2b",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#F6F1FA",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {run("pg_home|work|div-8", 2)}
                      </span>
                      <span
                        style={{
                          padding: "8px 12px",
                          borderRadius: "999px",
                          background: "#0D081459",
                          backdropFilter: "blur(10px)",
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".08em",
                          fontVariantNumeric: "tabular-nums",
                          color: "#F6F1FA",
                        }}
                      >
                        {run("pg_home|work|div-8", 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        gap: "24px",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          transform: "translateX(" + v.w4.titleX + ")",
                          transition: "transform .6s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            letterSpacing: ".2em",
                            textTransform: "uppercase",
                            color: "#D4B7EC",
                          }}
                        >
                          {run("pg_home|work|div-9", 1)}
                        </div>
                        <h3
                          style={{
                            marginTop: "20px",
                            fontSize: "clamp(25px,2.46vw,37px)",
                            lineHeight: "1.04",
                            fontWeight: "500",
                            letterSpacing: "-.035em",
                          }}
                          data-hw={""}
                        >
                          {run("pg_home|work|h3-4", 1)}
                        </h3>
                        <p
                          style={{
                            fontFamily:
                              '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                            marginTop: "18px",
                            fontSize: "15px",
                            lineHeight: "1.5",
                            color: "#DCD0E6",
                          }}
                        >
                          {run("pg_home|work|p-5", 1)}
                        </p>
                      </div>
                      <span
                        style={{
                          flexShrink: "0",
                          display: "grid",
                          placeItems: "center",
                          width: "54px",
                          height: "54px",
                          borderRadius: "50%",
                          border: "1px solid #ffffff38",
                          background: String(v.w4.arrowBg),
                          color: String(v.w4.arrowC),
                          transform: String(v.w4.arrowT),
                          transition: "all .5s cubic-bezier(.22,1,.36,1)",
                        }}
                      >
                        <i
                          aria-hidden={true}
                          style={{ fontSize: "18px" }}
                          className={"ph ph-arrow-up-right"}
                        ></i>
                      </span>
                    </div>
                  </a>
                </div>
              </div>
            </section>
            <section data-cms-section="services"
              id={"services"}
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
                        {run("pg_home|services|div", 2)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      {run("pg_home|services|div", 6)}
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
                          {run("pg_home|services|h2", 3)}
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
                          {run("pg_home|services|h2", 9)}
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
                      {run("pg_home|services|p", 1)}
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
                      className={"reference-state-16"}
                    >
                      {run("pg_home|services|a", 1)}
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
                  <span>{run("pg_home|services|div-2", 1)}</span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#C9A0F3",
                    }}
                  >
                    {run("pg_home|services|div-2", 4)}
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
                          aria-expanded={s.rows !== "0fr"}
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
                              transition: "all .35s cubic-bezier(.22,1,.36,1)",
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
                          <div style={{ minHeight: "0", overflow: "hidden" }}>
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
                                    id={"h-svc-" + s.index}
                                    shape={"rect"}
                                    data-src={"/assets/" + s.image}
                                    placeholder={msg("Home:9", [s.title])}
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
                                  <span>{s.category}</span>
                                  <small
                                    style={{
                                      fontFamily:
                                        '"OrgTik Arabic",Arial,Helvetica,sans-serif',
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
                                  {s.category + "."}
                                </h4>
                                <p
                                  style={{
                                    fontFamily:
                                      '"OrgTik Arabic",Arial,Helvetica,sans-serif',
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
                                    className={"reference-state-17"}
                                  >
                                    {run("pg_home|services|a-2", 1)}
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
            <section data-cms-section="software"
              id={"software"}
              style={{
                position: "relative",
                overflow: "clip",
                background:
                  "radial-gradient(80% 70% at 88% 34%,#3B1E59b3,transparent 62%),#0D0814",
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
                        {run("pg_home|software|div", 2)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      {run("pg_home|software|div", 6)}
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
                          {run("pg_home|software|h2", 3)}
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
                          {run("pg_home|software|h2", 9)}
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
                    {run("pg_home|software|p", 1)}
                  </p>
                </div>
                <div
                  ref={v.explorerRef}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "clamp(40px,5vw,80px)",
                  }}
                >
                  <div style={{ flex: "1 1 420px", minWidth: "0" }}>
                    <div
                      role={"tablist"}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                        gap: "8px",
                      }}
                    >
                      {(v.mods || []).map((m, mIndex) => (
                        <React.Fragment key={mIndex}>
                          <button
                            role={"tab"}
                            aria-selected={m.sel}
                            onClick={m.select}
                            style={{
                              position: "relative",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              minHeight: "52px",
                              padding: "0 16px",
                              borderRadius: "14px",
                              border: "1px solid " + m.border,
                              background: String(m.bg),
                              color: String(m.color),
                              fontSize: "14px",
                              fontWeight: "600",
                              textAlign: "start",
                              transition: "all .35s",
                            }}
                            className={"reference-state-18"}
                          >
                            <i
                              aria-hidden={true}
                              style={{ fontSize: "18px" }}
                              className={"ph " + m.icon}
                            ></i>
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {m.formal}
                            </span>
                            {m.sel && (
                              <>
                                <span
                                  data-mod-timer={m.id}
                                  style={{
                                    position: "absolute",
                                    insetInlineStart: "0",
                                    insetInlineEnd: "0",
                                    bottom: "0",
                                    height: "2px",
                                    background: "#C9A0F3",
                                    transform: "scaleX(0)",
                                    transformOrigin: "left",
                                  }}
                                ></span>
                              </>
                            )}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <div
                      data-swap={""}
                      style={{ marginTop: "44px", minHeight: "288px" }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          letterSpacing: ".2em",
                          textTransform: "uppercase",
                          color: "#C9A0F3",
                        }}
                      >
                        {v.mod.num + " · " + v.mod.category}
                      </div>
                      <h3
                        data-hw={""}
                        style={{
                          marginTop: "18px",
                          fontSize: "clamp(26px,2.46vw,37px)",
                          lineHeight: "1.08",
                          fontWeight: "500",
                          letterSpacing: "-.04em",
                          textWrap: "balance",
                        }}
                      >
                        {v.mod.t1}
                        <span
                          data-acc={""}
                          style={{ fontWeight: "500", color: "#D4B7EC" }}
                        >
                          {v.mod.t2}
                        </span>
                      </h3>
                      <p
                        style={{
                          fontFamily:
                            '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                          marginTop: "20px",
                          maxWidth: "46ch",
                          fontSize: "16px",
                          lineHeight: "1.65",
                          color: "#CFC2DB",
                        }}
                      >
                        {v.mod.desc}
                      </p>
                      <ul
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "26px",
                        }}
                      >
                        {(v.mod.tasks || []).map((t, tIndex) => (
                          <React.Fragment key={tIndex}>
                            <li
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "9px 14px",
                                borderRadius: "999px",
                                background: "#ffffff0d",
                                border: "1px solid #ffffff1a",
                                fontSize: "13px",
                                color: "#E9E0F0",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ color: "#C9A0F3" }}
                                className={"ph ph-check"}
                              ></i>
                              {t}
                            </li>
                          </React.Fragment>
                        ))}
                      </ul>
                      <a
                        href={toSiteHref("Software.dc.html")}
                        style={{
                          marginTop: "34px",
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
                        className={"reference-state-19"}
                      >
                        {run("pg_home|software|a", 1)}
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
                  <div style={{ flex: "1.25 1 440px", minWidth: "0" }}>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "640px",
                        aspectRatio: "1",
                        marginInlineStart: "auto",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: "0",
                          borderRadius: "50%",
                          border: "1px solid #D4B7EC1c",
                        }}
                      ></div>
                      <div
                        data-spin={"90000"}
                        style={{
                          position: "absolute",
                          inset: "11%",
                          borderRadius: "50%",
                          border: "1px dashed #D4B7EC33",
                        }}
                      ></div>
                      <div
                        style={{
                          position: "absolute",
                          inset: "27%",
                          borderRadius: "50%",
                          border: "1px solid #D4B7EC1f",
                          background:
                            "radial-gradient(circle,#9458F41f,transparent 70%)",
                        }}
                      ></div>
                      <div
                        style={{
                          position: "absolute",
                          insetInlineStart: "50%",
                          top: "50%",
                          width: "39%",
                          height: "2px",
                          marginTop: "-1px",
                          transformOrigin: "0 50%",
                          transform: "rotate(" + v.lineDeg + "deg)",
                          background:
                            "linear-gradient(90deg,#9458F400 20%,#C9A0F3)",
                          transition: "transform .9s cubic-bezier(.22,1,.36,1)",
                        }}
                      ></div>
                      <div
                        data-pulse={""}
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          width: "26%",
                          aspectRatio: "1",
                          transform: "translate(-50%,-50%)",
                          borderRadius: "50%",
                          background:
                            "radial-gradient(circle at 35% 30%,#9458F4,#3B1E59 72%)",
                          boxShadow:
                            "0 0 90px #9458F466, inset 0 0 0 1px #ffffff2b",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <img
                          src={"/assets/logo/orgtik-mark-white.svg"}
                          alt={attr("pg_home|software|img@alt")}
                          style={{
                            width: "40%",
                            height: "40%",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                      {(v.nodes || []).map((n, nIndex) => (
                        <React.Fragment key={nIndex}>
                          <button
                            onClick={n.select}
                            style={{
                              position: "absolute",
                              insetInlineStart: String(n.x),
                              top: String(n.y),
                              transform: "translate(-50%,-50%)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: "clamp(52px,5.4vw,76px)",
                                height: "clamp(52px,5.4vw,76px)",
                                borderRadius: "50%",
                                background: String(n.bg),
                                border: "1px solid " + n.border,
                                color: String(n.color),
                                boxShadow: String(n.shadow),
                                transition: "all .5s cubic-bezier(.22,1,.36,1)",
                              }}
                            >
                              <i
                                aria-hidden={true}
                                style={{ fontSize: "24px" }}
                                className={"ph " + n.icon}
                              ></i>
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                letterSpacing: ".06em",
                                color: String(n.labelC),
                                whiteSpace: "nowrap",
                                transition: "color .4s",
                              }}
                            >
                              {n.formal}
                            </span>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
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
                        {run("pg_home|approach|div", 2)}
                      </span>
                      <span
                        style={{
                          width: "36px",
                          height: "1px",
                          background: "#ffffff2e",
                        }}
                      ></span>
                      {run("pg_home|approach|div", 6)}
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
                          {run("pg_home|approach|h2", 3)}
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
                          {run("pg_home|approach|h2", 9)}
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
                    {run("pg_home|approach|p", 1)}
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
            <FAQSection data-cms-section="faqs" />
            <Testimonials data-cms-section="reviews" />
            <section data-cms-section="closing"
              id={"contact"}
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
                  {run("pg_home|closing|div", 1)}
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
                  }}
                >
                  <span style={{ display: "block" }}>
                    <span data-line={""} style={{ display: "block" }}>
                      {run("pg_home|closing|h2", 3)}
                    </span>
                  </span>
                  <span style={{ display: "block" }}>
                    <span data-line={""} style={{ display: "block" }}>
                      {run("pg_home|closing|h2", 9)}
                      <span
                        data-acc={""}
                        style={{
                          fontWeight: "500",
                          color: "#D4B7EC",
                          letterSpacing: "-.045em",
                        }}
                      >
                        {run("pg_home|closing|h2", 12)}
                      </span>
                    </span>
                  </span>
                </h2>
                <p
                  data-reveal={"up"}
                  style={{
                    fontFamily: '"OrgTik Arabic",Arial,Helvetica,sans-serif',
                    marginTop: "30px",
                    fontSize: "clamp(16px,1.2vw,18px)",
                    color: "#CFC2DB",
                  }}
                >
                  {run("pg_home|closing|p", 1)}
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
                  <a
                    ref={v.magnetRef}
                    href={toSiteHref("Contact.dc.html")}
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
                    className={"reference-state-20"}
                  >
                    {run("pg_home|closing|a", 1)}
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
                  </a>
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
              <a href={toSiteHref("#top")}>
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
                  className={"reference-state-21"}
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
                  className={"reference-state-22"}
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
                        className={"reference-state-23"}
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
                        className={"reference-state-24"}
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
                      className={"reference-state-25"}
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
                  className={"reference-state-26 reference-state-27"}
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
      </>, "pg_home")
    );
  }
}
