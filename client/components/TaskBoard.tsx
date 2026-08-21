import { useEffect, useRef, useState } from "react";

import {
  formatDueDate,
  formatDueTime,
  isDueToday,
} from "../format.ts";
import { stageLabel } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import type {
  BreakUpField,
  Density,
  Layout,
  Task,
} from "@shared/types.ts";

const SWIPE_FRACTION = 0.4;
const LONG_PRESS_MILLISECONDS = 400;

export interface BoardGroup {
  key: string;
  label: string;
  stage?: TaskStage;
  list?: string;
  omitFromMeta?: BreakUpField;
  tasks: Task[];
}

export interface Landing {
  stage?: TaskStage;
  list?: string;
}

export interface RowActions {
  toggle: (task: Task) => void;
  open: (task: Task) => void;
  rename: (task: Task, title: string) => void;
  swipeLeft: (task: Task) => void;
  swipeRight: (task: Task) => void;
}

export interface TaskBoardProps {
  groups: BoardGroup[];
  actions: RowActions;
  density: Density;
  layout: Layout;
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

export function TaskBoard({
  groups,
  actions,
  density,
  layout,
  onMove,
}: TaskBoardProps) {
  const [lift, setLift] = useState<Lift | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);

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
          editingId={editingId}
          onEditingIdChange={setEditingId}
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

function Group({
  group,
  actions,
  collapsed,
  onToggleCollapsed,
  lift,
  editingId,
  onEditingIdChange,
  onLiftStart,
  onLiftMove,
  onLiftEnd,
}: {
  group: BoardGroup;
  actions: RowActions;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  lift: Lift | null;
  editingId: number | null;
  onEditingIdChange: (taskId: number | null) => void;
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
                editing={editingId === task.id}
                onEditStart={() => onEditingIdChange(task.id)}
                onEditEnd={() => onEditingIdChange(null)}
                onLiftStart={onLiftStart}
                onLiftMove={onLiftMove}
                onLiftEnd={onLiftEnd}
              />
            ))}
            {lift?.toKey === group.key &&
              lift.index >= group.tasks.length && (
                <div className="drop-line" />
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
  editing,
  onEditStart,
  onEditEnd,
  onLiftStart,
  onLiftMove,
  onLiftEnd,
}: {
  task: Task;
  index: number;
  group: BoardGroup;
  actions: RowActions;
  lift: Lift | null;
  editing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
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
  const lifting = lift?.taskId === task.id;

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

  return (
    <>
      {lift?.toKey === group.key && lift.index === index && (
        <div className="drop-line" />
      )}
      <div
        className="task-shell"
        data-row="true"
        data-group={group.key}
        data-index={index}
        data-lifting={lifting}
      >
        <div className="swipe-track">
          {gesture.swiping && (
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
            data-swiping={gesture.swiping}
            style={{ transform: `translateX(${gesture.offset}px)` }}
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
                  onCommit={(next) => {
                    actions.rename(task, next);
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

            <Meta task={task} group={group} />
          </div>
        </div>

        {subtasks.length > 0 && (
          <div className="collapsible" data-open={showSubtasks}>
            <div>
              <div className="subtasks">
                {subtasks.map((subtask) => (
                  <button
                    type="button"
                    key={subtask.id}
                    className="subtask"
                    data-done={isTerminal(subtask.state)}
                    onClick={() => actions.toggle(subtask)}
                  >
                    <span className="subtask-tick" />
                    <span>{subtask.title}</span>
                  </button>
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
  onCommit,
  onCancel,
}: {
  task: Task;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(task.title);

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
      onChange={(event) => setDraft(event.target.value)}
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

function Meta({ task, group }: { task: Task; group: BoardGroup }) {
  const omitted = group.omitFromMeta;
  const archived = task.archivedAt !== null;
  const due = isDueToday(task.dueDate)
    ? null
    : formatDueDate(task.dueDate);
  const parts = [
    task.stage && omitted !== "stage"
      ? stageLabel(task.stage).toLowerCase()
      : null,
    omitted === "due_date" || archived ? null : due,
    archived ? null : formatDueTime(task.dueTime),
    omitted === "who" ? null : task.who,
  ].filter((part): part is string => Boolean(part));

  const tags = task.tags.filter(
    (tag) => omitted !== "tag" || tag !== group.label,
  );

  if (parts.length === 0 && tags.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
        </span>
      ))}
      {parts.map((part) => (
        <span key={part}>{part}</span>
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
