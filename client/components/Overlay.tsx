import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const keyboardHeight = 120;

export function Overlay({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const element = host.current;
    if (!viewport || !element) return;
    let frame = 0;
    let applied = "";
    const fit = () => {
      frame = 0;
      const covered = window.innerHeight - viewport.height;
      const next = covered > keyboardHeight ? `${Math.round(viewport.offsetTop)}:${Math.round(viewport.height)}` : "";
      if (next === applied) return;
      applied = next;
      if (next === "") {
        element.style.top = "";
        element.style.height = "";
        return;
      }
      element.style.top = `${Math.round(viewport.offsetTop)}px`;
      element.style.height = `${Math.round(viewport.height)}px`;
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(fit);
    };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    schedule();
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={host} className="overlay">
      {children}
    </div>
  );
}
