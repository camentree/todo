import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";

import { useLockedScroll } from "../../hooks/useLockedScroll.ts";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusableInside(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) {
    return [];
  }
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      element.offsetParent !== null &&
      element.closest('[data-open="false"]') === null,
  );
}

export function Modal({
  label,
  shape,
  closing = false,
  settled = false,
  dragging,
  style,
  onDismiss,
  onEscape,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: {
  label: string;
  shape: "sheet" | "centred";
  closing?: boolean;
  settled?: boolean;
  dragging?: boolean;
  style?: CSSProperties;
  onDismiss: () => void;
  onEscape?: () => void;
  onPointerDown?: (event: PointerEvent) => void;
  onPointerMove?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useLockedScroll();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const fields = focusableInside(panel.current);
        if (fields.length === 0) {
          return;
        }
        const active = document.activeElement;
        const here =
          active instanceof HTMLElement ? fields.indexOf(active) : -1;
        if (here === -1) {
          (event.shiftKey
            ? fields[fields.length - 1]
            : fields[0]
          )?.focus();
          return;
        }
        const step = event.shiftKey ? -1 : 1;
        fields[
          (here + step + fields.length) % fields.length
        ]?.focus();
        return;
      }
      if (event.key === "Escape") {
        (onEscape ?? onDismiss)();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <div
        className="scrim"
        data-closing={closing}
        data-settled={settled}
        onClick={onDismiss}
      />
      <div
        className={shape === "sheet" ? "sheet" : "help"}
        ref={panel}
        role="dialog"
        aria-label={label}
        data-closing={closing}
        data-settled={settled}
        data-dragging={dragging}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </>
  );
}
