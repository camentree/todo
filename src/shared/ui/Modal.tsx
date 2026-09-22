import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Modal({ children }: { children: ReactNode }) {
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

  return (
    <dialog ref={host} className="overlay" tabIndex={-1}>
      {children}
    </dialog>
  );
}
