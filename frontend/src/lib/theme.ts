import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "gym.theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    // Dark until someone picks otherwise (Sergio, 2026-10-31: the training-log look).
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

/** Mirrors the inline script in index.html, which applies the theme before first paint. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && darkQuery().matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a0a0a" : "#fafaf9");
}

/** On "Automatic", follow the phone switching between light and dark while the app is open. */
export function followSystemTheme() {
  darkQuery().addEventListener("change", () => {
    if (storedTheme() === "system") applyTheme("system");
  });
}

/** The chosen appearance, applied to the page and remembered on this device. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage unavailable; the choice lasts until the page is closed.
    }
  }, [theme]);

  return [theme, setTheme];
}
