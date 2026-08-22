import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { NewTaskRow } from "./NewTask.tsx";
import { SubtaskRow } from "./SubtaskRow.tsx";
import {
  AttributeChips,
  asRenamed,
  attributesOf,
  withoutAttribute,
} from "./TaskAttributes.tsx";
import { isDueToday } from "../format.ts";
import { useShortcuts } from "../useShortcuts.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import type { Density, Layout, Task } from "@shared/types.ts";

const SWIPE_FRACTION = 0.4;
const LONG_PRESS_MILLISECONDS = 400;
const FLICK_MILLISECONDS = 500;

export const HIDDEN_GROUP = "hidden";

export interface MetaOmission {
  field: Attribute;
  label: string;
}

export interface BoardGroup {
  key: string;
  label: string;
  stage?: TaskStage;
  list?: string;
  prefill?: string;
  omitFromMeta: MetaOmission[];
  tasks: Task[];
}

export interface Landing {
  stage?: TaskStage;
  list?: string;
}

export interface RowActions {
  toggle: (task: Task) => void;
  open: (task: Task) => void;
  rename: (task: Task, changes: Partial<Task>) => void;
  remove: (task: Task) => void;
  swipeLeft: (task: Task) => void;
  swipeRight: (task: Task) => void;
}

export interface TaskBoardProps {
  groups: BoardGroup[];
  actions: RowActions;
  density: Density;
  layout: Layout;
  capturePrefix: string | null;
  onMove: (
    taskId: number,
    landing: Landing,
    orderedIds: number[],
  ) => void;
}

interface Lift {
  taskId: number;
  fromKey: string;
  toKey: string;
  index: number;
}

interface Flick {
  taskId: number;
  direction: "left" | "right";
}

export function TaskBoard({
  groups,
  actions,
  density,
  layout,
  capturePrefix,
  onMove,
}: TaskBoardProps) {
  const [lift, setLift] = useState<Lift | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set([HIDDEN_GROUP]),
  );
  const [flick, setFlick] = useState<Flick | null>(null);
  const flicking = useRef<{
    timer: ReturnType<typeof setTimeout>;
    act: () => void;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const shown = groups
    .filter((group) => !collapsed.has(group.key))
    .flatMap((group) => group.tasks);
  const focusedIndex = shown.findIndex(
    (task) => task.id === focusedId,
  );

  function focusAt(index: number): void {
    const task =
      shown[Math.min(Math.max(index, 0), shown.length - 1)];
    if (!task) {
      return;
    }
    setFocusedId(task.id);
    boardRef.current
      ?.querySelector(`[data-task="${task.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function settleFlick(): void {
    const current = flicking.current;
    if (!current) {
      return;
    }
    clearTimeout(current.timer);
    flicking.current = null;
    setFlick(null);
    current.act();
  }

  function flickAway(task: Task, direction: "left" | "right"): void {
    settleFlick();
    setFlick({ taskId: task.id, direction: direction });
    flicking.current = {
      timer: setTimeout(settleFlick, FLICK_MILLISECONDS),
      act: () =>
        direction === "left"
          ? actions.swipeLeft(task)
          : actions.swipeRight(task),
    };
  }

  useShortcuts((event) => {
    if (event.key === "Escape") {
      setFocusedId(null);
      return;
    }
    const step = movement(event);
    if (step !== 0) {
      event.preventDefault();
      focusAt(focusedIndex + step);
      return;
    }

    const task = shown[focusedIndex];
    if (!task) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      setEditingId(task.id);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      actions.toggle(task);
      return;
    }
    if (event.key === "i") {
      event.preventDefault();
      actions.open(task);
      return;
    }
    if (isTerminal(task.state)) {
      return;
    }
    if (event.key === "a") {
      focusAt(focusedIndex + 1);
      flickAway(task, "left");
    }
    if (event.key === "h" && task.archivedAt === null) {
      focusAt(focusedIndex + 1);
      flickAway(task, "right");
    }
  });

  function placeAt(
    pointerX: number,
    pointerY: number,
    taskId: number,
    fromKey: string,
  ): Lift {
    const rows = [
      ...(boardRef.current?.querySelectorAll<HTMLElement>(
        "[data-row]",
      ) ?? []),
    ].filter((row) => {
      const box = row.getBoundingClientRect();
      return pointerX >= box.left && pointerX <= box.right;
    });

    for (const row of rows) {
      const box = row.getBoundingClientRect();
      if (pointerY < box.top + box.height / 2) {
        return {
          taskId: taskId,
          fromKey: fromKey,
          toKey: row.dataset.group ?? fromKey,
          index: Number(row.dataset.index ?? 0),
        };
      }
    }

    const last = rows.at(-1);
    if (last) {
      return {
        taskId: taskId,
        fromKey: fromKey,
        toKey: last.dataset.group ?? fromKey,
        index: Number(last.dataset.index ?? 0) + 1,
      };
    }

    return {
      taskId: taskId,
      fromKey: fromKey,
      toKey: emptyGroupUnder(pointerX) ?? fromKey,
      index: 0,
    };
  }

  function emptyGroupUnder(pointerX: number): string | null {
    const columns = [
      ...(boardRef.current?.querySelectorAll<HTMLElement>(
        "[data-group-key]",
      ) ?? []),
    ];

    for (const column of columns) {
      const box = column.getBoundingClientRect();
      if (pointerX >= box.left && pointerX <= box.right) {
        return column.dataset.groupKey ?? null;
      }
    }

    return null;
  }

  function commit(): void {
    if (!lift) {
      return;
    }
    const target = groups.find((group) => group.key === lift.toKey);
    const source = groups.find((group) => group.key === lift.fromKey);
    setLift(null);
    if (!target || !source) {
      return;
    }

    const ids = target.tasks
      .map((task) => task.id)
      .filter((id) => id !== lift.taskId);
    const at = Math.min(lift.index, ids.length);
    ids.splice(at, 0, lift.taskId);

    const landing: Landing =
      target.key === source.key
        ? {}
        : { stage: target.stage, list: target.list };

    const unchanged =
      target.key === source.key &&
      target.tasks.every((task, index) => task.id === ids[index]);

    if (!unchanged) {
      onMove(lift.taskId, landing, ids);
    }
  }

  return (
    <div
      className="board"
      data-density={density}
      data-layout={layout}
      ref={boardRef}
    >
      {groups.map((group) => (
        <Group
          key={group.key}
          group={group}
          actions={actions}
          capturePrefix={capturePrefix}
          editingId={editingId}
          onEditingIdChange={setEditingId}
          focusedId={focusedId}
          onFocusedIdChange={setFocusedId}
          collapsed={collapsed.has(group.key)}
          onToggleCollapsed={() =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(group.key)) {
                next.delete(group.key);
              } else {
                next.add(group.key);
              }
              return next;
            })
          }
          lift={lift}
          flick={flick}
          onLiftStart={(taskId, pointerX, pointerY) =>
            setLift(placeAt(pointerX, pointerY, taskId, group.key))
          }
          onLiftMove={(taskId, pointerX, pointerY) =>
            setLift(
              placeAt(
                pointerX,
                pointerY,
                taskId,
                lift?.fromKey ?? group.key,
              ),
            )
          }
          onLiftEnd={commit}
        />
      ))}
    </div>
  );
}

function movement(event: KeyboardEvent): number {
  if (event.ctrlKey) {
    if (event.key === "n") {
      return 1;
    }
    if (event.key === "p") {
      return -1;
    }
    return 0;
  }
  if (event.key === "ArrowDown" || event.key === "j") {
    return 1;
  }
  if (event.key === "ArrowUp" || event.key === "k") {
    return -1;
  }
  return 0;
}

function Group({
  group,
  actions,
  capturePrefix,
  collapsed,
  onToggleCollapsed,
  lift,
  flick,
  editingId,
  onEditingIdChange,
  focusedId,
  onFocusedIdChange,
  onLiftStart,
  onLiftMove,
  onLiftEnd,
}: {
  group: BoardGroup;
  actions: RowActions;
  capturePrefix: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  lift: Lift | null;
  flick: Flick | null;
  editingId: number | null;
  onEditingIdChange: (taskId: number | null) => void;
  focusedId: number | null;
  onFocusedIdChange: (taskId: number | null) => void;
  onLiftStart: (
    taskId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onLiftMove: (
    taskId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onLiftEnd: () => void;
}) {
  const prefill = [capturePrefix, group.prefill]
    .filter((part) => part)
    .join(" ");

  return (
    <div className="group" data-group-key={group.key}>
      {group.label && (
        <button
          type="button"
          className="group-head"
          onClick={onToggleCollapsed}
        >
          <Chevron open={!collapsed} />
          <span className="group-name">{group.label}</span>
          {collapsed && (
            <span className="group-count">{group.tasks.length}</span>
          )}
        </button>
      )}

      <div className="collapsible" data-open={!collapsed}>
        <div>
          <div className="tasks">
            {group.tasks.map((task, index) => (
              <Row
                key={task.id}
                task={task}
                index={index}
                group={group}
                actions={actions}
                lift={lift}
                flick={flick}
                editing={editingId === task.id}
                onEditStart={() => onEditingIdChange(task.id)}
                onEditEnd={() => onEditingIdChange(null)}
                focused={focusedId === task.id}
                onFocus={() => onFocusedIdChange(task.id)}
                onLeave={() => onFocusedIdChange(null)}
                onLiftStart={onLiftStart}
                onLiftMove={onLiftMove}
                onLiftEnd={onLiftEnd}
              />
            ))}
            {lift?.toKey === group.key &&
              lift.index >= group.tasks.length && (
                <div className="drop-line" />
              )}
            {capturePrefix !== null && (
              <NewTaskRow prefill={prefill ? `${prefill} ` : ""} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  task,
  index,
  group,
  actions,
  lift,
  flick,
  editing,
  onEditStart,
  onEditEnd,
  focused,
  onFocus,
  onLeave,
  onLiftStart,
  onLiftMove,
  onLiftEnd,
}: {
  task: Task;
  index: number;
  group: BoardGroup;
  actions: RowActions;
  lift: Lift | null;
  flick: Flick | null;
  editing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  focused: boolean;
  onFocus: () => void;
  onLeave: () => void;
  onLiftStart: (
    taskId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onLiftMove: (
    taskId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onLiftEnd: () => void;
}) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [edits, setEdits] = useState<Partial<Task>>({});
  const lifting = lift?.taskId === task.id;
  const flickingTo =
    flick?.taskId === task.id ? flick.direction : null;

  useEffect(() => {
    if (editing) {
      setDraft(task.title);
      setEdits({});
    }
  }, [editing, task.title]);

  const uncommittedTask: Task = {
    ...asRenamed({ task: task, draft: draft }),
    ...edits,
  };

  const gesture = useRowGesture({
    onLeft: () => actions.swipeLeft(task),
    onRight: () => actions.swipeRight(task),
    onLiftStart: (pointerX, pointerY) =>
      onLiftStart(task.id, pointerX, pointerY),
    onLiftMove: (pointerX, pointerY) =>
      onLiftMove(task.id, pointerX, pointerY),
    onLiftEnd: onLiftEnd,
    enabled: !isTerminal(task.state),
  });

  const subtasks = task.subtasks ?? [];
  const finished = subtasks.filter((subtask) =>
    isTerminal(subtask.state),
  ).length;

  const flickTravel =
    flickingTo === "left"
      ? -SWIPE_FRACTION * 100
      : SWIPE_FRACTION * 100;
  const shift =
    flickingTo === null ? `${gesture.offset}px` : `${flickTravel}%`;

  return (
    <>
      {lift?.toKey === group.key && lift.index === index && (
        <div className="drop-line" />
      )}
      <div
        className="task-shell"
        data-row="true"
        data-task={task.id}
        data-group={group.key}
        data-index={index}
        data-lifting={lifting}
      >
        <div className="swipe-track">
          {(gesture.swiping || flickingTo !== null) && (
            <>
              <div className="swipe-action archive">
                {leftSwipeLabel(task)}
              </div>
              <div
                className={
                  task.archivedAt
                    ? "swipe-action remove"
                    : "swipe-action defer"
                }
              >
                {rightSwipeLabel(task)}
              </div>
            </>
          )}

          <div
            className="task"
            ref={gesture.ref}
            data-done={isTerminal(task.state)}
            data-editing={editing}
            data-focused={focused}
            data-swiping={gesture.swiping}
            style={{ transform: `translateX(${shift})` }}
            onMouseEnter={onFocus}
            onMouseLeave={() => {
              if (focused) {
                onLeave();
              }
            }}
            onPointerDown={gesture.down}
            onPointerMove={gesture.move}
            onPointerUp={gesture.up}
            onPointerCancel={gesture.up}
          >
            <div className="task-main">
              <button
                type="button"
                className="task-tick"
                data-state={task.state}
                aria-label={`Mark ${task.title} done`}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.toggle(task);
                }}
              />

              {editing ? (
                <TitleField
                  task={task}
                  draft={draft}
                  onDraftChange={setDraft}
                  onCommit={(title) => {
                    actions.rename(task, {
                      ...renameChanges(title),
                      ...edits,
                    });
                    onEditEnd();
                  }}
                  onCancel={onEditEnd}
                />
              ) : (
                <button
                  type="button"
                  className="task-title"
                  onClick={() => {
                    if (!gesture.travelled()) {
                      onEditStart();
                    }
                  }}
                >
                  {task.title}
                </button>
              )}

              <button
                type="button"
                className="task-info"
                aria-label="Task details"
                onPointerDown={(event) => {
                  event.preventDefault();
                  dismissKeyboard();
                  actions.open(task);
                }}
                onClick={() => actions.open(task)}
              >
                <InfoIcon />
              </button>

              {task.lastCommentFromOthers && (
                <span
                  className="comment-dot"
                  aria-label="Waiting on you"
                />
              )}

              {subtasks.length > 0 && (
                <button
                  type="button"
                  className="subtask-toggle"
                  aria-label="Show subtasks"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSubtasks(!showSubtasks);
                  }}
                >
                  <span className="subtask-count">
                    {finished}/{subtasks.length}
                  </span>
                  <Chevron open={showSubtasks} />
                </button>
              )}
            </div>

            {editing ? (
              <AttributeChips
                task={uncommittedTask}
                onRemove={(attribute) => {
                  const without = withoutAttribute({
                    task: uncommittedTask,
                    draft: draft,
                    attribute: attribute,
                  });
                  setDraft(without.draft);
                  setEdits({ ...edits, ...without.changes });
                }}
              />
            ) : (
              <Meta
                task={task}
                group={group}
                travelled={gesture.travelled}
                onOpen={() => actions.open(task)}
              />
            )}
          </div>
        </div>

        {subtasks.length > 0 && (
          <div className="collapsible" data-open={showSubtasks}>
            <div>
              <div className="subtasks">
                {subtasks.map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    onToggle={() => actions.toggle(subtask)}
                    onRename={(next) =>
                    actions.rename(subtask, { title: next })
                  }
                    onDelete={() => actions.remove(subtask)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function rightSwipeLabel(task: Task): string {
  if (task.archivedAt) {
    return "Delete";
  }
  if (task.state === "hidden") {
    return "Unhide";
  }
  return task.recurringTaskId || isDueToday(task.dueDate)
    ? "Skip"
    : "Hide";
}

export function leftSwipeLabel(task: Task): string {
  return task.archivedAt ? "Unarchive" : "Archive";
}

function dismissKeyboard(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) {
    focused.blur();
  }
}

function TitleField({
  task,
  draft,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  task: Task;
  draft: string;
  onDraftChange: (draft: string) => void;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  function finish(): void {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onCommit(trimmed);
      return;
    }
    onCancel();
  }

  return (
    <input
      className="task-title editing"
      value={draft}
      autoFocus
      enterKeyHint="done"
      aria-label="Title"
      onChange={(event) => onDraftChange(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          finish();
        }
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    />
  );
}

function InfoIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 9v4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.4" r="0.95" fill="currentColor" />
    </svg>
  );
}

function Meta({
  task,
  group,
  travelled,
  onOpen,
}: {
  task: Task;
  group: BoardGroup;
  travelled: () => boolean;
  onOpen: () => void;
}) {
  const navigate = useNavigate();

  const shown = attributesOf(task).filter(
    (item) =>
      item.text.toLowerCase() === "today" ||
      !group.omitFromMeta.some(
        (omission) =>
          omission.field === item.field &&
          omission.label.toLowerCase() === item.text.toLowerCase(),
      ),
  );

  if (shown.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {shown.map(({ field, text, to }) => (
        <button
          type="button"
          key={`${field}-${text}`}
          className={field === "tag" ? "tag" : undefined}
          onClick={() => {
            if (travelled()) {
              return;
            }
            if (to) {
              navigate(to);
            } else {
              onOpen();
            }
          }}
        >
          {text.toLowerCase()}
        </button>
      ))}
    </span>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className="chevron"
      data-open={open}
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useRowGesture({
  onLeft,
  onRight,
  onLiftStart,
  onLiftMove,
  onLiftEnd,
  enabled,
}: {
  onLeft: () => void;
  onRight: () => void;
  onLiftStart: (pointerX: number, pointerY: number) => void;
  onLiftMove: (pointerX: number, pointerY: number) => void;
  onLiftEnd: () => void;
  enabled: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sideways = useRef(0);
  const furthest = useRef(0);
  const holding = useRef(false);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const stopWatching = useRef<(() => void) | null>(null);
  const endLatest = useRef<() => void>(() => {});

  useEffect(() => {
    const node = element.current;
    if (!node) {
      return;
    }
    function holdTheScroll(event: TouchEvent): void {
      if (holding.current) {
        event.preventDefault();
      }
    }
    node.addEventListener("touchmove", holdTheScroll, {
      passive: false,
    });
    return () => node.removeEventListener("touchmove", holdTheScroll);
  }, []);

  useEffect(() => {
    return () => {
      stopWatching.current?.();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    endLatest.current = endGesture;
  });

  function stopTimer(): void {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function watchForRelease(
    pointerId: number,
    finish: () => void,
  ): void {
    stopWatching.current?.();

    function onPointerRelease(event: PointerEvent): void {
      if (event.pointerId === pointerId) {
        finish();
      }
    }
    function onWindowBlur(): void {
      finish();
    }

    window.addEventListener("pointerup", onPointerRelease);
    window.addEventListener("pointercancel", onPointerRelease);
    window.addEventListener("blur", onWindowBlur);
    stopWatching.current = () => {
      window.removeEventListener("pointerup", onPointerRelease);
      window.removeEventListener("pointercancel", onPointerRelease);
      window.removeEventListener("blur", onWindowBlur);
      stopWatching.current = null;
    };
  }

  return {
    ref: element,
    offset: offset,
    swiping: offset !== 0,
    travelled: () => furthest.current > 8,
    down: (event: React.PointerEvent) => {
      if (!enabled) {
        return;
      }
      active.current = true;
      watchForRelease(event.pointerId, () => endLatest.current());
      start.current = { x: event.clientX, y: event.clientY };
      sideways.current = 0;
      furthest.current = 0;
      holding.current = false;
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      const node = event.currentTarget;
      const pointerId = event.pointerId;
      timer.current = setTimeout(() => {
        holding.current = true;
        if (node.isConnected) {
          node.setPointerCapture(pointerId);
        }
        onLiftStart(pointerX, pointerY);
      }, LONG_PRESS_MILLISECONDS);
    },
    move: (event: React.PointerEvent) => {
      if (!start.current) {
        return;
      }
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      furthest.current = Math.max(
        furthest.current,
        Math.abs(dx),
        Math.abs(dy),
      );

      if (holding.current) {
        onLiftMove(event.clientX, event.clientY);
        return;
      }

      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        stopTimer();
        start.current = null;
        setOffset(0);
        return;
      }

      if (Math.abs(dx) > 6) {
        stopTimer();
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }
      sideways.current = dx;
      setOffset(dx);
    },
    up: () => endGesture(),
  };

  function endGesture(): void {
    if (!active.current) {
      return;
    }
    active.current = false;
    stopWatching.current?.();
    stopTimer();

    if (holding.current) {
      holding.current = false;
      start.current = null;
      setOffset(0);
      onLiftEnd();
      return;
    }
    if (!start.current) {
      return;
    }
    const dx = sideways.current;
    const threshold =
      (element.current?.offsetWidth ?? 0) * SWIPE_FRACTION;
    start.current = null;
    sideways.current = 0;
    setOffset(0);
    if (dx <= -threshold) {
      onLeft();
    } else if (dx >= threshold) {
      onRight();
    }
  }
}
