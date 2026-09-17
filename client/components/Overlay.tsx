import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const keyboardHeight = 120;

let overlaysOpen = 0;
let scrolledTo = 0;

function holdTheList(): void {
  overlaysOpen += 1;
  if (overlaysOpen > 1) return;
  scrolledTo = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  document.body.style.top = `-${scrolledTo}px`;
}

function releaseTheList(): void {
  overlaysOpen -= 1;
  if (overlaysOpen > 0) return;
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.top = "";
  window.scrollTo(0, scrolledTo);
}

export function Overlay({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    holdTheList();
    return releaseTheList;
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const element = host.current;
    if (!viewport || !element) return;
    let frame = 0;
    let applied = "";
    const fit = () => {
      frame = 0;
      const covered = document.documentElement.clientHeight - viewport.height;
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
