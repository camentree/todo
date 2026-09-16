import { useEffect, useRef } from "react";

export type ShortcutAction = "close" | "down" | "up" | "fold" | "select" | "complete" | "edit" | "delete" | "today" | "thread" | "add" | "help";

export const shortcuts: { keys: string[]; action: ShortcutAction; label: string }[] = [
  { keys: ["Escape"], action: "close", label: "close what is open" },
  { keys: ["j", "ctrl+n"], action: "down", label: "move down" },
  { keys: ["k", "ctrl+p"], action: "up", label: "move up" },
  { keys: ["f"], action: "fold", label: "fold and unfold" },
  { keys: ["space"], action: "select", label: "select" },
  { keys: ["enter"], action: "complete", label: "complete" },
  { keys: ["i"], action: "edit", label: "edit" },
  { keys: ["d"], action: "delete", label: "delete" },
  { keys: ["t"], action: "today", label: "today, or not today" },
  { keys: ["c"], action: "thread", label: "comments" },
  { keys: ["n"], action: "add", label: "new task" },
  { keys: ["?"], action: "help", label: "this list" },
];

function keyOf(event: KeyboardEvent): string {
  const name = event.key === " " ? "space" : event.key.length === 1 ? event.key : event.key.toLowerCase() === "escape" ? "Escape" : event.key.toLowerCase();
  return event.ctrlKey ? "ctrl+" + name : name;
}

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLElement && (target.matches("input, textarea") || target.isContentEditable);
}

export function useShortcuts(handle: (action: ShortcutAction) => void): void {
  const latest = useRef(handle);
  latest.current = handle;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typing(event) || event.metaKey || event.altKey) return;
      const key = keyOf(event);
      const shortcut = shortcuts.find((each) => each.keys.includes(key));
      if (!shortcut) return;
      event.preventDefault();
      latest.current(shortcut.action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="confirm shortcuts" onClick={(event) => event.stopPropagation()}>
        {shortcuts.map((shortcut) => (
          <div key={shortcut.action} className="shortcut">
            <span className="shortcut-keys">{shortcut.keys.join("  ")}</span>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
