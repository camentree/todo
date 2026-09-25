import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { mergeClasses } from "./mergeClasses.ts";

const panSettle = 150;

export function Modal({ className, children }: { className?: string; children: ReactNode }) {
  const host = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = host.current;
    if (!dialog) return;
    const stayOpen = (event: Event) => event.preventDefault();
    dialog.addEventListener("cancel", stayOpen);
    dialog.showModal();
    dialog.focus();
    return () => {
      dialog.removeEventListener("cancel", stayOpen);
      dialog.close();
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const dialog = host.current;
    if (!viewport || !dialog) return;
    let frame = 0;
    let settling = 0;
    const fit = () => {
      frame = 0;
      dialog.style.height = `${Math.round(viewport.height)}px`;
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
    <dialog
      ref={host}
      className={mergeClasses(
        "overlay fixed inset-0 m-0 flex h-auto max-h-none w-auto max-w-none flex-col overflow-hidden border-0 bg-transparent p-0 text-inherit not-open:hidden backdrop:bg-transparent",
        className,
      )}
      tabIndex={-1}
    >
      {children}
    </dialog>
  );
}
