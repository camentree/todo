import { Fragment, useEffect } from "react";

import { useLockedScroll } from "../useLockedScroll.ts";

const KEYS = [
  { keys: ["j", "↓", "⌃n"], does: "Next task" },
  { keys: ["k", "↑", "⌃p"], does: "Previous task" },
  { keys: ["space"], does: "Tick it off" },
  { keys: ["enter"], does: "Rename it" },
  { keys: ["i"], does: "Open its info" },
  { keys: ["a"], does: "Archive it" },
  { keys: ["h"], does: "Hide it" },
  { keys: ["c"], does: "Add a task" },
  { keys: ["esc"], does: "Clear the focus" },
  { keys: ["?"], does: "This list" },
];

const SYMBOLS = [
  { symbol: "#health", means: "a tag" },
  { symbol: "@claude", means: "who it belongs to" },
  { symbol: "/programming", means: "the list" },
  { symbol: "!blocked", means: "the stage" },
  { symbol: "tomorrow, 3pm, aug 20", means: "a due date and time" },
  { symbol: "daily, every 2 weeks", means: "a repeating schedule" },
  { symbol: "\\today", means: "the word itself, no date" },
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  useLockedScroll();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" || event.key === "?") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="help" role="dialog" aria-label="Shortcuts">
        <span className="help-head">Keys</span>
        <div className="help-rows">
          {KEYS.map(({ keys, does }) => (
            <Fragment key={does}>
              <span className="help-keys">
                {keys.map((key) => (
                  <span className="help-key" key={key}>
                    {key}
                  </span>
                ))}
              </span>
              <span>{does}</span>
            </Fragment>
          ))}
        </div>

        <span className="help-head">Typing a task</span>
        <div className="help-rows">
          {SYMBOLS.map(({ symbol, means }) => (
            <Fragment key={symbol}>
              <span className="help-keys">
                <span className="help-key">{symbol}</span>
              </span>
              <span>{means}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
