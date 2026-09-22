import { useSyncExternalStore } from "react";

const deskQuery = window.matchMedia("(min-width: 700px) and (hover: hover)");

export function useIsPhone(): boolean {
  return !useSyncExternalStore(
    (listener) => {
      deskQuery.addEventListener("change", listener);
      return () => deskQuery.removeEventListener("change", listener);
    },
    () => deskQuery.matches,
  );
}
