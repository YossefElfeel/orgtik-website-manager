"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SealCheck, ShieldCheck } from "@phosphor-icons/react";
import { useOrgtik, useStrings } from "../provider/OrgtikProvider.js";
import { Badge } from "./Badge.js";
import { Progress } from "./Meters.js";
import { Button } from "./Button.js";

/** Render only after the host has verified and stored the session. */
export function AuthSuccess({ onContinue, app = "OrgTik", autoContinue = true }: { onContinue: () => void; app?: string; autoContinue?: boolean }) {
  const t = useStrings();
  const { dir } = useOrgtik();
  const content = useRef<HTMLDivElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const next = useRef(onContinue);
  const continued = useRef(false);
  const proceed = useCallback(() => {
    if (continued.current) return;
    continued.current = true;
    next.current();
  }, []);
  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    const enter = (element: HTMLElement | null, frames: Keyframe[], duration: number, delay = 0, easing = "cubic-bezier(0.16, 1, 0.3, 1)") => {
      if (element?.animate) animations.push(element.animate(frames, { duration, delay, easing, fill: "backwards" }));
    };
    if (preference.matches) {
      enter(content.current, [{ opacity: 0.8 }, { opacity: 1 }], 120);
    } else {
      enter(content.current, [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "translateY(0)" }], 300);
      // Reproduce the original seal's spring (stiffness 200, damping 12) without
      // a motion dependency. Animate its wrapper rather than the SVG.
      const spring = Array.from({ length: 49 }, (_, index) => {
        const time = (index / 48) * 0.8;
        const frequency = Math.sqrt(200 - 6 * 6);
        const value = index === 48 ? 1 : 1 - Math.exp(-6 * time) * (Math.cos(frequency * time) + (6 / frequency) * Math.sin(frequency * time));
        return { offset: index / 48, transform: `scale(${value}) rotate(${-90 * (1 - value)}deg)` };
      });
      enter(seal.current, spring, 800, 200, "linear");
      enter(headline.current, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], 300, 100);
      enter(card.current, [{ opacity: 0, transform: "scale(0.95)" }, { opacity: 1, transform: "scale(1)" }], 300, 200);
      // The value is already verified (100%); the fill is its visual confirmation.
      const fill = card.current?.querySelector<HTMLElement>(".bg-action-primary") ?? null;
      const transformOrigin = dir === "rtl" ? "right" : "left";
      enter(fill, [{ transform: "scaleX(0)", transformOrigin }, { transform: "scaleX(1)", transformOrigin }], 800, 300, "ease-out");
      enter(badge.current, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], 300, 400);
    }
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) cancel();
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancel();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [dir]);
  useEffect(() => {
    next.current = onContinue;
  }, [onContinue]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (!autoContinue) return;
    const timer = window.setTimeout(proceed, 1800);
    return () => window.clearTimeout(timer);
  }, [autoContinue, proceed]);

  return (
    <section data-auth-success="true" aria-labelledby="auth-success-title" className="fixed inset-0 z-50 grid overflow-y-auto bg-canvas px-5 py-10 font-body text-fg">
      <div ref={content} className="m-auto flex w-full max-w-xl flex-col items-center text-center">
        <div ref={seal} aria-hidden="true" className="shrink-0">
          <SealCheck weight="fill" className="size-24 text-success-solid" />
        </div>
        <div ref={headline} className="mt-6 flex w-full flex-col items-center">
          <h1 id="auth-success-title" ref={heading} tabIndex={-1} className="font-display text-title outline-none">{t("authSuccessTitle")}</h1>
          <p className="mt-3 max-w-lg text-body-lg text-fg-muted">{t("authSuccessBody", { app })}</p>
        </div>
        <div ref={card} className="mt-10 w-full rounded-card border border-success-solid/25 bg-raised p-5 text-start">
          <div aria-hidden="true"><Progress value={100} label={<span className="text-success">{t("authVerified")}</span>} className="[&_.bg-action-primary]:bg-success-solid" /></div>
          <p className="mt-3 text-caption font-medium text-success">{t("authAccessGranted")}</p>
        </div>
        <div ref={badge} className="mt-12 max-w-full">
          <Badge tone="success" icon={<ShieldCheck />} className="h-10 gap-2 px-5">{t("authSecureAccess")}</Badge>
        </div>
        <Button className="mt-6" onClick={proceed}>{t("authContinue")}</Button>
      </div>
    </section>
  );
}

/** The host supplies its existing safe destination after authentication succeeds. */
export function useAuthSuccess(app = "OrgTik", signIn = false) {
  const [next, setNext] = useState<(() => void) | null>(null);
  // Capture before hosts remove one-use credentials from the address. This is only
  // presentation state: hosts still validate and store the session before confirm.
  const fresh = useRef<boolean | null>(null);
  if (fresh.current === null && typeof window !== "undefined") fresh.current = new URLSearchParams(window.location.search).get("fresh") === "1";
  const confirm = useCallback((onContinue: () => void) => {
    if (signIn || fresh.current) setNext(() => onContinue);
    else onContinue();
  }, [signIn]);
  return { confirm, success: next ? <AuthSuccess app={app} onContinue={next} /> : null };
}
