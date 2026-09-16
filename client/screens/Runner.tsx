import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { formatClock, formatWhen } from "@shared/format.ts";
import type { Comment, Task, TaskPart } from "@shared/model.ts";
import { advance, afterFinish, currentItem, goBack, jumpTo, startRunner, stepOf } from "@shared/runner.ts";
import type { QueueItem, RunnerState } from "@shared/runner.ts";
import { commentsFor, isDone, partDone } from "@shared/tasks.ts";

import { Card } from "../components/Card.tsx";
import { CommentList } from "../components/CommentList.tsx";
import { Confirm } from "../components/Confirm.tsx";
import { EditorScreen } from "../components/EditorScreen.tsx";
import { splitTags } from "../components/Entries.tsx";
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

function withStep({ task, item, change }: { task: Task; item: QueueItem; change: (part: TaskPart | Task) => Partial<TaskPart> }): Task {
  if (item.partIndex === null) return { ...task, ...change(task) };
  const parts = task.parts.map((part, index) => (index === item.partIndex ? { ...part, ...change(part) } : part));
  return { ...task, parts, doneAt: parts.every(partDone) ? (task.doneAt ?? nowStamp()) : null };
}

export function Runner({ taskIds, label, onClose }: { taskIds: string[]; label: string; onClose: () => void }) {
  const store = useStore();
  const tasksInOrder = taskIds.map((id) => store.tasks.find((task) => task.id === id)).filter((task): task is Task => task !== undefined);
  const [state, setState] = useState<RunnerState>(() => startRunner({ tasks: tasksInOrder, label }));
  const [elapsed, setElapsed] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [writing, setWriting] = useState(false);
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
  const part = step?.part ?? null;
  const partIsDone = part && task ? (part === task ? isDone({ task, entries: store.journal }) : partDone(part)) : false;
  const uniqueTaskIds = [...new Set(state.queue.map((each) => each.taskId))];
  const groupRun = uniqueTaskIds.length > 1;

  const write = (change: (part: TaskPart | Task) => Partial<TaskPart>) => {
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
    write((each) => ({ doneAt: now, current: each.kind === "count" ? each.target : each.kind === "timer" ? each.timer : each.current }));
    move(afterFinish({ state: current.state, tasks: current.tasks }));
  };

  const pauseTimer = () => {
    const current = latest.current;
    if (current.elapsed > 0) write(() => ({ current: current.elapsed }));
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
      if (!runningStep || runningStep.part.kind !== "timer") return;
      const next = current.elapsed + 1;
      if (next >= runningStep.part.timer) {
        setElapsed(next);
        finish();
      } else setElapsed(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.running]);

  useEffect(() => {
    if (part && part.kind === "timer") setElapsed(Math.min(part.current, part.timer));
  }, [state.index, state.phase]);

  const exit = () => {
    if (state.running && part?.kind === "timer" && elapsed > 0) write(() => ({ current: elapsed }));
    onClose();
  };

  const comments = task ? commentsFor({ task, comments: store.comments }) : [];
  const newest = comments[0];
  const commentBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (commentsOpen) commentBox.current?.scrollTo({ top: commentBox.current.scrollHeight });
  }, [commentsOpen, comments.length]);

  const ringContent = (): { fraction: number; onTap: (() => void) | null; onHold: (() => void) | null; inside: ReactNode } => {
    if (state.phase === "end") return { fraction: 1, onTap: null, onHold: null, inside: <div className="ring-part">done</div> };
    if (state.phase === "rest") {
      const nextItem = state.queue[state.index + 1];
      const nextStep = nextItem ? stepOf({ item: nextItem, tasks: tasksInOrder }) : null;
      const total = task?.rest ?? 1;
      return {
        fraction: state.rest / total,
        onTap: null,
        onHold: null,
        inside: (
          <>
            <div className="ring-big">{formatClock(state.rest)}</div>
            <div className="ring-hint">rest</div>
            <div className="ring-part">{nextStep?.part.name}</div>
            <TextButton active={false} onSelect={() => move(advance(state))}>
              skip
            </TextButton>
          </>
        ),
      };
    }
    if (!part) return { fraction: 0, onTap: null, onHold: null, inside: null };
    if (part.kind === "timer") {
      const remaining = Math.max(0, part.timer - elapsed);
      return {
        fraction: part.timer ? remaining / part.timer : 0,
        onTap: partIsDone ? null : () => (state.running ? pauseTimer() : setState({ ...state, running: true })),
        onHold: null,
        inside: (
          <>
            <div className="ring-big">{formatClock(remaining)}</div>
            <div className="ring-hint">{partIsDone ? "done" : state.running ? "tap to pause" : elapsed > 0 ? "paused" : "tap to start"}</div>
            <div className="ring-part">{part.name}</div>
          </>
        ),
      };
    }
    if (part.kind === "count") {
      return {
        fraction: part.target ? part.current / part.target : 0,
        onTap: () => {
          const next = part.current + 1;
          if (next >= part.target) finish();
          else write(() => ({ current: next }));
        },
        onHold: () => write((each) => ({ current: Math.max(0, each.current - 1), doneAt: null })),
        inside: (
          <>
            <div className="ring-big">{part.current}</div>
            <div className="ring-hint">of {part.target}</div>
            <div className="ring-part">{part.name}</div>
          </>
        ),
      };
    }
    const journalTask = part === task && task.kind === "boolean" && task.name.toLowerCase() === "journal";
    return {
      fraction: partIsDone ? 1 : 0,
      onTap: null,
      onHold: null,
      inside: (
        <>
          <div className="ring-part">{part.name}</div>
          {journalTask && !partIsDone ? (
            <TextButton active onSelect={() => setWriting(true)}>
              write
            </TextButton>
          ) : (
            <Slide done={partIsDone} onComplete={finish} />
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
          return queued.taskId === id && candidate !== null && !partDone(candidate.part);
        });
        return {
          key: id,
          label: each?.name ?? "",
          current: item?.taskId === id,
          done: each ? each.parts.length > 0 ? each.parts.every(partDone) : partDone(each) : false,
          onSelect: () => move(jumpTo({ state, index: firstOpen === -1 ? first : firstOpen })),
        };
      })
    : state.queue.map((queued, index) => {
        const each = stepOf({ item: queued, tasks: tasksInOrder });
        return { key: String(index), label: each?.part.name ?? "", current: state.phase !== "end" && index === state.index, done: each ? partDone(each.part) : false, onSelect: () => move(jumpTo({ state, index })) };
      });

  const downItems =
    groupRun && task && task.parts.length > 0
      ? task.parts.map((each, partIndex) => ({
          key: String(partIndex),
          label: each.name,
          current: item?.partIndex === partIndex && state.phase !== "end",
          done: partDone(each),
          onSelect: () => move(jumpTo({ state, index: state.queue.findIndex((queued) => queued.taskId === task.id && queued.partIndex === partIndex) })),
        }))
      : [];

  const onDone = () => {
    if (state.phase === "end") onClose();
    else if (state.phase === "rest" || state.phase === "taskEnd") move(advance(state));
    else finish();
  };

  const scope = task ? (part && part !== task ? `${task.name} · ${part.name}` : task.name) : label;

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
                <CommentList comments={comments} scrollTo={null} onAdd={() => setCommenting(true)} onDelete={setDeleting} />
              ) : newest ? (
                <>
                  <Card body={newest.body} author={newest.author} when={formatWhen({ at: newest.writtenAt, today: store.today })} />
                  <TextButton active={false} onSelect={() => setCommentsOpen(true)}>
                    {comments.length > 1 ? `▾ ${comments.length - 1} more` : "▾ add a comment"}
                  </TextButton>
                </>
              ) : (
                <TextButton active onSelect={() => setCommenting(true)}>
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
      {commenting && task && (
        <EditorScreen
          heading="Comment"
          subheading={scope}
          initial=""
          onCancel={() => setCommenting(false)}
          onSave={(body) => {
            store.putComment({ id: identifier(), definitionId: task.definitionId, taskName: task.name, body: body.trim(), author: "user", writtenAt: nowStamp(), seenAt: nowStamp() });
            setCommenting(false);
          }}
        />
      )}
      {writing && task && (
        <EditorScreen
          heading="Journal"
          subheading={task.name}
          initial=""
          onCancel={() => setWriting(false)}
          onSave={(text) => {
            const { tags, body } = splitTags(text);
            store.putEntry({ name: "journal", entry: { id: identifier(), at: nowStamp().slice(0, 16), tags, task: task.name, body: body.trim() } });
            setWriting(false);
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
