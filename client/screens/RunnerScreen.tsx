import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { commentKey, groupCommentKey } from "@shared/comments.ts";
import { formatClock, formatWhen } from "@shared/format.ts";
import type { RunnerState } from "@shared/runner.ts";
import { advance, afterFinish, currentTask, goBack, isLastScreen, jumpTo } from "@shared/runner.ts";
import { childrenOf, valueText } from "@shared/tasks.ts";
import type { Comment, DerivedTask } from "@shared/types.ts";
import { newId } from "@shared/types.ts";

import { Box, Check, Chevron, Cross } from "../components/Glyphs.tsx";
import { settings } from "../data/settings.ts";
import { useStore } from "../data/store.tsx";

interface Slide {
  value: number;
  sliding: boolean;
  hold: boolean;
}

export function RunnerScreen({
  state,
  onChange,
  onExit,
  onEdit,
  onWrite,
}: {
  state: RunnerState;
  onChange: (state: RunnerState) => void;
  onExit: () => void;
  onEdit: (id: string) => void;
  onWrite: (id: string) => void;
}) {
  const store = useStore();
  const [listOpen, setListOpen] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [slide, setSlide] = useState<Slide>({ value: 0, sliding: false, hold: false });
  const [commentText, setCommentText] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const latest = useRef({ state, tasks: store.tasks });
  latest.current = { state, tasks: store.tasks };

  const tasks = store.tasks;
  const find = (id: string | null | undefined) => (id ? tasks.find((task) => task.id === id) : undefined);
  const task = currentTask({ state, tasks });
  const parent = find(task?.parent);
  const taskDone = task?.done ?? false;
  const endTask = state.phase === "taskEnd" ? find(state.endTask) : undefined;
  const lastScreen = isLastScreen(state);
  const queueTops = [...new Set(state.queue.map((id) => find(id)?.parent ?? id))];

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

  const patchDone = (target: DerivedTask) => {
    const fill = target.type === "numeric" && !target.tapIncrement && target.target > 0 && target.current < target.target;
    const patch = fill ? { doneManual: true, current: target.target } : { doneManual: true };
    store.patchTask({ id: target.id, patch });
  };

  const finish = (finished: DerivedTask) => {
    patchDone(finished);
    const next = afterFinish({ state: latest.current.state, tasks: latest.current.tasks, finished });
    setSlide({ value: 0, sliding: false, hold: false });
    setAddValue("");
    onChange(next);
  };

  const step = (fromRest: boolean) => {
    const next = advance({ state: latest.current.state, tasks: latest.current.tasks, fromRest, autoStartTimers: settings.autoStartTimers });
    setSlide({ value: 0, sliding: false, hold: false });
    setAddValue("");
    if (next) onChange(next);
    else onExit();
  };

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => {
      const { state: current, tasks: currentTasks } = latest.current;
      if (current.phase === "rest") {
        if (current.rest <= 1) step(true);
        else onChange({ ...current, rest: current.rest - 1 });
        return;
      }
      const running = currentTask({ state: current, tasks: currentTasks });
      if (!running || running.kind !== "timer") return;
      if (running.current + 1 >= running.target) finish(running);
      else store.patchTask({ id: running.id, patch: { current: running.current + 1 } });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.running]);

  const jump = (index: number) => {
    setListOpen(false);
    setSlide({ value: 0, sliding: false, hold: false });
    setAddValue("");
    onChange(jumpTo({ state, index }));
  };

  const commitAdd = () => {
    if (!task || !addValue) return;
    const amount = parseFloat(addValue);
    if (Number.isNaN(amount)) return;
    const total = task.current + amount;
    store.patchTask({ id: task.id, patch: { current: total, doneManual: null } });
    setAddValue("");
    if (total >= task.target) window.setTimeout(() => finish({ ...task, current: total }), 250);
  };

  const slidePosition = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left - 43) / (rect.width - 86)));
  };
  const slideValue = slide.sliding || slide.hold ? slide.value : taskDone ? 1 : 0;

  const groupKey = state.phase === "end" ? groupCommentKey(state.label) : null;
  const commentTarget = task ?? endTask ?? null;
  const keys = groupKey
    ? [groupKey, ...new Set(state.queue.map((id) => find(id)).filter((each): each is DerivedTask => !!each).map((each) => commentKey({ tasks, task: each })))]
    : commentTarget
      ? [commentKey({ tasks, task: commentTarget })]
      : [];
  const commentRoot = commentTarget ? (find(commentTarget.parent) ?? commentTarget) : null;
  const comments = store.comments
    .filter((comment) => keys.includes(comment.key))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((comment) => {
      let scope = commentRoot?.name ?? "";
      if (groupKey) scope = comment.key === groupKey ? state.label : (tasks.find((each) => commentKey({ tasks, task: each }) === comment.key)?.name ?? "");
      return { ...comment, when: formatWhen({ at: new Date(comment.at), now: new Date() }), scope };
    });
  const recent = comments[0];
  const canComment = (commentTarget !== null || groupKey !== null) && commentText === null && !state.running && state.phase !== "rest";

  const saveComment = () => {
    if (!commentText?.trim()) return;
    const key = groupKey ?? (commentTarget ? commentKey({ tasks, task: commentTarget }) : null);
    if (!key) return;
    const comment: Comment = { id: newId("c"), key, at: new Date().toISOString(), text: commentText.trim() };
    store.addComment(comment);
    setCommentText(null);
  };

  const hint = task
    ? taskDone
      ? task.kind === "timer"
        ? "done"
        : task.kind === "count"
          ? task.tapIncrement
            ? "done"
            : "of " + task.target + " · done"
          : "of " + task.target + (task.unit ? " " + task.unit : "") + " · done"
      : task.kind === "timer"
        ? state.running
          ? "tap to pause"
          : task.current > 0
            ? "paused · tap to resume"
            : "tap to start"
        : task.kind === "count"
          ? task.tapIncrement
            ? ""
            : "of " + task.target
          : "of " + task.target + (task.unit ? " " + task.unit : "")
    : "";

  const dropdown = state.queue.flatMap((id, index) => {
    const each = find(id);
    if (!each) return [];
    const items = [];
    const previous = find(state.queue[index - 1]);
    if (state.scope === "group" && each.parent && previous?.parent !== each.parent) {
      const head = find(each.parent);
      if (head) {
        const parts = childrenOf({ tasks, id: head.id }) as DerivedTask[];
        const firstOpen = parts.find((part) => !part.done) ?? parts[0];
        const target = state.queue.indexOf(firstOpen?.id ?? id);
        const current = state.endTask === head.id || (state.phase === "task" && task?.parent === head.id);
        items.push({ key: "head-" + head.id, name: head.name, done: head.done, current, part: false, go: () => jump(target) });
      }
    }
    const current = state.phase === "task" && index === state.index;
    const siblings = state.queue.filter((other) => find(other)?.name === each.name && find(other)?.parent === each.parent);
    const ordinal = siblings.length > 1 ? " " + (state.queue.slice(0, index).filter((other) => find(other)?.name === each.name).length + 1) : "";
    items.push({ key: id, name: each.name + ordinal, done: each.done, current, part: !!each.parent && state.scope === "group", go: () => jump(index) });
    return items;
  });

  const summaryRow = ({ each, part, onClick }: { each: DerivedTask; part: boolean; onClick?: () => void }) => {
    const classes = ["summary-row", each.done && "done", part && "part"].filter(Boolean).join(" ");
    const content = (
      <>
        <span>{each.name}</span>
        <span className="row-meta numbers">{valueText(each)}</span>
        <Box done={each.done} />
      </>
    );
    return onClick ? (
      <button key={each.id} className={classes} onClick={onClick}>
        {content}
      </button>
    ) : (
      <div key={each.id} className={classes}>
        {content}
      </div>
    );
  };

  const recentComment = recent && (
    <button className="recent-comment" onClick={() => setCommentsOpen(true)}>
      <div className="comment-when numbers">
        <span>{recent.when}</span>
        <span>{comments.length > 1 ? comments.length - 1 + " more" : ""}</span>
      </div>
      <div className="comment-text">{recent.text}</div>
    </button>
  );

  return (
    <div className="runner">
      <div className="runner-header">
        <div className="runner-scope">
          <button className="runner-scope-button" onClick={() => state.queue.length > 1 && setListOpen((open) => !open)}>
            <span>{state.queue.length > 1 ? state.label : ""}</span>
            {state.queue.length > 1 && (
              <span className="runner-position numbers">
                {(state.phase === "end" ? state.queue.length : Math.min(state.index + 1, state.queue.length)) + " of " + state.queue.length}
              </span>
            )}
            {state.queue.length > 1 && <Chevron open={listOpen} size={10} />}
          </button>
          {listOpen && (
            <>
              <div className="dropdown-scrim" onClick={() => setListOpen(false)} />
              <div className="dropdown">
                {dropdown.map((item) => (
                  <button key={item.key} className={[item.current && "current", item.done && "done", item.part && "part"].filter(Boolean).join(" ")} onClick={item.go}>
                    <span>{item.name}</span>
                    {item.done && (
                      <span className="tone-marker">
                        <Check />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="runner-actions">
          {task && <button onClick={() => onEdit(task.id)}>edit</button>}
          <button onClick={onExit}>exit</button>
        </div>
      </div>

      {state.phase === "rest" && (
        <div className="runner-center">
          <div className="rest-label">rest</div>
          <div className="big numbers">{formatClock(state.rest)}</div>
          <div className="rest-next">next: {find(state.queue[state.index + 1])?.name ?? ""}</div>
        </div>
      )}

      {task && (
        <div className="runner-center">
          <div className="runner-parent">{parent && state.label !== parent.name ? parent.name : ""}</div>
          <div className="runner-name">{task.name}</div>
          {(task.note || parent?.note) && <div className="note runner-note">{task.note || parent?.note}</div>}
          {task.kind === "timer" && (
            <>
              <button className={taskDone ? "big numbers done" : "big numbers"} onClick={() => !taskDone && onChange({ ...state, running: !state.running })}>
                {formatClock(taskDone ? task.target : task.target - task.current)}
              </button>
              <div className="hint">{hint}</div>
            </>
          )}
          {task.kind === "count" && (
            <>
              <div className="counter">
                {!taskDone && (
                  <button className="step" aria-label="minus one" onClick={() => store.patchTask({ id: task.id, patch: { current: Math.max(0, task.current - 1), doneManual: null } })}>
                    −
                  </button>
                )}
                <div className={taskDone ? "big numbers done" : "big numbers"}>{task.current}</div>
                {!taskDone && (
                  <button
                    className="step"
                    aria-label="plus one"
                    onClick={() => {
                      const count = task.current + 1;
                      store.patchTask({ id: task.id, patch: { current: count, doneManual: null } });
                      if (count >= task.target && !task.tapIncrement) window.setTimeout(() => finish({ ...task, current: count }), 250);
                    }}
                  >
                    +
                  </button>
                )}
              </div>
              <div className="hint">{hint}</div>
            </>
          )}
          {(task.kind === "amount" || task.kind === "weight") && (
            <>
              <div className="amount-total numbers">{task.current}</div>
              <div className="hint">{hint}</div>
              {!taskDone && (
                <>
                  <div className="amount-add">
                    <span>add</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={addValue}
                      onChange={(event) => setAddValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                          commitAdd();
                        }
                      }}
                    />
                    <span>{task.unit}</span>
                  </div>
                  <button className={addValue ? "amount-commit text-button accent" : "amount-commit text-button faint"} style={{ fontSize: 18 }} onClick={commitAdd}>
                    add
                  </button>
                </>
              )}
            </>
          )}
          {task.type === "boolean" && (
            <div
              className="slider"
              onPointerDown={(event) => {
                if (taskDone) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setSlide({ value: Math.min(slidePosition(event), 0.15), sliding: true, hold: false });
              }}
              onPointerMove={(event) => slide.sliding && setSlide({ ...slide, value: slidePosition(event) })}
              onPointerUp={() => {
                if (!slide.sliding) return;
                if (slide.value >= 0.9) {
                  setSlide({ value: 1, sliding: false, hold: true });
                  window.setTimeout(() => finish(task), 150);
                } else {
                  setSlide({ value: 0, sliding: false, hold: false });
                }
              }}
              onPointerCancel={() => setSlide({ value: 0, sliding: false, hold: false })}
            >
              <div className="slider-label" style={{ opacity: taskDone ? 0 : Math.max(0, 1 - slideValue * 3) }}>
                slide to complete
              </div>
              <div
                className="slider-thumb"
                style={{
                  left: `calc(3px + ${slideValue} * (100% - 86px))`,
                  background: `color-mix(in oklch, var(--complete) ${Math.round(slideValue * 100)}%, var(--hairline))`,
                  color: slideValue >= 0.5 ? "var(--page)" : "var(--muted)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: Math.max(0, Math.min(1, (slideValue - 0.4) / 0.4)) }}>
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                </svg>
                <Cross opacity={Math.max(0, Math.min(1, (0.6 - slideValue) / 0.4))} />
              </div>
            </div>
          )}
          {task.type === "text" && (
            <>
              {task.value && <div className="runner-answer">{task.value}</div>}
              <button className="pill" style={{ marginTop: 24 }} onClick={() => onWrite(task.id)}>
                {task.value ? "edit in journal" : "write in journal"}
              </button>
            </>
          )}
        </div>
      )}

      {endTask && (
        <div className="summary">
          <div className="summary-title">
            <div>{endTask.done ? endTask.name + " done" : endTask.current + " of " + endTask.target + " done"}</div>
            <div>{endTask.done ? "" : endTask.name}</div>
          </div>
          <div className="summary-rows">
            {(childrenOf({ tasks, id: endTask.id }) as DerivedTask[]).map((part) =>
              summaryRow({
                each: part,
                part: false,
                onClick: () => {
                  const index = state.queue.indexOf(part.id);
                  if (index >= 0) jump(index);
                },
              }),
            )}
          </div>
        </div>
      )}

      {state.phase === "end" && (
        <div className="summary">
          <div className="summary-title">
            <div>
              {(() => {
                const tops = queueTops.map((id) => find(id)).filter((each): each is DerivedTask => !!each);
                const done = tops.filter((each) => each.done).length;
                return done === tops.length ? state.label + " done" : done + " of " + tops.length + " done";
              })()}
            </div>
          </div>
          <div className="summary-rows">
            {queueTops
              .map((id) => find(id))
              .filter((each): each is DerivedTask => !!each)
              .flatMap((top) => [summaryRow({ each: top, part: false }), ...(childrenOf({ tasks, id: top.id }) as DerivedTask[]).map((part) => summaryRow({ each: part, part: true }))])}
          </div>
          {recentComment}
        </div>
      )}

      {state.phase !== "end" && <div className="comment-slot">{recentComment}</div>}

      {commentsOpen && (
        <div className="sheet">
          <div className="sheet-header">
            <span>Comments</span>
            <button onClick={() => setCommentsOpen(false)}>close</button>
          </div>
          <div className="sheet-list">
            {comments.map((comment) => (
              <div key={comment.id} className="comment">
                <div className="comment-when numbers">
                  <span>{comment.when}</span>
                  <span style={{ textTransform: "lowercase" }}>{comment.scope}</span>
                </div>
                <div className="comment-text">{comment.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {commentText !== null && (
        <div className="comment-composer">
          <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={4} autoFocus placeholder="a cue, a tweak, how it felt…" spellCheck={false} />
          <div className="entry-actions">
            <div className="right">
              <button className="text-button muted" onClick={() => setCommentText(null)}>
                cancel
              </button>
              <button className={commentText.trim() ? "text-button accent last" : "text-button faint last"} onClick={saveComment}>
                save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="comment-button-slot">
        {canComment && (
          <button
            className="pill"
            onClick={() => {
              onChange({ ...state, running: false });
              setCommentText("");
            }}
          >
            Add a comment
          </button>
        )}
      </div>

      <div className="runner-bar">
        <button className="previous" disabled={state.index === 0 && state.phase === "task"} onClick={() => onChange(goBack(state))}>
          ‹ previous
        </button>
        {state.phase === "rest" ? (
          <button className="middle" onClick={() => step(true)}>
            skip rest
          </button>
        ) : task && !taskDone ? (
          <button className="middle" onClick={() => finish(task)}>
            done
          </button>
        ) : (
          <span className="middle" />
        )}
        {lastScreen ? (
          <button className="next accent" onClick={onExit}>
            back to today
          </button>
        ) : (
          <button className={state.phase === "taskEnd" || taskDone ? "next accent" : "next"} onClick={() => step(state.phase === "rest")}>
            next ›
          </button>
        )}
      </div>
    </div>
  );
}
