import { useEffect } from "react";

function coveredBy(viewport: VisualViewport): number {
  return Math.max(
    0,
    document.documentElement.clientHeight -
      viewport.height -
      viewport.offsetTop,
  );
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) {
      return;
    }

    let shown = -1;
    let queued = 0;

    const measure = (): void => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        const covered = Math.round(coveredBy(viewport));
        if (covered === shown) {
          return;
        }
        shown = covered;
        document.documentElement.style.setProperty(
          "--keyboard-inset",
          `${covered}px`,
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
