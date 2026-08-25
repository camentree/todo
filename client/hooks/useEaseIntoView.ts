import { useEffect } from "react";

const BREATHING_ROOM = 96;
const SCROLL_MILLISECONDS = 900;

const TYPING_INPUTS = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "number",
  "password",
]);

export function useEaseIntoView(): void {
  useEffect(() => {
    function onFocusIn(event: FocusEvent): void {
      const field = event.target;
      if (!isTextEntry(field)) {
        return;
      }
      const row = field.closest(".task");
      const owner = row
        ?.closest(".subtasks")
        ?.closest(".swipe-track")
        ?.querySelector(".task");
      easeToTop(owner ?? row ?? field);
    }
    window.addEventListener("focusin", onFocusIn);
    return () => window.removeEventListener("focusin", onFocusIn);
  }, []);
}

function isTextEntry(
  field: EventTarget | null,
): field is HTMLTextAreaElement | HTMLInputElement {
  if (field instanceof HTMLTextAreaElement) {
    return true;
  }
  return (
    field instanceof HTMLInputElement && TYPING_INPUTS.has(field.type)
  );
}

export function easeToTop(element: Element): void {
  const from = window.scrollY;
  const to = Math.max(
    0,
    from + element.getBoundingClientRect().top - BREATHING_ROOM,
  );
  const started = performance.now();

  function step(now: number): void {
    const through = Math.min(
      (now - started) / SCROLL_MILLISECONDS,
      1,
    );
    const eased = 1 - Math.pow(1 - through, 3);
    window.scrollTo({
      top: from + (to - from) * eased,
      behavior: "instant",
    });
    if (through < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
