import { useSyncExternalStore } from "react";

const sheetQuery = window.matchMedia("(min-width: 700px) and (hover: hover)");

export function useSheet(): boolean {
  return useSyncExternalStore((listener) => {
    sheetQuery.addEventListener("change", listener);
    return () => sheetQuery.removeEventListener("change", listener);
  }, () => sheetQuery.matches);
}
