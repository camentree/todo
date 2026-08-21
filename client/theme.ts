import { useCallback, useState } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

const GROUND = {
  light: "#f5f8f6",
  dark: "#1c1a1e",
};

export function readTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "system";
}

export function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? systemTheme() : theme;

  document.documentElement.dataset.theme = resolved;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", GROUND[resolved]);
}

export function followSystemTheme(): void {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (readTheme() === "system") {
        applyTheme("system");
      }
    });
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  const change = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setTheme(next);
  }, []);

  return [theme, change];
}

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
