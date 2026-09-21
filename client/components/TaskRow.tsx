import { useEffect, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

import type { Comment, Task } from "@shared/model.ts";
import { everyLabel } from "@shared/grammar.ts";
import { commentsFor, isDone, isSkipped, kindHint, subtaskCount, subtaskToggled, whenHint } from "@shared/tasks.ts";

import { nowStamp, useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";
import { CircleTick } from "./CircleTick.tsx";
import { CommentList } from "./CommentList.tsx";
import { Mark } from "./Mark.tsx";
import { ChevronGlyph, RepeatGlyph, SpeechGlyph, SubtasksGlyph } from "./Glyphs.tsx";
import { Roll, useFolds } from "./Foldable.tsx";
import type { Folds } from "./Foldable.tsx";
import { Handle } from "./Handle.tsx";
import { Meta } from "./Meta.tsx";
import { SquareTick } from "./SquareTick.tsx";
import { Swipeable } from "./Swipeable.tsx";
import type { Swipe } from "./Swipeable.tsx";

export interface Select {
  selected: (id: string) => boolean;
  onToggle: (id: string) => void;
  onHandle: ({ event, id }: { event: PointerEvent<HTMLButtonElement>; id: string }) => void;
}

export function showing({ folds, task }: { folds: Folds; task: Task }) {
  const comments = commentsFor(task);
  const newest = comments[0] ?? null;
  const agentUnseen = newest !== null && newest.author === "agent" && newest.seenAt === null;
  const hasSubtasks = task.subtasks.length > 0 || task.note !== "";
  const subtasksShowing = hasSubtasks && folds.isOpen({ key: subtasksKey(task.id), fallback: false });
  const commentsShowing = comments.length > 0 && folds.isOpen({ key: commentsKey(task.id), fallback: false });
  return { agentUnseen, hasSubtasks, subtasksShowing, commentsShowing, open: subtasksShowing || commentsShowing };
}

export function toggleSubtasks({ folds, task }: { folds: Folds; task: Task }) {
  const { agentUnseen, hasSubtasks, subtasksShowing } = showing({ folds, task });
  if (!hasSubtasks) return toggleComments({ folds, task });
  folds.set({ key: subtasksKey(task.id), open: !subtasksShowing });
  if (!subtasksShowing && agentUnseen) folds.set({ key: commentsKey(task.id), open: true });
}

export function toggleComments({ folds, task }: { folds: Folds; task: Task }) {
  const { commentsShowing } = showing({ folds, task });
  if (task.comments.length > 0) folds.set({ key: commentsKey(task.id), open: !commentsShowing });
}

export function closeTask({ folds, task }: { folds: Folds; task: Task }) {
  folds.set({ key: subtasksKey(task.id), open: false });
  folds.set({ key: commentsKey(task.id), open: false });
}

export function subtasksKey(id: string): string {
  return "task:" + id + ":subtasks";
}

export function commentsKey(id: string): string {
  return "task:" + id + ":comments";
}

export function TaskRow({
  task,
  chips,
  every,
  select,
  onHold,
  focused,
  saved,
  onTick,
  onTitle,
  onTitleSubtask,
  todaySwipe,
  onDelete,
  onDeleteSubtask,
  onAddComment,
  onDeleteComment,
  fixedOpen,
  unfoldSubtasks,
}: {
  task: Task;
  chips: string[];
  every: string | null;
  select: Select | null;
  onHold: ((id: string) => void) | null;
  focused: string | null;
  saved: string | null;
  onTick: () => void;
  onTitle: () => void;
  onTitleSubtask: ((index: number) => void) | null;
  todaySwipe: Swipe | null;
  onDelete: (() => void) | null;
  onDeleteSubtask: ((index: number) => void) | null;
  onAddComment: (body: string) => void;
  onDeleteComment: (comment: Comment) => void;
  fixedOpen: boolean;
  unfoldSubtasks: boolean;
}) {
  const store = useStore();
  const folds = useFolds();
  const [firstUnseen, setFirstUnseen] = useState<string | null>(null);
  const comments = commentsFor(task);
  const done = isDone({ task, entries: store.journal });
  const skipped = !done && isSkipped(task);
  const unseen = comments.some((comment) => comment.seenAt === null);
  const { agentUnseen, hasSubtasks, open, subtasksShowing, commentsShowing } = showing({ folds, task });
  const subtasksOpen = fixedOpen || unfoldSubtasks || subtasksShowing;
  const now = nowStamp();
  const press = onHold ? longPress(() => onHold(task.id)) : null;

  useEffect(() => {
    if (!commentsShowing) return;
    const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    setFirstUnseen(ordered.find((comment) => comment.seenAt === null)?.id ?? null);
    // Reading a deleted task must not mark its comments seen, and must not pull it
    // back onto today the way an unseen comment does for a live one.
    if (!unseen || task.deletedAt) return;
    for (const comment of comments) if (comment.seenAt === null) store.putComment({ ...comment, seenAt: now });
    if (task.dueDate === null) store.putTask({ ...task, dueDate: store.today });
  }, [commentsShowing]);

  const onChevron = () => (open ? closeTask({ folds, task }) : toggleSubtasks({ folds, task }));

  const onCommentGlyph = () => toggleComments({ folds, task });

  const onRow = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (select) return select.onToggle(task.id);
    onTitle();
  };

  const onSubtasksGlyph = () => toggleSubtasks({ folds, task });

  const when = whenHint({ task, today: store.today });
  const schedule = everyLabel(every);
  const hint = kindHint(task);

  return (
    <div className={done ? "task done" : skipped ? "task skipped" : "task"}>
      <Swipeable right={select ? null : todaySwipe} left={select || !onDelete ? null : { word: "delete", onSwipe: onDelete }}>
        <div className={"row" + (focused === task.id ? " focused" : "") + (saved === task.id ? " saved" : "")} data-focus={task.id} onClick={onRow} {...press}>
          <div className="main">
            {select ? (
              <>
                <Handle onPointerDown={(event) => select.onHandle({ event, id: task.id })} />
                <SquareTick on={select.selected(task.id)} onToggle={() => select.onToggle(task.id)} />
              </>
            ) : (
              <CircleTick done={done} skipped={skipped} onToggle={onTick} />
            )}
            <span className="text">
              {task.title}
              {hint && <span className="hint">{hint}</span>}
            </span>
            <div className="marks">
              {comments.length > 0 && (
                <Mark label="comments" active={commentsShowing} onSelect={onCommentGlyph}>
                  <SpeechGlyph />
                  {agentUnseen && <span className="unseen" />}
                </Mark>
              )}
              {hasSubtasks && (
                <Mark label="subtasks" count={subtaskCount(task)} active={subtasksShowing} onSelect={open ? onSubtasksGlyph : null}>
                  <SubtasksGlyph />
                </Mark>
              )}
              {(hasSubtasks || comments.length > 0) && !fixedOpen && (
                <button className="fold" aria-label={open ? "fold" : "unfold"} onClick={onChevron}>
                  <ChevronGlyph open={open} />
                </button>
              )}
            </div>
          </div>
          {(when || schedule || chips.length > 0) && (
            <Meta>
              {when && <span className="when">{when}</span>}
              {schedule && (
                <span className="when">
                  <RepeatGlyph />
                  {schedule}
                </span>
              )}
              {chips.map((chip) => (
                <span key={chip} className="when">
                  {chip}
                </span>
              ))}
            </Meta>
          )}
        </div>
      </Swipeable>
      {task.note && (
        <Roll open={subtasksOpen}>
          <div className="unfolded">
            <div className="note">{task.note}</div>
          </div>
        </Roll>
      )}
      {comments.length > 0 && (
        <Roll open={commentsShowing}>
          <div className="unfolded">
            <CommentList comments={comments} scrollTo={firstUnseen} onAdd={onAddComment} onDelete={onDeleteComment} />
          </div>
        </Roll>
      )}
      {task.subtasks.length > 0 && (
        <Roll open={subtasksOpen}>
          <div className="unfolded">
            <div className="subtasks">
              {task.subtasks.map((subtask, index) => (
                <div key={subtask.id} data-subtask={task.id + ":" + index}>
                  <TaskRow
                    task={{ ...subtask, id: task.id + ":" + index, dueDate: null }}
                    chips={[]}
                    every={null}
                    select={select}
                    onHold={onHold}
                    focused={focused}
                    saved={saved}
                    onTick={() => (fixedOpen ? null : store.putTask(subtaskToggled({ task, index, now })))}
                    onTitle={onTitleSubtask ? () => onTitleSubtask(index) : onTitle}
                    onTitleSubtask={null}
                    todaySwipe={null}
                    onDelete={onDeleteSubtask ? () => onDeleteSubtask(index) : null}
                    onDeleteSubtask={null}
                    onAddComment={() => null}
                    onDeleteComment={() => null}
                    fixedOpen={fixedOpen}
                    unfoldSubtasks={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </Roll>
      )}
    </div>
  );
}
