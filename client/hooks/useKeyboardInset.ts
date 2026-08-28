import { useEffect } from "react";

const A_KEYBOARD_IS_AT_LEAST = 120;

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) {
      return;
    }

    let shownBottom = "";
    let queued = 0;

    const measure = (): void => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        const bottom = viewport.offsetTop + viewport.height;
        const covered =
          document.documentElement.clientHeight - bottom;
        const open = covered > A_KEYBOARD_IS_AT_LEAST;
        const nextBottom = open ? `${Math.round(bottom)}px` : "100%";
        if (nextBottom === shownBottom) {
          return;
        }
        shownBottom = nextBottom;
        const root = document.documentElement.style;
        root.setProperty("--visible-bottom", nextBottom);
        root.setProperty(
          "--visible-height",
          open ? `${Math.round(viewport.height)}px` : "100dvh",
        );
      });
    };

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(queued);
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);
}
