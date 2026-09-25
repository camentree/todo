import { useEffect, useRef } from "react";

export interface KeyboardBinding<Action extends string> {
  keys: string[];
  action: Action;
  label: string;
}

function keyOf(event: KeyboardEvent): string {
  const name = event.key === " " ? "space" : event.key.length === 1 ? event.key : event.key.toLowerCase() === "escape" ? "Escape" : event.key.toLowerCase();
  return event.ctrlKey ? "ctrl+" + name : name;
}

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLElement && (target.matches("input, textarea") || target.isContentEditable);
}

export function useKeyboard<Action extends string>({ bindings, handle }: { bindings: KeyboardBinding<Action>[]; handle: (action: Action) => void }): void {
  const latest = useRef(handle);
  latest.current = handle;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typing(event) || event.metaKey || event.altKey) return;
      const key = keyOf(event);
      const binding = bindings.find((each) => each.keys.includes(key));
      if (!binding) return;
      event.preventDefault();
      latest.current(binding.action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
