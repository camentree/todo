import { useEffect } from "react";

import { Modal } from "../ui/Modal.tsx";
import { TextButton } from "../ui/TextButton.tsx";

export interface Choice {
  label: string;
  onChoose: () => void;
}

export function Confirm({ question, choices, onCancel }: { question: string; choices: Choice[]; onCancel: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") return onCancel();
      choices[choices.length - 1]?.onChoose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [choices, onCancel]);

  return (
    <Modal>
      <div className="scrim" onClick={onCancel}>
        <div className="confirm" onClick={(event) => event.stopPropagation()}>
          <div className="confirm-question">{question}</div>
          <div className="confirm-choices">
            <TextButton className="min-h-touch px-1 py-[0.7rem] text-body font-medium text-dim hover:text-text" onSelect={onCancel}>
              cancel
            </TextButton>
            {choices.map((choice) => (
              <TextButton key={choice.label} className="min-h-touch px-1 py-[0.7rem] text-body font-medium text-accent hover:text-accent-hover" onSelect={choice.onChoose}>
                {choice.label}
              </TextButton>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
