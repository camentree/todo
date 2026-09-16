import { useState } from "react";
import type { PointerEvent } from "react";

import type { Comment, Task, TaskPart } from "@shared/model.ts";
import { commentsFor, isDone, kindHint, partDone, partHint, partToggled, toggled, whenHint } from "@shared/tasks.ts";

import { nowStamp, useStore } from "../data/store.tsx";
import type { PressHandlers } from "../interaction/longPress.ts";
import { Chip } from "./Chip.tsx";
import { CircleTick } from "./CircleTick.tsx";
import { CommentList } from "./CommentList.tsx";
import { CommentMark } from "./CommentMark.tsx";
import { ChevronGlyph } from "./Glyphs.tsx";
import { remember, remembered } from "./Foldable.tsx";
import { Handle } from "./Handle.tsx";
import { Meta } from "./Meta.tsx";
import { SquareTick } from "./SquareTick.tsx";
import { TextButton } from "./TextButton.tsx";

export type Unfolded = "parts" | "comments" | null;

export interface Select {
  on: boolean;
  onToggle: () => void;
  onHandle: (event: PointerEvent<HTMLButtonElement>) => void;
}

function PartRow({ part, onToggle }: { part: TaskPart; onToggle: (() => void) | null }) {
  const done = partDone(part);
  return (
    <div className={done ? "part done" : "part"}>
      <CircleTick done={done} onToggle={onToggle ?? (() => null)} press={null} />
      <div className="part-text">
        <span className="part-name">{part.name}</span>
        {partHint(part) && <span className="part-hint">{partHint(part)}</span>}
        {part.note && <div className="part-note">{part.note}</div>}
      </div>
    </div>
  );
}

export function TaskRow({
  task,
  chip,
  select,
  press,
  onTitle,
  onAddComment,
  onDeleteComment,
  fixedOpen,
}: {
  task: Task;
  chip: string | null;
  select: Select | null;
  press: PressHandlers | null;
  onTitle: () => void;
  onAddComment: () => void;
  onDeleteComment: (comment: Comment) => void;
  fixedOpen: boolean;
}) {
  const store = useStore();
  const [unfolded, setUnfolded] = useState<Unfolded>(() => (fixedOpen ? "parts" : remembered({ key: "task:" + task.id, fallback: null })));
  const done = isDone({ task, entries: store.journal });
  const comments = commentsFor({ task, comments: store.comments });
  const unseen = comments.some((comment) => comment.seenAt === null);
  const foldable = task.parts.length > 0 || task.note !== "";
  const now = nowStamp();

  const unfold = (next: Unfolded) => {
    const value = unfolded === next ? null : next;
    setUnfolded(value);
    remember({ key: "task:" + task.id, value });
    if (value === "comments") for (const comment of comments) if (comment.seenAt === null) store.putComment({ ...comment, seenAt: now });
  };

  const hints = [kindHint(task), whenHint({ task, today: store.today })].filter(Boolean);

  return (
    <div className={done ? "task done" : "task"} data-task={task.id}>
      <div className="main">
        {select ? (
          <>
            <Handle onPointerDown={select.onHandle} />
            <SquareTick on={select.on} onToggle={select.onToggle} />
          </>
        ) : (
          <CircleTick done={done} onToggle={() => store.putTask(toggled({ task, entries: store.journal, now }))} press={press} />
        )}
        <TextButton active={false} onSelect={onTitle}>
          {task.name}
        </TextButton>
        {foldable && !fixedOpen && (
          <button className="fold" aria-label={unfolded === "parts" ? "fold" : "unfold"} onClick={() => unfold("parts")}>
            <ChevronGlyph open={unfolded === "parts"} />
          </button>
        )}
      </div>
      {(hints.length > 0 || chip || comments.length > 0) && (
        <Meta>
          {hints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
          {chip && <Chip>{chip}</Chip>}
          {comments.length > 0 && <CommentMark count={comments.length} unseen={unseen} onSelect={() => unfold("comments")} />}
        </Meta>
      )}
      {unfolded === "parts" && (
        <div className="unfolded">
          {task.note && <div className="note">{task.note}</div>}
          {task.parts.length > 0 && (
            <div className="parts">
              {task.parts.map((part, index) => (
                <PartRow key={index} part={part} onToggle={fixedOpen ? null : () => store.putTask(partToggled({ task, index, now }))} />
              ))}
            </div>
          )}
        </div>
      )}
      {unfolded === "comments" && (
        <div className="unfolded">
          <CommentList comments={comments} onAdd={onAddComment} onDelete={onDeleteComment} />
        </div>
      )}
    </div>
  );
}
