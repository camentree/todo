import { useEffect } from "react";

import { TextButton } from "./TextButton.tsx";

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
    <div className="scrim" onClick={onCancel}>
      <div className="confirm" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-question">{question}</div>
        <div className="confirm-choices">
          <TextButton active={false} onSelect={onCancel}>
            cancel
          </TextButton>
          {choices.map((choice) => (
            <TextButton key={choice.label} active onSelect={choice.onChoose}>
              {choice.label}
            </TextButton>
          ))}
        </div>
      </div>
    </div>
  );
}
