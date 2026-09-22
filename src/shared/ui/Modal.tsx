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
    <dialog ref={host} className="overlay fixed inset-0 m-0 flex h-auto max-h-none w-auto max-w-none flex-col overflow-hidden border-0 bg-none p-0 text-inherit not-open:hidden backdrop:bg-none" tabIndex={-1}>
      {children}
    </dialog>
  );
}
