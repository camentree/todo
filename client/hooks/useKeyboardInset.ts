import { useEffect } from "react";

const A_KEYBOARD_IS_AT_LEAST = 120;

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) {
      return;
    }

    let shown = "";
    let queued = 0;

    const measure = (): void => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        const covered =
          document.documentElement.clientHeight -
          viewport.offsetTop -
          viewport.height;
        const next =
          covered > A_KEYBOARD_IS_AT_LEAST
            ? `${Math.round(covered)}px`
            : "0px";
        if (next === shown) {
          return;
        }
        shown = next;
        document.documentElement.style.setProperty("--covered", next);
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
