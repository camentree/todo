import { Fragment, useEffect } from "react";

import { useLockedScroll } from "../useLockedScroll.ts";

const KEYS = [
  { keys: ["j", "↓", "⌃n"], does: "next" },
  { keys: ["k", "↑", "⌃p"], does: "previous" },
  { keys: ["space"], does: "toggle complete" },
  { keys: ["enter"], does: "rename" },
  { keys: ["i"], does: "info" },
  { keys: ["a"], does: "archive" },
  { keys: ["h"], does: "hide/skip" },
  { keys: ["c"], does: "add" },
  { keys: ["f"], does: "search" },
  { keys: ["esc"], does: "blur" },
  { keys: ["?"], does: "help" },
];

const SYMBOLS = [
  { symbol: "#health", means: "tag" },
  { symbol: "@claude", means: "assignee" },
  { symbol: "/programming", means: "list name" },
  { symbol: "!blocked", means: "programming stage" },
  { symbol: ":complete", means: "state" },
  { symbol: "tomorrow, 3pm, aug 20", means: "due date/time" },
  { symbol: "daily, every 2 weeks", means: "schedule" },
  { symbol: "\\today", means: "escape character" },
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
