import { useEffect } from "react";

export function useShortcuts(
  handle: (event: KeyboardEvent) => void,
): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const chord =
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === "n" || event.key === "p");
      if (
        !chord &&
        (event.metaKey || event.ctrlKey || event.altKey)
      ) {
        return;
      }
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        active.closest("input, textarea, select");
      const inSearch =
        active instanceof HTMLElement &&
        active.hasAttribute("data-search-field");
      const leavingSearch = event.key === "Escape" && inSearch;
      const movingResults =
        inSearch &&
        (chord ||
          event.key === "ArrowDown" ||
          event.key === "ArrowUp") &&
        document.querySelector(".search-suggestions") === null;
      if (typing && !leavingSearch && !movingResults) {
        return;
      }
      if (document.querySelector("[role=dialog]")) {
        return;
      }
      handle(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
