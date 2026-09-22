import { useEffect, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";

import { longPress } from "@shared/longPress.ts";
import { CircleTick } from "@shared/ui/CircleTick.tsx";
import { Roll, useFolds } from "@shared/ui/Foldable.tsx";
import type { Folds } from "@shared/ui/Foldable.tsx";
import { ChevronGlyph, RepeatGlyph, SpeechGlyph, ListGlyph } from "@shared/ui/Glyphs.tsx";
import { Handle } from "@shared/ui/Handle.tsx";
import { SquareTick } from "@shared/ui/SquareTick.tsx";
import { Swipeable } from "@shared/ui/Swipeable.tsx";
import type { Swipe } from "@shared/ui/Swipeable.tsx";

import { nowStamp, useStore } from "../data/store.tsx";
import type { Comment } from "../models/comment.ts";
import { commentsFor } from "../models/comment.ts";
import { everyLabel } from "../models/schedule.ts";
import type { Task } from "../models/task.ts";
import { isDone, isSkipped, kindHint, subtaskCount, subtaskToggled, whenHint } from "../models/task.ts";
import { Comments } from "./Comments.tsx";

function Mark({ label, count, active, onSelect, children }: { label: string; count?: string; active: boolean; onSelect: (() => void) | null; children: ReactNode }) {
  return (
    <button
      className={
        "relative my-[-0.75rem] inline-flex items-center gap-1 px-[0.3rem] py-[0.85rem] text-meta [&_svg]:size-glyph " +
        (active ? "text-accent" : "text-dim enabled:hover:text-text")
      }
      aria-label={label}
      disabled={onSelect === null}
      onClick={onSelect ?? undefined}
    >
      {count}
      {children}
    </button>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <div className="meta flex min-h-[1.2rem] flex-wrap items-center gap-[var(--meta-gap)] pl-indent text-meta text-dim wide:contents">{children}</div>;
}

export interface Select {
  selected: (id: string) => boolean;
  onToggle: ({ id, extend }: { id: string; extend: boolean }) => void;
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
    if (select) return select.onToggle({ id: task.id, extend: event.shiftKey });
    onTitle();
  };

  const onListGlyph = () => toggleSubtasks({ folds, task });

  const when = whenHint({ task, today: store.today });
  const schedule = everyLabel(every);
  const hint = kindHint(task);

  return (
    <div className="task flex flex-col">
      <Swipeable right={select ? null : todaySwipe} left={select || !onDelete ? null : { word: "delete", onSwipe: onDelete }}>
        <div
          className={
            "row flex cursor-pointer flex-col gap-[var(--row-gap)] rounded-lg [padding:var(--row-padding)] transition-[background] duration-[450ms] ease-[ease] wide:flex-row wide:items-center wide:gap-[var(--tick-gap)] wide:px-[0.9rem]" +
            (focused === task.id ? " focused" : "") +
            (saved === task.id ? " saved" : "")
          }
          data-focus={task.id}
          onClick={onRow}
          {...press}
        >
          <div className="main flex items-center gap-[var(--tick-gap)] wide:contents">
            {select ? (
              <>
                <Handle onPointerDown={(event) => select.onHandle({ event, id: task.id })} />
                <SquareTick on={select.selected(task.id)} onToggle={(event) => select.onToggle({ id: task.id, extend: event.shiftKey })} />
              </>
            ) : (
              <CircleTick done={done} skipped={skipped} onToggle={onTick} />
            )}
            <span className={"text my-[-0.35rem] min-w-0 py-[0.65rem] text-title leading-[1.35] " + (done ? "text-dim line-through" : skipped ? "text-dim" : "text-text")}>
              {task.title}
              {hint && <span className="ml-[0.6rem] inline-flex flex-none items-center gap-[0.3rem] text-meta whitespace-nowrap text-dim">{hint}</span>}
            </span>
            <div className="ml-auto flex flex-none items-center justify-end wide:order-1">
              {comments.length > 0 && (
                <Mark label="comments" active={commentsShowing} onSelect={onCommentGlyph}>
                  <SpeechGlyph />
                  {agentUnseen && <span className="absolute top-[calc(50%-8px)] right-[0.15rem] size-[5px] rounded-full bg-warn" />}
                </Mark>
              )}
              {hasSubtasks && (
                <Mark label="subtasks" count={subtaskCount(task)} active={subtasksShowing} onSelect={open ? onListGlyph : null}>
                  <ListGlyph />
                </Mark>
              )}
              {(hasSubtasks || comments.length > 0) && !fixedOpen && (
                <button
                  className="flex h-11 w-8 flex-none items-center justify-center text-faint [margin:-0.725rem_-0.7rem_-0.725rem_0] hover:text-dim [&_svg]:size-glyph wide:[&_svg]:size-[0.875rem]"
                  aria-label={open ? "fold" : "unfold"}
                  onClick={onChevron}
                >
                  <ChevronGlyph open={open} />
                </button>
              )}
            </div>
          </div>
          {(when || schedule || chips.length > 0) && (
            <Meta>
              {when && <span className="inline-flex flex-none items-center gap-[0.3rem] text-meta text-dim">{when}</span>}
              {schedule && (
                <span className="inline-flex flex-none items-center gap-[0.3rem] text-meta text-dim">
                  <RepeatGlyph />
                  {schedule}
                </span>
              )}
              {chips.map((chip) => (
                <span key={chip} className="inline-flex flex-none items-center gap-[0.3rem] text-meta text-dim">
                  {chip}
                </span>
              ))}
            </Meta>
          )}
        </div>
      </Swipeable>
      {task.note && (
        <Roll open={subtasksOpen}>
          <div className="unfolded flex flex-col pl-indent">
            <div className="px-1 pt-[0.35rem] pb-[0.1rem] text-body leading-[1.4] whitespace-pre-wrap text-dim wide:text-meta">{task.note}</div>
          </div>
        </Roll>
      )}
      {comments.length > 0 && (
        <Roll open={commentsShowing}>
          <div className="unfolded flex flex-col pl-indent">
            <Comments comments={comments} scrollTo={firstUnseen} onAdd={onAddComment} onDelete={onDeleteComment} />
          </div>
        </Roll>
      )}
      {task.subtasks.length > 0 && (
        <Roll open={subtasksOpen}>
          <div className="unfolded flex flex-col pl-indent">
            <div className="subtasks flex flex-col pt-[0.3rem] pb-[0.2rem]">
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
