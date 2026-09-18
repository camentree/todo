import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { formatClock, formatWhen } from "@shared/format.ts";
import { entryFrom, entryText } from "@shared/journal.ts";
import type { Comment, JournalEntry, Task } from "@shared/model.ts";
import { isNumericType } from "@shared/model.ts";
import { advance, afterFinish, currentItem, goBack, jumpTo, startRunner, stepOf } from "@shared/runner.ts";
import type { QueueItem, RunnerState } from "@shared/runner.ts";
import { commentsFor, isDone, subtaskDone } from "@shared/tasks.ts";

import { Card } from "../components/Card.tsx";
import { CommentList } from "../components/CommentList.tsx";
import { Confirm } from "../components/Confirm.tsx";
import { EditorScreen } from "../components/EditorScreen.tsx";
import { blankEntry } from "../components/Entries.tsx";
import { ArrowGlyph, CrossGlyph, TickGlyph } from "../components/Glyphs.tsx";
import { Overlay } from "../components/Overlay.tsx";
import { RoundButton } from "../components/RoundButton.tsx";
import { TextButton } from "../components/TextButton.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";

const ringSize = 250;
const ringRadius = ringSize / 2 - 1.5;
const ringLength = 2 * Math.PI * ringRadius;

function Queue({ direction, items }: { direction: "across" | "down"; items: { key: string; label: string; current: boolean; done: boolean; onSelect: () => void }[] }) {
  const host = useRef<HTMLDivElement>(null);
  const currentKey = items.find((item) => item.current)?.key;
  useEffect(() => {
    const element = host.current?.querySelector<HTMLElement>(".text.active");
    element?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentKey]);
  return (
    <div ref={host} className={direction === "across" ? "queue across" : "queue down"}>
      {items.map((item) => (
        <TextButton key={item.key} active={item.current} onSelect={item.onSelect}>
          <span className={item.done ? "done" : ""}>{item.label}</span>
        </TextButton>
      ))}
    </div>
  );
}

function Ring({ fraction, onTap, onHold, children }: { fraction: number; onTap: (() => void) | null; onHold: (() => void) | null; children: ReactNode }) {
  const press = onHold ? longPress(onHold) : null;
  return (
    <div className="ring" onClick={onTap ?? undefined} {...press}>
      <svg className="arc" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
        <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - Math.max(0, Math.min(1, fraction)))} />
      </svg>
      <div className="ring-inside">{children}</div>
    </div>
  );
}

function Slide({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const place = (event: PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (event.clientX - rect.left - 24) / (rect.width - 48)));
  };
  const shown = done ? 1 : position;
  return (
    <div
      ref={track}
      className={dragging ? "slide dragging" : "slide"}
      onPointerDown={(event) => {
        if (done) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        setPosition(place(event));
      }}
      onPointerMove={(event) => dragging && setPosition(place(event))}
      onPointerUp={(event) => {
        if (!dragging) return;
        setDragging(false);
        if (place(event) >= 0.85) onComplete();
        setPosition(0);
      }}
      onPointerCancel={() => {
        setDragging(false);
        setPosition(0);
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="slide-fill" style={{ width: `calc(${shown * 100}% )` }} />
      <span className="slide-knob" style={{ left: `calc(${shown} * (100% - 48px))` }}>
        <TickGlyph size={18} />
      </span>
      <span className="slide-label">{done ? "done" : "slide to complete"}</span>
    </div>
  );
}

function withStep({ task, item, change }: { task: Task; item: QueueItem; change: (subtask: Task) => Partial<Task> }): Task {
  if (item.subtaskIndex === null) return { ...task, ...change(task) };
  const subtasks = task.subtasks.map((subtask, index) => (index === item.subtaskIndex ? { ...subtask, ...change(subtask) } : subtask));
  return { ...task, subtasks, finalizedAt: subtasks.every(subtaskDone) ? (task.finalizedAt ?? nowStamp()) : null };
}

export function Runner({ taskIds, label, onClose }: { taskIds: string[]; label: string; onClose: () => void }) {
  const store = useStore();
  const tasksInOrder = taskIds.map((id) => store.tasks.find((task) => task.id === id)).filter((task): task is Task => task !== undefined);
  const [state, setState] = useState<RunnerState>(() => startRunner({ tasks: tasksInOrder, label }));
  const [elapsed, setElapsed] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [writing, setWriting] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const latest = useRef({ state, tasks: tasksInOrder, elapsed });
  latest.current = { state, tasks: tasksInOrder, elapsed };

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((sentinel) => (lock = sentinel))
      .catch(() => null);
    return () => {
      lock?.release().catch(() => null);
    };
  }, []);

  const item = currentItem(state);
  const step = item ? stepOf({ item, tasks: tasksInOrder }) : null;
  const task = step?.task ?? null;
  const subtask = step?.subtask ?? null;
  const subtaskIsDone = subtask && task ? (subtask === task ? isDone({ task, entries: store.journal }) : subtaskDone(subtask)) : false;
  const uniqueTaskIds = [...new Set(state.queue.map((each) => each.taskId))];
  const groupRun = uniqueTaskIds.length > 1;

  const write = (change: (subtask: Task) => Partial<Task>) => {
    const current = latest.current;
    const currentItemNow = currentItem(current.state);
    const currentTask = currentItemNow ? current.tasks.find((each) => each.id === currentItemNow.taskId) : undefined;
    if (!currentItemNow || !currentTask) return;
    store.putTask(withStep({ task: currentTask, item: currentItemNow, change }));
  };

  const move = (next: RunnerState) => {
    setElapsed(0);
    setCommentsOpen(false);
    setState(next);
  };

  const finish = () => {
    const current = latest.current;
    const now = nowStamp();
    write((each) => ({ finalizedAt: now, numericalValue: isNumericType(each.type) ? each.target : each.numericalValue }));
    move(afterFinish({ state: current.state, tasks: current.tasks }));
  };

  const pauseTimer = () => {
    const current = latest.current;
    if (current.elapsed > 0) write(() => ({ numericalValue: current.elapsed }));
    setState({ ...current.state, running: false });
  };

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => {
      const current = latest.current;
      if (current.state.phase === "rest") {
        if (current.state.rest <= 1) move(advance(current.state));
        else setState({ ...current.state, rest: current.state.rest - 1 });
        return;
      }
      const runningItem = currentItem(current.state);
      const runningStep = runningItem ? stepOf({ item: runningItem, tasks: current.tasks }) : null;
      if (!runningStep || runningStep.subtask.type !== "timer_seconds") return;
      const next = current.elapsed + 1;
      if (next >= (runningStep.subtask.target ?? 0)) {
        setElapsed(next);
        finish();
      } else setElapsed(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.running]);

  useEffect(() => {
    if (subtask && subtask.type === "timer_seconds") {
      setElapsed(Math.min(subtask.numericalValue ?? 0, subtask.target ?? 0));
    }
  }, [state.index, state.phase]);

  const exit = () => {
    if (state.running && subtask?.type === "timer_seconds" && elapsed > 0) write(() => ({ numericalValue: elapsed }));
    onClose();
  };

  const comments = task ? commentsFor(task) : [];
  const newest = comments[0];
  const commentBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (commentsOpen) commentBox.current?.scrollTo({ top: commentBox.current.scrollHeight });
  }, [commentsOpen, comments.length]);

  const ringContent = (): { fraction: number; onTap: (() => void) | null; onHold: (() => void) | null; inside: ReactNode } => {
    if (state.phase === "end") return { fraction: 1, onTap: null, onHold: null, inside: <div className="ring-subtask">done</div> };
    if (state.phase === "rest") {
      const nextItem = state.queue[state.index + 1];
      const nextStep = nextItem ? stepOf({ item: nextItem, tasks: tasksInOrder }) : null;
      const total = task?.restSeconds ?? 1;
      return {
        fraction: state.rest / (total || 1),
        onTap: null,
        onHold: null,
        inside: (
          <>
            <div className="ring-big">{formatClock(state.rest)}</div>
            <div className="ring-hint">rest</div>
            <div className="ring-subtask">{nextStep?.subtask.title}</div>
            <TextButton active={false} onSelect={() => move(advance(state))}>
              skip
            </TextButton>
          </>
        ),
      };
    }
    if (!subtask) return { fraction: 0, onTap: null, onHold: null, inside: null };
    if (subtask.type === "timer_seconds") {
      const duration = subtask.target ?? 0;
      const remaining = Math.max(0, duration - elapsed);
      return {
        fraction: duration ? remaining / duration : 0,
        onTap: subtaskIsDone ? null : () => (state.running ? pauseTimer() : setState({ ...state, running: true })),
        onHold: null,
        inside: (
          <>
            <div className="ring-big">{formatClock(remaining)}</div>
            <div className="ring-hint">{subtaskIsDone ? "done" : state.running ? "tap to pause" : elapsed > 0 ? "paused" : "tap to start"}</div>
            <div className="ring-subtask">{subtask.title}</div>
          </>
        ),
      };
    }
    if (subtask.type === "count" || subtask.type === "amount") {
      const target = subtask.target ?? 0;
      const current = subtask.numericalValue ?? 0;
      return {
        fraction: target ? current / target : 0,
        onTap: () => {
          const next = current + 1;
          if (next >= target) finish();
          else write(() => ({ numericalValue: next }));
        },
        onHold: () => write((each) => ({ numericalValue: Math.max(0, (each.numericalValue ?? 0) - 1), finalizedAt: null })),
        inside: (
          <>
            <div className="ring-big">{current}</div>
            <div className="ring-hint">of {target}</div>
            <div className="ring-subtask">{subtask.title}</div>
          </>
        ),
      };
    }
    const journalTask = subtask === task && task.type === "boolean" && task.title.toLowerCase() === "journal";
    return {
      fraction: subtaskIsDone ? 1 : 0,
      onTap: null,
      onHold: null,
      inside: (
        <>
          <div className="ring-subtask">{subtask.title}</div>
          {journalTask && !subtaskIsDone ? (
            <TextButton active onSelect={() => setWriting(blankEntry({ tag: null }))}>
              write
            </TextButton>
          ) : (
            <Slide done={subtaskIsDone} onComplete={finish} />
          )}
        </>
      ),
    };
  };

  const ring = ringContent();

  const acrossItems = groupRun
    ? uniqueTaskIds.map((id) => {
        const each = tasksInOrder.find((candidate) => candidate.id === id);
        const first = state.queue.findIndex((queued) => queued.taskId === id);
        const firstOpen = state.queue.findIndex((queued) => {
          const candidate = stepOf({ item: queued, tasks: tasksInOrder });
          return queued.taskId === id && candidate !== null && !subtaskDone(candidate.subtask);
        });
        return {
          key: id,
          label: each?.title ?? "",
          current: item?.taskId === id,
          done: each ? each.subtasks.length > 0 ? each.subtasks.every(subtaskDone) : subtaskDone(each) : false,
          onSelect: () => move(jumpTo({ state, index: firstOpen === -1 ? first : firstOpen })),
        };
      })
    : state.queue.map((queued, index) => {
        const each = stepOf({ item: queued, tasks: tasksInOrder });
        return { key: String(index), label: each?.subtask.title ?? "", current: state.phase !== "end" && index === state.index, done: each ? subtaskDone(each.subtask) : false, onSelect: () => move(jumpTo({ state, index })) };
      });

  const downItems =
    groupRun && task && task.subtasks.length > 0
      ? task.subtasks.map((each, subtaskIndex) => ({
          key: String(subtaskIndex),
          label: each.title,
          current: item?.subtaskIndex === subtaskIndex && state.phase !== "end",
          done: subtaskDone(each),
          onSelect: () => move(jumpTo({ state, index: state.queue.findIndex((queued) => queued.taskId === task.id && queued.subtaskIndex === subtaskIndex) })),
        }))
      : [];

  const onDone = () => {
    if (state.phase === "end") onClose();
    else if (state.phase === "rest" || state.phase === "taskEnd") move(advance(state));
    else finish();
  };

  return (
    <Overlay>
      <div className="page runner">
        <div className="screen-head">
          <span className="heading">{label}</span>
          <RoundButton label="close" onSelect={exit}>
            <CrossGlyph />
          </RoundButton>
        </div>
        {acrossItems.length > 1 && <Queue direction="across" items={acrossItems} />}
        {downItems.length > 0 && <Queue direction="down" items={downItems} />}
        <div className="runner-middle">
          <Ring fraction={ring.fraction} onTap={ring.onTap} onHold={ring.onHold}>
            {ring.inside}
          </Ring>
          {task && state.phase !== "rest" && (
            <div ref={commentBox} className={commentsOpen ? "runner-comments open" : "runner-comments"}>
              {commentsOpen ? (
                <CommentList
                  comments={comments}
                  scrollTo={null}
                  onAdd={(body) =>
                    store.putComment({ id: identifier(), taskId: task.id, body, author: "user", writtenAt: nowStamp(), seenAt: nowStamp(), createdAt: nowStamp() })
                  }
                  onDelete={setDeleting}
                />
              ) : newest ? (
                <>
                  <Card body={newest.body} author={newest.author} when={formatWhen(newest.writtenAt)} />
                  <TextButton active={false} onSelect={() => setCommentsOpen(true)}>
                    {comments.length > 1 ? `▾ ${comments.length - 1} more` : "▾ add a comment"}
                  </TextButton>
                </>
              ) : (
                <TextButton active onSelect={() => setCommentsOpen(true)}>
                  add a comment
                </TextButton>
              )}
            </div>
          )}
        </div>
        <div className="nav">
          {state.phase !== "end" && (
            <RoundButton label="previous" onSelect={() => move(goBack(state))}>
              <ArrowGlyph direction="previous" />
            </RoundButton>
          )}
          <RoundButton label="done" onSelect={onDone}>
            <TickGlyph size={22} />
          </RoundButton>
          {state.phase !== "end" && (
            <RoundButton label="next" onSelect={() => move(advance(state))}>
              <ArrowGlyph direction="next" />
            </RoundButton>
          )}
        </div>
      </div>
      {writing && task && (
        <EditorScreen
          heading="Journal"
          subheading={task.title}
          initial={entryText(writing)}
          onCancel={() => setWriting(null)}
          onSave={(text) => {
            store.putEntry({ name: "journal", entry: entryFrom({ entry: writing, text }) });
            setWriting(null);
            move(afterFinish({ state, tasks: tasksInOrder }));
          }}
        />
      )}
      {deleting && (
        <Confirm
          question="delete this comment?"
          choices={[{ label: "delete", onChoose: () => { store.deleteComment(deleting.id); setDeleting(null); } }]}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Overlay>
  );
}
