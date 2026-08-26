import { useEffect } from "react";
import type { ReactNode } from "react";

export function Menu({
  anchor,
  onClose,
  children,
}: {
  anchor: "title" | "right";
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="menu" data-anchor={anchor}>
      {children}
    </div>
  );
}
