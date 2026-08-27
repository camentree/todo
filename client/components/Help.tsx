import { Fragment } from "react";

import { Label } from "./ui/Label.tsx";
import { Modal } from "./ui/Modal.tsx";

const KEYS = [
  { keys: ["j", "↓", "⌃n"], does: "next" },
  { keys: ["k", "↑", "⌃p"], does: "previous" },
  { keys: ["→", "←", "o"], does: "expand/collapse" },
  { keys: ["tab", "⇧tab"], does: "next/previous and rename" },
  { keys: ["space"], does: "toggle complete" },
  { keys: ["i"], does: "rename" },
  { keys: ["enter"], does: "info" },
  { keys: ["+"], does: "add subtask" },
  { keys: ["a"], does: "archive" },
  { keys: ["s"], does: "today/skip" },
  { keys: ["z"], does: "undo" },
  { keys: ["r"], does: "redo" },
  { keys: ["c"], does: "copy" },
  { keys: ["p"], does: "paste" },
  { keys: ["n"], does: "add" },
  { keys: ["f", "F"], does: "open/close search" },
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

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Shortcuts" shape="centred" onDismiss={onClose}>
      <span className="help-head">
        <Label>Keys</Label>
      </span>
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
    </Modal>
  );
}
