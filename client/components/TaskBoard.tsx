import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import { Chevron } from "./icons.tsx";
import { TaskRow } from "./TaskRow.tsx";
import type { AttributeOmission } from "./TaskRow.tsx";
import { isDueToday } from "../format.ts";
import { buildGroups } from "../grouping.ts";
import { useShortcuts } from "../useShortcuts.ts";
import type { TaskStage } from "@shared/stages.ts";
import type { TaskState } from "@shared/states.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

const BLANK_TASK: Task = {
  id: null,
  list: null,
  parentId: null,
  recurringTaskId: null,
  title: "",
  note: null,
  state: "to_do",
  stage: null,
  tags: [],
  who: null,
  dueDate: null,
  dueTime: null,
  sortOrder: 0,
  resolvedAt: null,
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
  commentCount: 0,
  schedule: null,
  subtasks: [],
};

export const HIDDEN_GROUP = "hidden";

export type { AttributeOmission } from "./TaskRow.tsx";

export interface BoardGroup {
  key: string;
  label: string;
  stage?: TaskStage;
  list?: string;
  seed?: Partial<Task>;
  omitAttributes: AttributeOmission[];
  tasks: CreatedTask[];
}

export interface Landing {
  stage?: TaskStage;
  list?: string;
}

export interface RowActions {
  toggle: (task: CreatedTask) => void;
  open: (task: CreatedTask) => void;
  rename: (task: CreatedTask, changes: Partial<Task>) => void;
  create: (changes: Partial<Task>) => Promise<CreatedTask>;
  remove: (task: CreatedTask) => void;
  swipeLeft: (task: CreatedTask) => void;
  swipeRight: (task: CreatedTask) => void;
}

export interface TaskBoardProps {
  tasks: CreatedTask[];
  view: ViewPreference;
  lists: string[];
  omitAttributes: AttributeOmission[];
  justToggled: ReadonlyMap<number, TaskState>;
  showFinished: boolean;
  pending: boolean;
  emptyMessage: string;
  actions: RowActions;
  captureSeed: Partial<Task> | null;
  capturing: boolean;
  onCapturingChange: (open: boolean) => void;
  onMove: (
    taskId: number,
    landing: Landing,
    orderedIds: number[],
  ) => void;
}

export function TaskBoard({
  tasks,
  view,
  lists,
  omitAttributes,
  justToggled,
  showFinished,
  pending,
  emptyMessage,
  actions,
  captureSeed,
  capturing,
  onCapturingChange,
  onMove,
}: TaskBoardProps) {
  const groups = useMemo(
    () =>
      buildGroups({
        tasks: tasks,
        view: view,
        lists: lists,
        omitAttributes: omitAttributes,
        showFinished: showFinished,
      }),
    [tasks, view, lists, omitAttributes, showFinished],
  );

  const [capturingGroup, setCapturingGroup] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set([HIDDEN_GROUP]),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const { lift, startLift } = useDragToReorder({
    groups: groups,
    boardRef: boardRef,
    onMove: onMove,
  });

  const shown = groups
    .filter((group) => !collapsed.has(group.key))
    .flatMap((group) => group.tasks);
  const { focusedId, focusedIndex, focusAt, focusOn, land } =
    useRowFocus({ shown: shown, boardRef: boardRef });

  useShortcuts((event) => {
    if (event.key === "Escape") {
      focusOn(null);
      return;
    }
    const step = movement(event);
    if (step !== 0) {
      event.preventDefault();
      focusAt(focusedIndex + step);
    }
  });

  function subtaskRow(subtask: CreatedTask): ReactNode {
    return (
      <TaskRow
        key={subtask.id}
        task={showing({ task: subtask, justToggled: justToggled })}
        isEditing={editingId === subtask.id}
        onEditingChange={(editing) =>
          setEditingId(editing ? subtask.id : null)
        }
        onCommit={(changes) =>
          saveTask({
            task: subtask,
            changes: changes,
            actions: actions,
          })
        }
        swipeLeft={{
          name: "Delete",
          action: () => actions.remove(subtask),
        }}
        showAttributes={false}
        parseAttributes={false}
      />
    );
  }

  function newSubtaskRow(parent: Task): ReactNode {
    return (
      <TaskRow
        task={{
          ...BLANK_TASK,
          parentId: parent.id,
          list: parent.list,
        }}
        isEditing={true}
        onEditingChange={() => {}}
        onCommit={(changes) =>
          actions.create({ ...changes, list: parent.list })
        }
        showAttributes={false}
      />
    );
  }

  function taskRow(
    task: CreatedTask,
    group: BoardGroup,
    index: number,
  ): ReactNode {
    return (
      <div
        className="task-shell"
        data-row="true"
        data-task={task.id}
        data-group={group.key}
        data-index={index}
        data-lifting={lift?.taskId === task.id}
        data-focused={focusedId === task.id}
        onMouseEnter={() => focusOn(task.id)}
        onMouseLeave={() => focusOn(null)}
      >
        <TaskRow
          task={showing({ task: task, justToggled: justToggled })}
          isEditing={editingId === task.id}
          isFocused={focusedId === task.id}
          onEditingChange={(editing) =>
            setEditingId(editing ? task.id : null)
          }
          onCommit={(changes) => {
            saveTask({
              task: task,
              changes: changes,
              actions: actions,
            });
            land(task.id);
          }}
          onInfoOpen={() => actions.open(task)}
          onFocusNext={() =>
            focusAt(shown.findIndex((row) => row.id === task.id) + 1)
          }
          swipeLeft={{
            name: leftSwipeLabel(task),
            action: () => actions.swipeLeft(task),
          }}
          swipeRight={{
            name: rightSwipeLabel(task),
            action: () => actions.swipeRight(task),
          }}
          onLongPress={(pointerX, pointerY) =>
            startLift({
              taskId: task.id,
              fromKey: group.key,
              pointerX: pointerX,
              pointerY: pointerY,
            })
          }
          showAttributes={true}
          omitAttributes={group.omitAttributes}
          expanded={expanded.has(task.id)}
          onExpandedChange={(open) => changeExpanded(task.id, open)}
          renderSubtask={subtaskRow}
          renderNewSubtask={newSubtaskRow}
        />
      </div>
    );
  }

  function captureRow({
    seed,
    onCreated,
    onDismiss,
  }: {
    seed: Partial<Task>;
    onCreated?: (taskId: number) => void;
    onDismiss?: () => void;
  }): ReactNode {
    return (
      <TaskRow
        task={{ ...BLANK_TASK, ...seed }}
        isEditing={true}
        focusOnMount={true}
        onEditingChange={(editing) => {
          if (!editing) {
            onDismiss?.();
          }
        }}
        onCommit={(changes) =>
          actions.create(changes).then((made) => onCreated?.(made.id))
        }
        showAttributes={false}
      />
    );
  }

  function changeExpanded(taskId: number, open: boolean): void {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }

  const lastGroupKey = groups
    .filter((group) => group.key !== HIDDEN_GROUP)
    .at(-1)?.key;

  if (pending) {
    return <div className="board" ref={boardRef} />;
  }

  if (tasks.length === 0) {
    return (
      <div className="board" ref={boardRef}>
        <p className="empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="board" data-layout={view.layout} ref={boardRef}>
      {groups.map((group) => (
        <Group
          key={group.key}
          group={group}
          renderTask={taskRow}
          renderCapture={captureRow}
          canCapture={captureSeed !== null}
          seed={{ ...captureSeed, ...group.seed }}
          capturingHere={capturingGroup === group.key}
          capturingUnseeded={capturing && group.key === lastGroupKey}
          onLanded={land}
          onCaptureHere={(open) => {
            onCapturingChange(false);
            setCapturingGroup(open ? group.key : null);
          }}
          onCaptureDone={() => onCapturingChange(false)}
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
        />
      ))}

      {captureSeed !== null && groups.length === 0 && (
        <div className="tasks board-capture">
          {captureRow({
            seed: capturing ? {} : (captureSeed ?? {}),
            onDismiss: () => onCapturingChange(false),
          })}
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
  renderTask,
  renderCapture,
  canCapture,
  seed,
  capturingHere,
  capturingUnseeded,
  onCaptureHere,
  onCaptureDone,
  onLanded,
  collapsed,
  onToggleCollapsed,
  lift,
}: {
  group: BoardGroup;
  renderTask: (
    task: CreatedTask,
    group: BoardGroup,
    index: number,
  ) => ReactNode;
  renderCapture: (capture: {
    seed: Partial<Task>;
    onCreated?: (taskId: number) => void;
    onDismiss?: () => void;
  }) => ReactNode;
  canCapture: boolean;
  seed: Partial<Task>;
  capturingHere: boolean;
  capturingUnseeded: boolean;
  onCaptureHere: (open: boolean) => void;
  onCaptureDone: () => void;
  onLanded: (taskId: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  lift: Lift | null;
}) {
  const capturable = canCapture && group.key !== HIDDEN_GROUP;

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
                {renderTask(task, group, index)}
              </div>
            ))}
            {lift?.toKey === group.key &&
              lift.index >= group.tasks.length && (
                <div className="drop-line" />
              )}
            {capturable &&
              capturingUnseeded &&
              renderCapture({
                seed: {},
                onCreated: onLanded,
                onDismiss: onCaptureDone,
              })}

            {capturable &&
              !capturingUnseeded &&
              capturingHere &&
              renderCapture({
                seed: seed,
                onCreated: onLanded,
                onDismiss: () => onCaptureHere(false),
              })}

            {capturable && !capturingUnseeded && !capturingHere && (
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

export function rightSwipeLabel(task: CreatedTask): string {
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

export function leftSwipeLabel(task: CreatedTask): string {
  return task.archivedAt ? "Unarchive" : "Archive";
}

function showing({
  task,
  justToggled,
}: {
  task: CreatedTask;
  justToggled: ReadonlyMap<number, TaskState>;
}): CreatedTask {
  const held = justToggled.get(task.id);
  return held === undefined ? task : { ...task, state: held };
}

function saveTask({
  task,
  changes,
  actions,
}: {
  task: CreatedTask;
  changes: Partial<Task>;
  actions: RowActions;
}): void {
  if ("state" in changes) {
    actions.toggle(task);
    return;
  }
  actions.rename(task, changes);
}

interface Lift {
  taskId: number;
  fromKey: string;
  toKey: string;
  index: number;
}

function useDragToReorder({
  groups,
  boardRef,
  onMove,
}: {
  groups: BoardGroup[];
  boardRef: RefObject<HTMLDivElement | null>;
  onMove: (
    taskId: number,
    landing: Landing,
    orderedIds: number[],
  ) => void;
}): {
  lift: Lift | null;
  startLift: (start: {
    taskId: number;
    fromKey: string;
    pointerX: number;
    pointerY: number;
  }) => void;
} {
  const [lift, setLift] = useState<Lift | null>(null);
  const liftRef = useRef<Lift | null>(null);
  const finishLatest = useRef<() => void>(() => {});

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

  return { lift: lift, startLift: startLift };
}

function useRowFocus({
  shown,
  boardRef,
}: {
  shown: CreatedTask[];
  boardRef: RefObject<HTMLDivElement | null>;
}): {
  focusedId: number | null;
  focusedIndex: number;
  focusAt: (index: number) => void;
  focusOn: (taskId: number | null) => void;
  land: (taskId: number) => void;
} {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [landingId, setLandingId] = useState<number | null>(null);

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
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }, [landingId, shown, boardRef]);

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

  return {
    focusedId: focusedId,
    focusedIndex: focusedIndex,
    focusAt: focusAt,
    focusOn: setFocusedId,
    land: setLandingId,
  };
}
