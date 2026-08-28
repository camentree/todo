import { useSyncExternalStore } from "react";

const pointerHovers = window.matchMedia("(hover: hover)");

export function useCanHover(): boolean {
  return useSyncExternalStore(
    (notify) => {
      pointerHovers.addEventListener("change", notify);
      return () =>
        pointerHovers.removeEventListener("change", notify);
    },
    () => pointerHovers.matches,
  );
}
