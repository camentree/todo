import { useEffect } from "react";

export function useLockedScroll(): void {
  useEffect(() => {
    const root = document.documentElement;
    const held = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = held;
    };
  }, []);
}
