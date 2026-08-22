import { useEffect, useRef, useState } from "react";

import { typedTask } from "./TaskAttributes.tsx";
import { Chevron, TaskRow } from "./TaskRow.tsx";
import type { MetaOmission, RowTask } from "./TaskRow.tsx";
import { isDueToday } from "../format.ts";
import { useShortcuts } from "../useShortcuts.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import type { Layout, Task } from "@shared/types.ts";

const FLICK_MILLISECONDS = 500;

export const HIDDEN_GROUP = "hidden";

export { Chevron } from "./TaskRow.tsx";
export type { MetaOmission } from "./TaskRow.tsx";

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
  create: (changes: Partial<Task>) => Promise<Task>;
  remove: (task: Task) => void;
  swipeLeft: (task: Task) => void;
  swipeRight: (task: Task) => void;
}

export interface TaskBoardProps {
  groups: BoardGroup[];
  actions: RowActions;
  layout: Layout;
  capturePrefix: string | null;
  capturing: boolean;
  onCapturingChange: (open: boolean) => void;
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
  layout,
  capturePrefix,
  capturing,
  onCapturingChange,
  onMove,
}: TaskBoardProps) {
  const [lift, setLift] = useState<Lift | null>(null);
  const [capturingGroup, setCapturingGroup] = useState<
    string | null
  >(null);
  const liftRef = useRef<Lift | null>(null);
  const finishLatest = useRef<() => void>(() => {});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [landingId, setLandingId] = useState<number | null>(null);
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

  useEffect(() => {
    if (landingId === null) {
      return;
    }
    if (!shown.some((task) => task.id === landingId)) {
      return;
    }
    setFocusedId(landingId);
    setLandingId(null);
    requestAnimationFrame(() =>
      boardRef.current
        ?.querySelector(`[data-task="${landingId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }, [landingId, shown]);

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

  function finishLift(): void {
    const dropped = liftRef.current;
    liftRef.current = null;
    setLift(null);
    if (!dropped) {
      return;
    }
    const target = groups.find(
      (group) => group.key === dropped.toKey,
    );
    const source = groups.find(
      (group) => group.key === dropped.fromKey,
    );
    if (!target || !source) {
      return;
    }

    const ids = target.tasks
      .map((task) => task.id)
      .filter((id) => id !== dropped.taskId);
    const at = Math.min(dropped.index, ids.length);
    ids.splice(at, 0, dropped.taskId);

    const landing: Landing =
      target.key === source.key
        ? {}
        : { stage: target.stage, list: target.list };

    const unchanged =
      target.key === source.key &&
      target.tasks.every((task, index) => task.id === ids[index]);

    if (!unchanged) {
      onMove(dropped.taskId, landing, ids);
    }
  }

  useEffect(() => {
    finishLatest.current = finishLift;
  });

  function startLift({
    taskId,
    fromKey,
    pointerX,
    pointerY,
  }: {
    taskId: number;
    fromKey: string;
    pointerX: number;
    pointerY: number;
  }): void {
    function track(atX: number, atY: number): void {
      const next = placeAt(atX, atY, taskId, fromKey);
      liftRef.current = next;
      setLift(next);
    }

    function onDragMove(event: PointerEvent): void {
      event.preventDefault();
      track(event.clientX, event.clientY);
    }

    function onDragEnd(): void {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
      finishLatest.current();
    }

    track(pointerX, pointerY);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  const lastGroupKey = groups
    .filter((group) => group.key !== HIDDEN_GROUP)
    .at(-1)?.key;

  return (
    <div
      className="board"
      data-layout={layout}
      ref={boardRef}
    >
      {groups.map((group) => (
        <Group
          key={group.key}
          group={group}
          actions={actions}
          capturePrefix={capturePrefix}
          capturingHere={capturingGroup === group.key}
          capturingUnseeded={capturing && group.key === lastGroupKey}
          onLanded={setLandingId}
          onCaptureHere={(open) => {
            onCapturingChange(false);
            setCapturingGroup(open ? group.key : null);
          }}
          onCaptureDone={() => onCapturingChange(false)}
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
          onLongPress={(taskId, pointerX, pointerY) =>
            startLift({
              taskId: taskId,
              fromKey: group.key,
              pointerX: pointerX,
              pointerY: pointerY,
            })
          }
        />
      ))}

      {capturePrefix !== null && groups.length === 0 && (
        <div className="tasks board-capture">
          <CaptureRow
            prefill={capturing ? "" : capturePrefix}
            actions={actions}
            focusOnMount={capturing}
            onDismiss={() => onCapturingChange(false)}
          />
        </div>
      )}
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
  capturingHere,
  capturingUnseeded,
  onCaptureHere,
  onCaptureDone,
  onLanded,
  collapsed,
  onToggleCollapsed,
  lift,
  flick,
  editingId,
  onEditingIdChange,
  focusedId,
  onFocusedIdChange,
  onLongPress,
}: {
  group: BoardGroup;
  actions: RowActions;
  capturePrefix: string | null;
  capturingHere: boolean;
  capturingUnseeded: boolean;
  onCaptureHere: (open: boolean) => void;
  onCaptureDone: () => void;
  onLanded: (taskId: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  lift: Lift | null;
  flick: Flick | null;
  editingId: number | null;
  onEditingIdChange: (taskId: number | null) => void;
  focusedId: number | null;
  onFocusedIdChange: (taskId: number | null) => void;
  onLongPress: (
    taskId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
}) {
  const prefill = [capturePrefix, group.prefill]
    .filter((part) => part)
    .join(" ");
  const canCapture =
    capturePrefix !== null && group.key !== HIDDEN_GROUP;

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
              <div key={task.id}>
                {lift?.toKey === group.key &&
                  lift.index === index && (
                    <div className="drop-line" />
                  )}
                <div
                  className="task-shell"
                  data-row="true"
                  data-task={task.id}
                  data-group={group.key}
                  data-index={index}
                  data-lifting={lift?.taskId === task.id}
                  data-focused={focusedId === task.id}
                  onMouseEnter={() => onFocusedIdChange(task.id)}
                  onMouseLeave={() => onFocusedIdChange(null)}
                >
                  <TaskRow
                    task={task}
                    isEditing={editingId === task.id}
                    onEditingChange={(editing) =>
                      onEditingIdChange(editing ? task.id : null)
                    }
                    onCommit={(changes) => {
                      saveTask({
                        task: task,
                        changes: changes,
                        actions: actions,
                      });
                      onLanded(task.id);
                    }}
                    onInfoOpen={() => actions.open(task)}
                    swipeLeft={{
                      name: leftSwipeLabel(task),
                      action: () => actions.swipeLeft(task),
                    }}
                    swipeRight={{
                      name: rightSwipeLabel(task),
                      action: () => actions.swipeRight(task),
                    }}
                    onLongPress={(pointerX, pointerY) =>
                      onLongPress(task.id, pointerX, pointerY)
                    }
                    flickingTo={
                      flick?.taskId === task.id
                        ? flick.direction
                        : null
                    }
                    showAttributes={true}
                    omitAttributes={group.omitFromMeta}
                    subtasks={(task.subtasks ?? []).map((subtask) => (
                      <SubtaskRow
                        key={subtask.id}
                        subtask={subtask}
                        actions={actions}
                      />
                    ))}
                  />
                </div>
              </div>
            ))}
            {lift?.toKey === group.key &&
              lift.index >= group.tasks.length && (
                <div className="drop-line" />
              )}
            {canCapture && capturingUnseeded && (
              <CaptureRow
                prefill=""
                actions={actions}
                focusOnMount={true}
                onCreated={onLanded}
                onDismiss={onCaptureDone}
              />
            )}

            {canCapture && !capturingUnseeded && capturingHere && (
              <CaptureRow
                prefill={prefill}
                actions={actions}
                focusOnMount={true}
                onCreated={onLanded}
                onDismiss={() => onCaptureHere(false)}
              />
            )}

            {canCapture && !capturingUnseeded && !capturingHere && (
              <button
                type="button"
                className="capture-space"
                aria-label={`Add to ${group.label || "this list"}`}
                onClick={() => onCaptureHere(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
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

function SubtaskRow({
  subtask,
  actions,
}: {
  subtask: Task;
  actions: RowActions;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <TaskRow
      task={subtask}
      isEditing={editing}
      onEditingChange={setEditing}
      onCommit={(changes) =>
        saveTask({
          task: subtask,
          changes: changes,
          actions: actions,
        })
      }
      onInfoOpen={() => actions.open(subtask)}
      swipeLeft={{
        name: "Delete",
        action: () => actions.remove(subtask),
      }}
      showAttributes={false}
    />
  );
}

function CaptureRow({
  prefill,
  actions,
  focusOnMount = false,
  onCreated,
  onDismiss,
}: {
  prefill: string;
  actions: RowActions;
  focusOnMount?: boolean;
  onCreated?: (taskId: number) => void;
  onDismiss?: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const seeded = renameChanges(prefill);
  const blank: RowTask = {
    ...typedTask({ changes: seeded, list: seeded.list ?? "" }),
    id: null,
    parentId: null,
    recurringTaskId: null,
    title: "",
    note: null,
    state: "to_do",
    resolvedAt: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    commentCount: 0,
    unseenCommentCount: 0,
    lastCommentFromOthers: false,
    subtasks: [],
  };

  useEffect(() => {
    if (focusOnMount) {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [focusOnMount]);

  return (
    <TaskRow
      task={blank}
      isEditing={true}
      onEditingChange={(editing) => {
        if (!editing) {
          onDismiss?.();
        }
      }}
      onCommit={(changes) =>
        actions.create(changes).then((made) => onCreated?.(made.id))
      }
      showAttributes={false}
      inputRef={titleRef}
    />
  );
}

function saveTask({
  task,
  changes,
  actions,
}: {
  task: Task;
  changes: Partial<Task>;
  actions: RowActions;
}): void {
  if ("state" in changes) {
    actions.toggle(task);
    return;
  }
  actions.rename(task, changes);
}
