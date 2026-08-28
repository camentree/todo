import { useEffect } from "react";

function coveredBy(viewport: VisualViewport): number {
  return Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop,
  );
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) {
      return;
    }

    const measure = (): void => {
      document.documentElement.style.setProperty(
        "--keyboard-inset",
        `${Math.round(coveredBy(viewport))}px`,
      );
    };

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);
}
