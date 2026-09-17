import { useEffect, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

import type { Comment, Task } from "@shared/model.ts";
import { everyLabel } from "@shared/grammar.ts";
import { partAsTask } from "@shared/move.ts";
import { isDone, isSkipped, kindHint, partCount, partToggled, whenHint } from "@shared/tasks.ts";

import { nowStamp, useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";
import { CircleTick } from "./CircleTick.tsx";
import { CommentList } from "./CommentList.tsx";
import { Mark } from "./Mark.tsx";
import { ChevronGlyph, PartsGlyph, RepeatGlyph, SpeechGlyph } from "./Glyphs.tsx";
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

export function showing({ folds, task, comments }: { folds: Folds; task: Task; comments: Comment[] }) {
  const newest = comments[0] ?? null;
  const agentUnseen = newest !== null && newest.author === "agent" && newest.seenAt === null;
  const hasParts = task.parts.length > 0 || task.note !== "";
  const partsShowing = hasParts && folds.isOpen({ key: partsKey(task.id), fallback: false });
  const commentsShowing = comments.length > 0 && folds.isOpen({ key: commentsKey(task.id), fallback: false });
  return { agentUnseen, hasParts, partsShowing, commentsShowing, open: partsShowing || commentsShowing };
}

export function toggleParts({ folds, task, comments }: { folds: Folds; task: Task; comments: Comment[] }) {
  const { agentUnseen, hasParts, partsShowing } = showing({ folds, task, comments });
  if (!hasParts) return toggleComments({ folds, task, comments });
  folds.set({ key: partsKey(task.id), open: !partsShowing });
  if (!partsShowing && agentUnseen) folds.set({ key: commentsKey(task.id), open: true });
}

export function toggleComments({ folds, task, comments }: { folds: Folds; task: Task; comments: Comment[] }) {
  const { commentsShowing } = showing({ folds, task, comments });
  if (comments.length > 0) folds.set({ key: commentsKey(task.id), open: !commentsShowing });
}

export function closeTask({ folds, task }: { folds: Folds; task: Task }) {
  folds.set({ key: partsKey(task.id), open: false });
  folds.set({ key: commentsKey(task.id), open: false });
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
  chips,
  every,
  select,
  onHold,
  focused,
  onTick,
  onTitle,
  todaySwipe,
  onDelete,
  onDeletePart,
  onAddComment,
  onDeleteComment,
  fixedOpen,
  unfoldParts,
}: {
  task: Task;
  comments: Comment[];
  chips: string[];
  every: string | null;
  select: Select | null;
  onHold: ((id: string) => void) | null;
  focused: string | null;
  onTick: () => void;
  onTitle: () => void;
  todaySwipe: Swipe | null;
  onDelete: (() => void) | null;
  onDeletePart: ((index: number) => void) | null;
  onAddComment: (body: string) => void;
  onDeleteComment: (comment: Comment) => void;
  fixedOpen: boolean;
  unfoldParts: boolean;
}) {
  const store = useStore();
  const folds = useFolds();
  const [firstUnseen, setFirstUnseen] = useState<string | null>(null);
  const done = isDone({ task, entries: store.journal });
  const skipped = !done && isSkipped(task);
  const unseen = comments.some((comment) => comment.seenAt === null);
  const { agentUnseen, hasParts, open, partsShowing, commentsShowing } = showing({ folds, task, comments });
  const partsOpen = fixedOpen || unfoldParts || partsShowing;
  const now = nowStamp();
  const press = onHold ? longPress(() => onHold(task.id)) : null;

  useEffect(() => {
    if (!commentsShowing) return;
    const ordered = [...comments].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    setFirstUnseen(ordered.find((comment) => comment.seenAt === null)?.id ?? null);
    if (!unseen) return;
    for (const comment of comments) if (comment.seenAt === null) store.putComment({ ...comment, seenAt: now });
    if (task.date === null) store.putTask({ ...task, date: store.today });
  }, [commentsShowing]);

  const onChevron = () => (open ? closeTask({ folds, task }) : toggleParts({ folds, task, comments }));

  const onCommentGlyph = () => toggleComments({ folds, task, comments });

  const onRow = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (select) return select.onToggle(task.id);
    onTitle();
  };

  const onPartsGlyph = () => toggleParts({ folds, task, comments });

  const when = whenHint({ task, today: store.today });
  const schedule = everyLabel(every);
  const hint = kindHint(task);

  return (
    <div className={done ? "task done" : skipped ? "task skipped" : "task"}>
      <Swipeable right={select ? null : todaySwipe} left={select || !onDelete ? null : { word: "delete", onSwipe: onDelete }}>
        <div className={focused === task.id ? "row focused" : "row"} data-focus={task.id} onClick={onRow} {...press}>
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
              {task.name}
              {hint && <span className="hint">{hint}</span>}
            </span>
            <div className="marks">
              {comments.length > 0 && (
                <Mark label="comments" active={commentsShowing} onSelect={onCommentGlyph}>
                  <SpeechGlyph />
                  {agentUnseen && <span className="unseen" />}
                </Mark>
              )}
              {hasParts && (
                <Mark label="parts" count={partCount(task)} active={partsShowing} onSelect={open ? onPartsGlyph : null}>
                  <PartsGlyph />
                </Mark>
              )}
              {(hasParts || comments.length > 0) && !fixedOpen && (
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
      {comments.length > 0 && (
        <Roll open={commentsShowing}>
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
                      chips={[]}
                      every={null}
                      select={select}
                      onHold={onHold}
                      focused={focused}
                      onTick={() => (fixedOpen ? null : store.putTask(partToggled({ task, index, now })))}
                      onTitle={onTitle}
                      todaySwipe={null}
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
