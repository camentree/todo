import { useEffect, useState } from "react";
import type { PointerEvent } from "react";

import type { Comment, Task } from "@shared/model.ts";
import { partAsTask } from "@shared/move.ts";
import { isDone, kindHint, partCount, partToggled, whenHint } from "@shared/tasks.ts";

import { nowStamp, useStore } from "../data/store.tsx";
import type { PressHandlers } from "../interaction/longPress.ts";
import { Chip } from "./Chip.tsx";
import { CircleTick } from "./CircleTick.tsx";
import { CommentList } from "./CommentList.tsx";
import { CommentMark } from "./CommentMark.tsx";
import { ChevronGlyph } from "./Glyphs.tsx";
import { Roll, useFolds } from "./Foldable.tsx";
import { Handle } from "./Handle.tsx";
import { Meta } from "./Meta.tsx";
import { SquareTick } from "./SquareTick.tsx";
import { Swipeable } from "./Swipeable.tsx";
import { TextButton } from "./TextButton.tsx";

export interface Select {
  on: boolean;
  onToggle: () => void;
  onHandle: (event: PointerEvent<HTMLButtonElement>) => void;
  onPartHandle: (event: PointerEvent<HTMLButtonElement>, index: number) => void;
}

export function partsKey(id: string): string {
  return "task:" + id + ":parts";
}

export function commentsKey(id: string): string {
  return "task:" + id + ":comments";
}

export function TaskRow({
  task,
  comments,
  chip,
  select,
  press,
  focused,
  onTick,
  onTitle,
  onToday,
  onDelete,
  onDeletePart,
  onAddComment,
  onDeleteComment,
  fixedOpen,
  unfoldParts,
}: {
  task: Task;
  comments: Comment[];
  chip: string | null;
  select: Select | null;
  press: PressHandlers | null;
  focused: string | null;
  onTick: () => void;
  onTitle: () => void;
  onToday: (() => void) | null;
  onDelete: (() => void) | null;
  onDeletePart: ((index: number) => void) | null;
  onAddComment: () => void;
  onDeleteComment: (comment: Comment) => void;
  fixedOpen: boolean;
  unfoldParts: boolean;
}) {
  const store = useStore();
  const folds = useFolds();
  const [firstUnseen, setFirstUnseen] = useState<string | null>(null);
  const partsOpen = fixedOpen || unfoldParts || folds.isOpen({ key: partsKey(task.id), fallback: false });
  const commentsOpen = comments.length > 0 && folds.isOpen({ key: commentsKey(task.id), fallback: false });
  const done = isDone({ task, entries: store.journal });
  const unseen = comments.some((comment) => comment.seenAt === null);
  const foldable = task.parts.length > 0 || task.note !== "";
  const now = nowStamp();

  useEffect(() => {
    if (!commentsOpen) return;
    const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    setFirstUnseen(ordered.find((comment) => comment.seenAt === null)?.id ?? null);
    if (!unseen) return;
    for (const comment of comments) if (comment.seenAt === null) store.putComment({ ...comment, seenAt: now });
    if (task.date === null) store.putTask({ ...task, date: store.today });
  }, [commentsOpen]);

  const when = whenHint({ task, today: store.today });
  const hint = kindHint(task);
  const count = partCount(task);

  return (
    <div className={done ? "task done" : "task"}>
      <Swipeable onRight={select ? null : onToday} onLeft={select ? null : onDelete}>
        <div className={focused === task.id ? "row focused" : "row"} data-focus={task.id}>
          <div className="main">
            {select ? (
              <>
                <Handle onPointerDown={select.onHandle} />
                <SquareTick on={select.on} onToggle={select.onToggle} />
              </>
            ) : (
              <CircleTick done={done} onToggle={onTick} press={press} />
            )}
            <TextButton active={false} onSelect={onTitle} press={press}>
              {task.name}
              {hint && <span className="hint">{hint}</span>}
            </TextButton>
            {count && <span className="part-count">{count}</span>}
            {foldable && !fixedOpen && (
              <button className="fold" aria-label={partsOpen ? "fold" : "unfold"} onClick={() => folds.set({ key: partsKey(task.id), open: !partsOpen })}>
                <ChevronGlyph open={partsOpen} />
              </button>
            )}
          </div>
          {(when || chip || comments.length > 0) && (
            <Meta>
              {chip && <Chip>{chip}</Chip>}
              {when && <span>{when}</span>}
              {comments.length > 0 && <CommentMark count={comments.length} unseen={unseen} onSelect={() => folds.set({ key: commentsKey(task.id), open: !commentsOpen })} />}
            </Meta>
          )}
        </div>
      </Swipeable>
      {comments.length > 0 && (
        <Roll open={commentsOpen}>
          <div className="unfolded">
            <CommentList comments={comments} scrollTo={firstUnseen} onAdd={onAddComment} onDelete={onDeleteComment} />
          </div>
        </Roll>
      )}
      {foldable && (
        <Roll open={partsOpen}>
          <div className="unfolded">
            {task.note && <div className="note">{task.note}</div>}
            {task.parts.length > 0 && (
              <div className="parts">
                {task.parts.map((part, index) => (
                  <div key={index} data-part={task.id + ":" + index}>
                    <TaskRow
                      task={{ ...partAsTask({ part, host: task, id: task.id + ":" + index, created: task.created }), date: null }}
                      comments={[]}
                      chip={null}
                      select={select ? { ...select, onHandle: (event) => select.onPartHandle(event, index), onPartHandle: () => null } : null}
                      press={press}
                      focused={focused}
                      onTick={() => (fixedOpen ? null : store.putTask(partToggled({ task, index, now })))}
                      onTitle={onTitle}
                      onToday={null}
                      onDelete={onDeletePart ? () => onDeletePart(index) : null}
                      onDeletePart={null}
                      onAddComment={() => null}
                      onDeleteComment={() => null}
                      fixedOpen={fixedOpen}
                      unfoldParts={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Roll>
      )}
    </div>
  );
}
