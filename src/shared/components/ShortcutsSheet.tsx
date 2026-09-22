import type { Shortcut } from "../hooks/useShortcuts.ts";

export function ShortcutsSheet<Action extends string>({ shortcuts, onClose }: { shortcuts: Shortcut<Action>[]; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="fixed inset-x-0 bottom-0 z-[21] mx-auto flex max-w-column flex-col gap-0 rounded-t-2xl bg-raised px-gutter pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
        {shortcuts.map((shortcut) => (
          <div key={shortcut.action} className="flex gap-4 px-1 py-[0.3rem] text-body">
            <span className="min-w-[7rem] font-mono text-label whitespace-pre text-dim">{shortcut.keys.join("  ")}</span>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
