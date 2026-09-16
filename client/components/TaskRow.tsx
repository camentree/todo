import { useEffect, useState } from "react";
import type { PointerEvent } from "react";

import type { Comment, Task } from "@shared/model.ts";
import { partAsTask } from "@shared/move.ts";
import { isDone, kindHint, partCount, partToggled, sinceHint, whenHint } from "@shared/tasks.ts";

import { nowStamp, useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";
import { Chip } from "./Chip.tsx";
import { CircleTick } from "./CircleTick.tsx";
import { CommentList } from "./CommentList.tsx";
import { Mark } from "./Mark.tsx";
import { ChevronGlyph, PartsGlyph, SpeechGlyph } from "./Glyphs.tsx";
import { Roll, useFolds } from "./Foldable.tsx";
import { Handle } from "./Handle.tsx";
import { Meta } from "./Meta.tsx";
import { SquareTick } from "./SquareTick.tsx";
import { Swipeable } from "./Swipeable.tsx";
import { TextButton } from "./TextButton.tsx";

export interface Select {
  selected: (id: string) => boolean;
  onToggle: (id: string) => void;
  onHandle: ({ event, id }: { event: PointerEvent<HTMLButtonElement>; id: string }) => void;
}

export function openKey(id: string): string {
  return "task:" + id;
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
  onHold,
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
  onHold: ((id: string) => void) | null;
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
  const done = isDone({ task, entries: store.journal });
  const unseen = comments.some((comment) => comment.seenAt === null);
  const hasParts = task.parts.length > 0 || task.note !== "";
  const open = folds.isOpen({ key: openKey(task.id), fallback: false });
  const partsActive = folds.isOpen({ key: partsKey(task.id), fallback: true });
  const commentsActive = folds.isOpen({ key: commentsKey(task.id), fallback: unseen });
  const partsOpen = fixedOpen || unfoldParts || (open && partsActive);
  const commentsOpen = open && commentsActive && comments.length > 0;
  const now = nowStamp();
  const press = onHold ? longPress(() => onHold(task.id)) : null;

  useEffect(() => {
    if (!commentsOpen) return;
    const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    setFirstUnseen(ordered.find((comment) => comment.seenAt === null)?.id ?? null);
    if (!unseen) return;
    for (const comment of comments) if (comment.seenAt === null) store.putComment({ ...comment, seenAt: now });
    if (task.date === null) store.putTask({ ...task, date: store.today });
  }, [commentsOpen]);

  const setActive = ({ key, active }: { key: string; active: boolean }) => {
    folds.set({ key, open: active });
    if (active) return folds.set({ key: openKey(task.id), open: true });
    const other = key === partsKey(task.id) ? commentsActive : partsActive;
    if (!other) folds.set({ key: openKey(task.id), open: false });
  };

  const when = whenHint({ task, today: store.today });
  const since = sinceHint({ task, today: store.today });
  const hint = kindHint(task);

  return (
    <div className={done ? "task done" : "task"}>
      <Swipeable onRight={select ? null : onToday} onLeft={select ? null : onDelete}>
        <div className={focused === task.id ? "row focused" : "row"} data-focus={task.id}>
          <div className="main">
            {select ? (
              <>
                <Handle onPointerDown={(event) => select.onHandle({ event, id: task.id })} />
                <SquareTick on={select.selected(task.id)} onToggle={() => select.onToggle(task.id)} />
              </>
            ) : (
              <CircleTick done={done} onToggle={onTick} press={press} />
            )}
            {when && <span className="when">{when}</span>}
            <TextButton active={false} onSelect={select ? () => select.onToggle(task.id) : onTitle} press={press}>
              {task.name}
            </TextButton>
            {hint && <span className="hint">{hint}</span>}
            <div className="marks">
              {comments.length > 0 && (
                <Mark label="comments" count={String(comments.length)} active={commentsActive} onSelect={() => setActive({ key: commentsKey(task.id), active: !commentsActive })}>
                  <SpeechGlyph />
                </Mark>
              )}
              {hasParts && (
                <Mark label="parts" count={partCount(task)} active={partsActive} onSelect={() => setActive({ key: partsKey(task.id), active: !partsActive })}>
                  <PartsGlyph />
                </Mark>
              )}
              {(hasParts || comments.length > 0) && !fixedOpen && (
                <button className="fold" aria-label={open ? "fold" : "unfold"} onClick={() => folds.set({ key: openKey(task.id), open: !open })}>
                  <ChevronGlyph open={open} />
                </button>
              )}
            </div>
          </div>
          {(since || chip) && (
            <Meta>
              {chip && <Chip>{chip}</Chip>}
              {since && <span>{since}</span>}
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
      {hasParts && (
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
                      select={select}
                      onHold={onHold}
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
