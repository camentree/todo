import {
  changeGlobal,
  currentGlobal,
  useGlobalSettings,
} from "../data/settings.ts";
import type { Theme } from "../data/settings.ts";

const GROUND = {
  light: "#f5f8f6",
  dark: "#1c1a1e",
};

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
      applyTheme(currentGlobal().theme);
    });
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const { theme } = useGlobalSettings();

  return [
    theme,
    (next: Theme) => {
      changeGlobal({ theme: next });
      applyTheme(next);
    },
  ];
}

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
