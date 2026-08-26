import type { ReactNode } from "react";

export function Confirm({
  question,
  detail,
  keepLabel = "Keep",
  destroyLabel = "Delete",
  onKeep,
  onDestroy,
}: {
  question: string;
  detail?: ReactNode;
  keepLabel?: string;
  destroyLabel?: string;
  onKeep: () => void;
  onDestroy: () => void;
}) {
  return (
    <>
      <div className="scrim confirm-scrim" onClick={onKeep} />
      <div className="confirm" role="dialog" aria-label={question}>
        <p className="confirm-question">{question}</p>
        {detail && <p className="confirm-detail">{detail}</p>}
        <div className="confirm-choices">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onKeep}
          >
            {keepLabel}
          </button>
          <button
            type="button"
            className="confirm-destroy"
            onClick={onDestroy}
          >
            {destroyLabel}
          </button>
        </div>
      </div>
    </>
  );
}
