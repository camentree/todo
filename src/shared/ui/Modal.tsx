import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const panSettle = 150;

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

export function Modal({ children }: { children: ReactNode }) {
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
    let settling = 0;
    const fit = () => {
      frame = 0;
      element.style.height = `${Math.round(viewport.height)}px`;
    };
    const unpan = () => {
      if (viewport.offsetTop !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(fit);
      window.clearTimeout(settling);
      settling = window.setTimeout(unpan, panSettle);
    };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    schedule();
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.clearTimeout(settling);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={host} className="overlay">
      {children}
    </div>
  );
}
