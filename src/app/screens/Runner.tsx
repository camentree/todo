import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { Confirm } from "@shared/components/Confirm.tsx";
import { formatClock } from "@shared/format.ts";
import { longPress } from "@shared/longPress.ts";
import { ArrowGlyph, CrossGlyph, TickGlyph } from "@shared/ui/Glyphs.tsx";
import { Modal } from "@shared/ui/Modal.tsx";
import { RoundButton } from "@shared/ui/RoundButton.tsx";
import { TextButton } from "@shared/ui/TextButton.tsx";

import { Comments } from "../components/Comments.tsx";
import { blankEntry } from "../components/Journals.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import type { Comment } from "../models/comment.ts";
import { commentsFor } from "../models/comment.ts";
import type { JournalEntry } from "../models/journal.ts";
import { entryFrom, entryText } from "../models/journal.ts";
import type { Task } from "../models/task.ts";
import { isDone, isNumericType, subtaskDone } from "../models/task.ts";
import { useRoute } from "../route.ts";
import { JournalEditor } from "./JournalEditor.tsx";

interface QueueItem {
  taskId: string;
  subtaskIndex: number | null;
}

type Phase = "subtask" | "rest" | "taskEnd" | "end";

interface RunnerState {
  queue: QueueItem[];
  index: number;
  phase: Phase;
  running: boolean;
  rest: number;
}

function buildQueue(tasks: Task[]): QueueItem[] {
  return tasks.flatMap((task): QueueItem[] =>
    task.subtasks.length ? task.subtasks.map((_, subtaskIndex) => ({ taskId: task.id, subtaskIndex })) : [{ taskId: task.id, subtaskIndex: null }],
  );
}

function stepOf({ item, tasks }: { item: QueueItem; tasks: Task[] }): { task: Task; subtask: Task } | null {
  const task = tasks.find((each) => each.id === item.taskId);
  if (!task) return null;
  const subtask = item.subtaskIndex === null ? task : task.subtasks[item.subtaskIndex];
  return subtask ? { task, subtask } : null;
}

function startRunner({ tasks, from }: { tasks: Task[]; from: string }): RunnerState {
  const queue = buildQueue(tasks);
  const start = Math.max(0, queue.findIndex((item) => item.taskId === from));
  const firstOpen = queue.findIndex((item, index) => {
    const step = stepOf({ item, tasks });
    return index >= start && step ? !subtaskDone(step.subtask) : false;
  });
  if (firstOpen === -1) return { queue, index: queue.length ? start : 0, phase: queue.length ? "taskEnd" : "end", running: false, rest: 0 };
  return { queue, index: firstOpen, phase: "subtask", running: false, rest: 0 };
}

function currentItem(state: RunnerState): QueueItem | null {
  return state.phase === "end" ? null : (state.queue[state.index] ?? null);
}

function afterFinish({ state, tasks }: { state: RunnerState; tasks: Task[] }): RunnerState {
  const item = state.queue[state.index];
  const next = state.queue[state.index + 1];
  if (!item) return { ...state, phase: "end", running: false };
  if (!next || next.taskId !== item.taskId) return { ...state, phase: "taskEnd", running: false, rest: 0 };
  const task = tasks.find((each) => each.id === item.taskId);
  const rest = task?.restSeconds ?? 0;
  if (rest > 0) return { ...state, phase: "rest", rest, running: true };
  return advance(state);
}

function advance(state: RunnerState): RunnerState {
  const index = state.index + 1;
  if (index >= state.queue.length) return { ...state, index: state.queue.length - 1, phase: "end", running: false, rest: 0 };
  return { ...state, index, phase: "subtask", running: false, rest: 0 };
}

function goBack(state: RunnerState): RunnerState {
  if (state.phase === "end" || state.phase === "rest" || state.phase === "taskEnd") return { ...state, phase: "subtask", running: false, rest: 0 };
  return { ...state, index: Math.max(0, state.index - 1), phase: "subtask", running: false, rest: 0 };
}

function jumpTo({ state, index }: { state: RunnerState; index: number }): RunnerState {
  return { ...state, index, phase: "subtask", running: false, rest: 0 };
}

const ringSize = 300;
const ringRadius = ringSize / 2 - 1.5;
const ringLength = 2 * Math.PI * ringRadius;

function Queue({ direction, items }: { direction: "across" | "down"; items: { key: string; label: string; current: boolean; done: boolean; onSelect: () => void }[] }) {
  const host = useRef<HTMLDivElement>(null);
  const currentKey = items.find((item) => item.current)?.key;
  useEffect(() => {
    const element = host.current?.querySelector<HTMLElement>(".current");
    element?.scrollIntoView(direction === "across" ? { block: "nearest", inline: "center", behavior: "smooth" } : { block: "center", inline: "nearest", behavior: "smooth" });
  }, [currentKey]);
  return (
    <div
      ref={host}
      className={
        "relative flex flex-none font-medium text-faint [scrollbar-width:none] [&::-webkit-scrollbar]:hidden " +
        (direction === "across"
          ? "gap-4 overflow-x-auto pr-12 text-title whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
          : "max-h-[6.2rem] flex-col gap-0 overflow-y-auto pt-[0.3rem] pb-[2.2rem] pl-[1.2rem] text-body [mask-image:linear-gradient(to_bottom,black_calc(100%-1.4rem),transparent)]")
      }
    >
      {items.map((item) => (
        <TextButton
          key={item.key}
          className={
            "flex items-center " +
            (direction === "down" ? "min-h-[1.9rem] py-[0.15rem] " : "min-h-[2.4rem] py-[0.3rem] ") +
            (item.current ? "current text-accent" : "text-faint hover:text-dim")
          }
          onSelect={item.onSelect}
        >
          <span className={item.done ? "line-through " + (item.current ? "text-accent" : "text-dim") : ""}>{item.label}</span>
        </TextButton>
      ))}
    </div>
  );
}

function Ring({ fraction, onTap, onHold, children }: { fraction: number; onTap: (() => void) | null; onHold: (() => void) | null; children: ReactNode }) {
  const press = onHold ? longPress(onHold) : null;
  return (
    <div className="relative flex size-ring flex-none items-center justify-center rounded-full border-[3px] border-raised select-none" onClick={onTap ?? undefined} {...press}>
      <svg className="pointer-events-none absolute -inset-[3px] -rotate-90" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
        <circle className="transition-[stroke-dashoffset] duration-300 ease-linear" cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - Math.max(0, Math.min(1, fraction)))} />
      </svg>
      <div className="relative flex max-w-[200px] flex-col items-center justify-center gap-[0.2rem] text-center">{children}</div>
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
      className="relative mt-[0.8rem] h-12 w-[190px] touch-none overflow-hidden rounded-[24px] bg-raised"
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
      <span className={"absolute inset-y-0 left-0 bg-chip " + (dragging ? "" : "transition-[width] duration-200 ease-[ease]")} style={{ width: `calc(${shown * 100}% )` }} />
      <span className={"absolute top-0 flex size-12 items-center justify-center rounded-full bg-accent text-ground " + (dragging ? "" : "transition-[left] duration-200 ease-[ease]")} style={{ left: `calc(${shown} * (100% - 48px))` }}>
        <TickGlyph size={18} />
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-[30px] text-meta text-dim">{done ? "done" : "slide to complete"}</span>
    </div>
  );
}

function withStep({ task, item, change }: { task: Task; item: QueueItem; change: (subtask: Task) => Partial<Task> }): Task {
  if (item.subtaskIndex === null) return { ...task, ...change(task) };
  const subtasks = task.subtasks.map((subtask, index) => (index === item.subtaskIndex ? { ...subtask, ...change(subtask) } : subtask));
  return { ...task, subtasks, finalizedAt: subtasks.every(subtaskDone) ? (task.finalizedAt ?? nowStamp()) : null };
}

export function Runner({ taskIds, onClose }: { taskIds: string[]; onClose: () => void }) {
  const store = useStore();
  const { route, replace } = useRoute();
  const tasksInOrder = taskIds.map((id) => store.tasks.find((task) => task.id === id)).filter((task): task is Task => task !== undefined);
  const [state, setState] = useState<RunnerState>(() => startRunner({ tasks: tasksInOrder, from: route.id ?? "" }));
  const [elapsed, setElapsed] = useState(0);
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

  useEffect(() => {
    if (task && route.id !== task.id) replace({ ...route, id: task.id });
  }, [task?.id]);
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
  const commentBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commentBox.current?.scrollTo({ top: commentBox.current.scrollHeight });
  }, [task?.id, comments.length]);

  const ringContent = (): { fraction: number; onTap: (() => void) | null; onHold: (() => void) | null; inside: ReactNode } => {
    if (state.phase === "end") return { fraction: 1, onTap: null, onHold: null, inside: <div className="max-w-[190px] pt-[0.4rem] text-title leading-[1.2] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">done</div> };
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
            <div className="text-big leading-none tracking-[-0.03em] tabular-nums">{formatClock(state.rest)}</div>
            <div className="text-meta text-dim">rest</div>
            <div className="max-w-[190px] pt-[0.4rem] text-title leading-[1.2] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{nextStep?.subtask.title}</div>
            <TextButton className="min-h-touch px-4 py-2 text-meta text-dim hover:text-text" onSelect={() => move(advance(state))}>
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
            <div className="text-big leading-none tracking-[-0.03em] tabular-nums">{formatClock(remaining)}</div>
            <div className="text-meta text-dim">{subtaskIsDone ? "done" : state.running ? "tap to pause" : elapsed > 0 ? "paused" : "tap to start"}</div>
            <div className="max-w-[190px] pt-[0.4rem] text-title leading-[1.2] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{subtask.title}</div>
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
            <div className="text-big leading-none tracking-[-0.03em] tabular-nums">{current}</div>
            <div className="text-meta text-dim">of {target}</div>
            <div className="max-w-[190px] pt-[0.4rem] text-title leading-[1.2] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{subtask.title}</div>
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
          <div className="max-w-[190px] pt-[0.4rem] text-title leading-[1.2] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{subtask.title}</div>
          {journalTask && !subtaskIsDone ? (
            <TextButton className="min-h-touch px-4 py-2 text-body font-medium text-accent" onSelect={() => setWriting(blankEntry({ tag: null }))}>
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
    <Modal className="bg-ground">
      <div className="page mx-auto flex min-h-0 w-full max-w-column flex-1 flex-col px-gutter pb-0">
        <div className="flex items-center justify-between pt-top pb-[0.2rem]">
          <span className="text-heading font-bold tracking-[-0.02em]">
            {(task ?? tasksInOrder[0])?.group}
            {tasksInOrder.length > 1 && task && <span className="ml-[0.6rem] text-meta font-normal tracking-normal text-dim">{tasksInOrder.indexOf(task) + 1} of {tasksInOrder.length}</span>}
          </span>
          <RoundButton className="size-round-small bg-raised text-dim hover:text-text" label="close" onSelect={exit}>
            <CrossGlyph />
          </RoundButton>
        </div>
        {acrossItems.length > 1 && <Queue direction="across" items={acrossItems} />}
        {downItems.length > 0 && <Queue direction="down" items={downItems} />}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-[0.6rem] overflow-hidden pt-[2.4rem]">
          <Ring fraction={ring.fraction} onTap={ring.onTap} onHold={ring.onHold}>
            {ring.inside}
          </Ring>
          {task && state.phase !== "rest" && (
            <div
              ref={commentBox}
              className="flex min-h-0 w-full max-w-[320px] flex-1 flex-col items-center justify-start gap-[0.2rem] overflow-y-auto pt-[0.6rem] [scrollbar-width:none] [&_.card]:w-full [&_.card]:flex-none [&_.comment-list]:w-full [&_.comment-list]:flex-none [&_.thread]:max-h-none [&_.thread]:overflow-visible"
            >
              <Comments
                comments={comments}
                scrollTo={null}
                onAdd={(body) =>
                  store.putComment({ id: identifier(), taskId: task.id, body, author: "user", writtenAt: nowStamp(), seenAt: nowStamp(), createdAt: nowStamp() })
                }
                onDelete={setDeleting}
              />
            </div>
          )}
        </div>
        <div className="flex flex-none items-center justify-between pt-[0.6rem] pb-bottom">
          {state.phase !== "end" && (
            <RoundButton className="bg-raised text-dim" label="previous" onSelect={() => move(goBack(state))}>
              <ArrowGlyph direction="previous" />
            </RoundButton>
          )}
          <RoundButton className={state.phase === "end" ? "mx-auto" : ""} label="done" onSelect={onDone}>
            <TickGlyph size={22} />
          </RoundButton>
          {state.phase !== "end" && (
            <RoundButton className="bg-raised text-dim" label="next" onSelect={() => move(advance(state))}>
              <ArrowGlyph direction="next" />
            </RoundButton>
          )}
        </div>
      </div>
      {writing && task && (
        <JournalEditor
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
    </Modal>
  );
}
