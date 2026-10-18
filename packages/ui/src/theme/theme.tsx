"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_COOKIE, type Theme } from "./theme-script.js";

function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** The current theme and a setter that applies it now and remembers it for a year. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setState] = useState<Theme>(DEFAULT_THEME);
  useEffect(() => {
    const update = () => setState(readTheme()); update();
    window.addEventListener("orgtik:theme", update);
    return () => window.removeEventListener("orgtik:theme", update);
  }, []);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setState(next);
    window.dispatchEvent(new Event("orgtik:theme"));
  }, []);
  return [theme, setTheme];
}
