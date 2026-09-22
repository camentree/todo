import type { Shortcut } from "../hooks/useShortcuts.ts";

export function ShortcutsSheet<Action extends string>({ shortcuts, onClose }: { shortcuts: Shortcut<Action>[]; onClose: () => void }) {
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
