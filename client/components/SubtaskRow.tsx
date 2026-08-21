import { useRef, useState } from "react";

import { isTerminal } from "@shared/states.ts";
import type { Task } from "@shared/types.ts";

const SWIPE_FRACTION = 0.4;
const SWIPE_SLOP = 6;

export function SubtaskRow({
  subtask,
  onToggle,
  onRename,
  onDelete,
}: {
  subtask: Task;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const sideways = useRef(0);
  const furthest = useRef(0);
  const row = useRef<HTMLDivElement>(null);

  function finish(): void {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== subtask.title) {
      onRename(trimmed);
    } else {
      setDraft(subtask.title);
    }
    setEditing(false);
  }

  function endSwipe(commit: boolean): void {
    const travelled = sideways.current;
    const threshold =
      (row.current?.offsetWidth ?? 0) * SWIPE_FRACTION;
    startX.current = null;
    sideways.current = 0;
    setOffset(0);
    if (commit && travelled <= -threshold) {
      onDelete();
    }
  }

  return (
    <div className="subtask-track">
      {offset !== 0 && (
        <div className="swipe-action archive">Delete</div>
      )}
      <div
        className="subtask"
        ref={row}
        data-done={isTerminal(subtask.state)}
        data-swiping={offset !== 0}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          startX.current = event.clientX;
          sideways.current = 0;
          furthest.current = 0;
        }}
        onPointerMove={(event) => {
          if (startX.current === null) {
            return;
          }
          const travelled = Math.min(
            event.clientX - startX.current,
            0,
          );
          furthest.current = Math.max(
            furthest.current,
            Math.abs(travelled),
          );
          if (
            furthest.current > SWIPE_SLOP &&
            !event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          sideways.current = travelled;
          setOffset(travelled);
        }}
        onPointerUp={() => endSwipe(true)}
        onPointerCancel={() => endSwipe(false)}
      >
        <button
          type="button"
          className="subtask-tick"
          aria-label={`Mark ${subtask.title} done`}
          onClick={onToggle}
        />
        {editing ? (
          <input
            className="subtask-title"
            value={draft}
            autoFocus
            enterKeyHint="done"
            aria-label="Subtask title"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                finish();
              }
              if (event.key === "Escape") {
                setDraft(subtask.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="subtask-title"
            onClick={() => {
              if (furthest.current <= SWIPE_SLOP) {
                setEditing(true);
              }
            }}
          >
            {subtask.title}
          </button>
        )}
      </div>
    </div>
  );
}
