import type { PointerEvent } from "react";

import type { PressHandlers } from "../interaction/longPress.ts";
import { Box } from "./Glyphs.tsx";

export function TaskRow({
  id,
  name,
  meta,
  done,
  child,
  arranging,
  dragging,
  press,
  onOpen,
  onToggle,
  onDragStart,
}: {
  id: string;
  name: string;
  meta: string;
  done: boolean;
  child: boolean;
  arranging: boolean;
  dragging: boolean;
  press: PressHandlers | null;
  onOpen: () => void;
  onToggle: (() => void) | null;
  onDragStart: ((event: PointerEvent) => void) | null;
}) {
  const classes = ["row", done && "done", child && "child", arranging && "arranging", dragging && "dragging"].filter(Boolean).join(" ");
  return (
    <div className={classes} data-task={id} {...press}>
      {arranging && onDragStart && (
        <button className="handle" aria-label="reorder" onPointerDown={onDragStart}>
          ≡
        </button>
      )}
      <button className="row-name" onClick={onOpen}>
        <span>{name}</span>
        {meta && <span className="row-meta numbers">{meta}</span>}
      </button>
      {onToggle && (
        <button className="box-button" aria-label={done ? "mark not done" : "mark done"} onClick={onToggle}>
          <Box done={done} />
        </button>
      )}
    </div>
  );
}
