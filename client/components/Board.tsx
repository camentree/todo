import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import { Row } from "./Row.tsx";
import {
  BLANK_TASK,
  NewSubtaskRow,
  SubtaskRow,
} from "./Subtasks.tsx";
import {
  isDueToday,
  todayAsDateString,
} from "../tasks/format.ts";
import { buildGroups, HIDDEN_GROUP } from "../tasks/grouping.ts";
import type { TaskGroup } from "../tasks/grouping.ts";
import { easeToTop } from "../hooks/useEaseIntoView.ts";
import { Collapsible } from "./ui/Collapsible.tsx";
import { usePending } from "../data/pending.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { renameChanges, taskAsLine } from "../tasks/taskLine.ts";
import { asChanges } from "../tasks/attributes.ts";
import type { Attribute } from "../tasks/attributes.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

export interface RowActions {
  toggle: (task: CreatedTask) => void;
  open: (task: CreatedTask) => void;
  rename: (task: CreatedTask, changes: Partial<Task>) => void;
  create: (changes: Partial<Task>) => Promise<CreatedTask>;
  remove: (task: CreatedTask) => void;
  swipeLeft: (task: CreatedTask) => void;
  swipeRight: (task: CreatedTask) => void;
  reparent: (task: CreatedTask, parentId: number | null) => void;
  undo: () => void;
  redo: () => void;
}

export interface BoardProps {
  tasks: CreatedTask[];
  view: ViewPreference;
  lists: string[];
  hiddenAttributes: Attribute[];
  showFinished: boolean;
  pending: boolean;
  emptyMessage: string;
  actions: RowActions;
  captureSeed: Partial<Task> | null;
  capturing: boolean;
  onCapturingChange: (open: boolean) => void;
  onMove: (
    taskId: number,
    destinationAttributes: Attribute[],
    orderedIds: number[],
  ) => void;
  onNest: (
    taskId: number,
    parentId: number,
    orderedIds: number[],
  ) => void;
}

export function Board({
  tasks,
  view,
  lists,
  hiddenAttributes,
  showFinished,
  pending,
  emptyMessage,
  actions,
  captureSeed,
  capturing,
  onCapturingChange,
  onMove,
  onNest,
}: BoardProps) {
  const groups = useMemo(
    () =>
      buildGroups({
        tasks: tasks,
        view: view,
        lists: lists,
        hiddenAttributes: hiddenAttributes,
        showFinished: showFinished,
      }),
    [tasks, view, lists, hiddenAttributes, showFinished],
  );

  const [capturingGroup, setCapturingGroup] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set([HIDDEN_GROUP]),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<
    number | null
  >(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const held = usePending();
  const copied = useRef<string | null>(null);
  const { move, startMove } = useMoveTask({
    groups: groups,
    boardRef: boardRef,
    onMove: onMove,
    onNest: onNest,
    onExpand: (taskId) => expand(taskId, true),
  });

  const shown = groups
    .filter((group) => !collapsed.has(group.key))
    .flatMap((group) => group.tasks);
  const { focusedId, focusAt, focusStep, focusOn, hoverOn, land } =
    useRowFocus({ shown: shown, boardRef: boardRef });
  useEffect(() => {
    if (addingSubtaskTo === null) {
      return;
    }
    const fields =
      boardRef.current?.querySelectorAll<HTMLTextAreaElement>(
        `[data-task="${addingSubtaskTo}"] .subtasks textarea`,
      );
    const blank = fields?.[fields.length - 1];
    if (!blank) {
      return;
    }
    blank.focus();
    setAddingSubtaskTo(null);
  }, [addingSubtaskTo, expanded]);

  function expand(taskId: number, open: boolean): void {
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

  function addSubtaskTo(taskId: number): void {
    expand(taskId, true);
    setAddingSubtaskTo(taskId);
  }

  const walk = shown.flatMap((task) => [
    task.id,
    ...(expanded.has(task.id)
      ? (task.subtasks ?? []).map((subtask) => subtask.id)
      : []),
  ]);

  function copy(task: CreatedTask): void {
    const line = taskAsLine(task);
    copied.current = line;
    void navigator.clipboard?.writeText(line).catch(() => {});
  }

  async function paste(): Promise<void> {
    const fromSystem = await navigator.clipboard
      ?.readText()
      .catch(() => "");
    const line = fromSystem || copied.current;
    if (!line?.trim()) {
      return;
    }
    const destinationGroup = groups.find((group) =>
      group.tasks.some((task) => task.id === focusedId),
    );
    const made = await actions.create({
      ...asChanges(destinationGroup?.guessedAttributes ?? []),
      ...renameChanges(line),
      ...asChanges(destinationGroup?.groupedBy ?? []),
    });
    land(made.id);
    if (
      focusedId === null ||
      !destinationGroup ||
      view.orderBy !== "manual"
    ) {
      return;
    }
    const ordered = destinationGroup.tasks.map((task) => task.id);
    ordered.splice(ordered.indexOf(focusedId) + 1, 0, made.id);
    onMove(made.id, [], ordered);
  }

  function editBeside(taskId: number, step: number): void {
    const here = walk.indexOf(taskId);
    const next = here === -1 ? undefined : walk[here + step];
    if (next === undefined) {
      return;
    }
    setEditingId(next);
    if (shown.some((task) => task.id === next)) {
      focusOn(next);
    }
  }

  useKeyboardShortcuts((event) => {
    if (event.key === "Escape") {
      focusOn(null);
      return;
    }
    if (event.key === "Tab" && focusedId !== null) {
      event.preventDefault();
      editBeside(focusedId, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "z") {
      event.preventDefault();
      void actions.undo();
      return;
    }
    if (event.key === "r") {
      event.preventDefault();
      void actions.redo();
      return;
    }
    const step = movement(event);
    if (step !== 0) {
      event.preventDefault();
      focusStep(step);
      return;
    }
    if (event.key === "p") {
      event.preventDefault();
      void paste();
    }
  });

  function subtaskRow(
    subtask: CreatedTask,
    index: number,
    group: TaskGroup,
    siblingCount: number,
  ): ReactNode {
    return (
      <SubtaskRow
        key={subtask.id}
        subtask={subtask}
        index={index}
        actions={actions}
        editing={editingId === subtask.id}
        onEditingChange={(editing) =>
          setEditingId(editing ? subtask.id : null)
        }
        onTab={(backwards) =>
          editBeside(subtask.id, backwards ? -1 : 1)
        }
        moving={move?.taskId === subtask.id}
        dropAt={dropAt({
          parentId: subtask.parentId,
          index: index,
          siblingCount: siblingCount,
        })}
        onLongPress={(pointerX, pointerY) =>
          startMove({
            taskId: subtask.id,
            fromKey: group.key,
            pointerX: pointerX,
            pointerY: pointerY,
          })
        }
      />
    );
  }

  function dropAt({
    parentId,
    index,
    siblingCount,
  }: {
    parentId: number | null;
    index: number;
    siblingCount: number;
  }): "before" | "after" | undefined {
    if (!move || move.parentId !== parentId) {
      return undefined;
    }
    if (move.index === index) {
      return "before";
    }
    return move.index >= siblingCount && index === siblingCount - 1
      ? "after"
      : undefined;
  }

  function newSubtaskRow(parent: Task): ReactNode {
    const siblingCount = (parent.subtasks ?? []).length;
    return (
      <NewSubtaskRow
        parent={parent}
        actions={actions}
        index={siblingCount}
        dropAt={dropAt({
          parentId: parent.id,
          index: siblingCount,
          siblingCount: siblingCount + 1,
        })}
      />
    );
  }

  function taskRow(
    task: CreatedTask,
    group: TaskGroup,
    index: number,
  ): ReactNode {
    return (
      <div
        className="task-shell"
        data-row="true"
        data-task={task.id}
        data-group={group.key}
        data-index={index}
        data-moving={move?.taskId === task.id}
        data-drop={dropAt({
          parentId: null,
          index: index,
          siblingCount: group.tasks.length,
        })}
        data-focused={focusedId === task.id}
        onMouseEnter={() => hoverOn(task.id)}
        onMouseLeave={() => hoverOn(null)}
      >
        <Row
          task={{
            ...task,
            ...held.get(task.id),
            subtasks: task.subtasks,
          }}
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
            if (!("state" in changes)) {
              land(task.id);
            }
          }}
          onInfoOpen={() => actions.open(task)}
          onFocusNext={() =>
            focusAt(shown.findIndex((row) => row.id === task.id) + 1)
          }
          onTab={(backwards) =>
            editBeside(task.id, backwards ? -1 : 1)
          }
          onAddSubtask={() => addSubtaskTo(task.id)}
          onCopy={() => copy(task)}
          swipeLeft={{
            name: leftSwipeLabel(task),
            action: () => actions.swipeLeft(task),
          }}
          swipeRight={
            rightSwipeLabel(task)
              ? {
                  name: rightSwipeLabel(task),
                  action: () => actions.swipeRight(task),
                }
              : undefined
          }
          onLongPress={(pointerX, pointerY) =>
            startMove({
              taskId: task.id,
              fromKey: group.key,
              pointerX: pointerX,
              pointerY: pointerY,
            })
          }
          showAttributes={true}
          hiddenAttributes={group.hiddenAttributes}
          expanded={expanded.has(task.id)}
          onExpandedChange={(open) => expand(task.id, open)}
          renderSubtask={(child, childIndex) =>
            subtaskRow(
              child,
              childIndex,
              group,
              (task.subtasks ?? []).length,
            )
          }
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
      <Row
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
    <div
      className="board"
      key={view.layout}
      data-layout={view.layout}
      ref={boardRef}
    >
      {groups.map((group) => (
        <GroupedTasks
          key={group.key}
          group={group}
          renderTask={taskRow}
          renderCapture={captureRow}
          canCapture={captureSeed !== null}
          seed={{
            ...asChanges(group.guessedAttributes),
            ...captureSeed,
            ...asChanges(group.groupedBy),
          }}
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
        />
      ))}

      {captureSeed !== null && groups.length === 0 && (
        <div className="tasks board-capture">
          {captureRow({
            seed: capturing ? {} : (captureSeed ?? {}),
            onCreated: land,
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

function GroupedTasks({
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
}: {
  group: TaskGroup;
  renderTask: (
    task: CreatedTask,
    group: TaskGroup,
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
}) {
  const capturable = canCapture && group.key !== HIDDEN_GROUP;

  return (
    <div className="group" data-group-key={group.key}>
      <Collapsible
        tone="group"
        label={group.label}
        badge={
          collapsed && (
            <span className="group-count">{group.tasks.length}</span>
          )
        }
        open={!collapsed}
        onToggle={onToggleCollapsed}
      >
        <div>
          <div className="tasks">
            {group.tasks.map((task, index) => (
              <div key={task.id}>{renderTask(task, group, index)}</div>
            ))}
            {capturable &&
              capturingUnseeded &&
              renderCapture({
                seed: asChanges(group.guessedAttributes),
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
      </Collapsible>
    </div>
  );
}

export function rightSwipeLabel(task: CreatedTask): string {
  if (task.state === "archived") {
    return "Delete";
  }
  if (task.state === "hidden") {
    return "Unhide";
  }
  if (task.recurringTaskId) {
    return canSkip(task) ? "Skip" : "";
  }
  return isDueToday(task.dueDate) ? "Skip" : "Hide";
}

function canSkip(task: CreatedTask): boolean {
  return (
    task.dueDate !== null &&
    task.dueDate <= todayAsDateString()
  );
}

export function leftSwipeLabel(task: CreatedTask): string {
  return task.state === "archived" ? "Unarchive" : "Archive";
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

const HOLD_TO_EXPAND_MILLISECONDS = 600;

interface Move {
  taskId: number;
  fromKey: string;
  toKey: string;
  parentId: number | null;
  index: number;
}

function useMoveTask({
  groups,
  boardRef,
  onMove,
  onNest,
  onExpand,
}: {
  groups: TaskGroup[];
  boardRef: RefObject<HTMLDivElement | null>;
  onMove: (
    taskId: number,
    destinationAttributes: Attribute[],
    orderedIds: number[],
  ) => void;
  onNest: (
    taskId: number,
    parentId: number,
    orderedIds: number[],
  ) => void;
  onExpand: (taskId: number) => void;
}): {
  move: Move | null;
  startMove: (start: {
    taskId: number;
    fromKey: string;
    pointerX: number;
    pointerY: number;
  }) => void;
} {
  const [move, setMove] = useState<Move | null>(null);
  const moveRef = useRef<Move | null>(null);
  const finishLatest = useRef<() => void>(() => {});
  const dwelling = useRef<{
    taskId: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  function droppableRows(pointerX: number): HTMLElement[] {
    return [
      ...(boardRef.current?.querySelectorAll<HTMLElement>(
        "[data-row]",
      ) ?? []),
    ].filter((row) => {
      const box = headerOf(row).getBoundingClientRect();
      return (
        onScreen(row) &&
        pointerX >= box.left &&
        pointerX <= box.right
      );
    });
  }

  function headerOf(row: HTMLElement): HTMLElement {
    return row.querySelector<HTMLElement>(".task") ?? row;
  }

  function onScreen(row: HTMLElement): boolean {
    return (
      headerOf(row).getBoundingClientRect().height > 0 &&
      row.closest('.collapsible[data-open="false"]') === null
    );
  }

  function placeNear(
    row: HTMLElement,
    after: boolean,
    taskId: number,
    fromKey: string,
  ): Move {
    const parent = row.dataset.parent;
    return {
      taskId: taskId,
      fromKey: fromKey,
      toKey: row.dataset.group ?? fromKey,
      parentId: parent === undefined ? null : Number(parent),
      index: Number(row.dataset.index ?? 0) + (after ? 1 : 0),
    };
  }

  function placeAt(
    pointerX: number,
    pointerY: number,
    taskId: number,
    fromKey: string,
  ): Move {
    const rows = droppableRows(pointerX);

    for (const row of rows) {
      const box = headerOf(row).getBoundingClientRect();
      if (pointerY < box.top + box.height / 2) {
        return placeNear(row, false, taskId, fromKey);
      }
    }

    const last = rows.at(-1);
    if (last) {
      return placeNear(last, true, taskId, fromKey);
    }

    return {
      taskId: taskId,
      fromKey: fromKey,
      toKey: emptyGroupUnder(pointerX) ?? fromKey,
      parentId: null,
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

  function everyTask(): CreatedTask[] {
    const walk = (list: CreatedTask[]): CreatedTask[] =>
      list.flatMap((task) => [task, ...walk(task.subtasks ?? [])]);
    return walk(groups.flatMap((group) => group.tasks));
  }

  function stopDwelling(): void {
    if (dwelling.current) {
      clearTimeout(dwelling.current.timer);
      dwelling.current = null;
    }
  }

  function considerExpanding(
    pointerX: number,
    pointerY: number,
  ): void {
    const under = droppableRows(pointerX).find((row) => {
      const box = headerOf(row).getBoundingClientRect();
      return pointerY >= box.top && pointerY <= box.bottom;
    });
    const openSubtasks = under
      ?.querySelector("[data-subtasks]")
      ?.closest('.collapsible[data-open="true"]');
    const shutId =
      under &&
      under.dataset.parent === undefined &&
      under.dataset.task !== undefined &&
      !openSubtasks
        ? Number(under.dataset.task)
        : null;

    if (shutId === null) {
      stopDwelling();
      return;
    }
    if (dwelling.current?.taskId === shutId) {
      return;
    }
    stopDwelling();
    dwelling.current = {
      taskId: shutId,
      timer: setTimeout(() => {
        dwelling.current = null;
        onExpand(shutId);
      }, HOLD_TO_EXPAND_MILLISECONDS),
    };
  }

  function siblingsAfterDrop(dropped: Move): number[] {
    const parent =
      dropped.parentId === null
        ? null
        : everyTask().find((task) => task.id === dropped.parentId);
    const siblings =
      dropped.parentId === null
        ? (groups.find((group) => group.key === dropped.toKey)
            ?.tasks ?? [])
        : (parent?.subtasks ?? []);

    const ids = siblings
      .map((task) => task.id)
      .filter((id) => id !== dropped.taskId);
    ids.splice(
      Math.min(dropped.index, ids.length),
      0,
      dropped.taskId,
    );
    return ids;
  }

  function finishMove(): void {
    const dropped = moveRef.current;
    moveRef.current = null;
    stopDwelling();
    setMove(null);
    if (!dropped) {
      return;
    }

    const ids = siblingsAfterDrop(dropped);

    if (dropped.parentId !== null) {
      onNest(dropped.taskId, dropped.parentId, ids);
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

    const moving = everyTask().find(
      (task) => task.id === dropped.taskId,
    );
    const conferred: Attribute[] =
      target.key === source.key
        ? []
        : [...target.guessedAttributes, ...target.groupedBy];
    const destinationAttributes: Attribute[] =
      conferred.some((attribute) => attribute.field === "tag") &&
      moving
        ? [
            ...conferred,
            ...moving.tags.map((tag) => ({
              field: "tag" as const,
              value: tag,
              label: tag,
            })),
          ]
        : conferred;

    const cameFromASubtask = moving?.parentId != null;
    const unchanged =
      !cameFromASubtask &&
      target.key === source.key &&
      target.tasks.every((task, index) => task.id === ids[index]);

    if (!unchanged) {
      onMove(dropped.taskId, destinationAttributes, ids);
    }
  }

  useEffect(() => {
    finishLatest.current = finishMove;
  });

  function startMove({
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
      considerExpanding(atX, atY);
      const next = placeAt(atX, atY, taskId, fromKey);
      moveRef.current = next;
      setMove(next);
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

  return { move: move, startMove: startMove };
}

function useRowFocus({
  shown,
  boardRef,
}: {
  shown: CreatedTask[];
  boardRef: RefObject<HTMLDivElement | null>;
}): {
  focusedId: number | null;
  focusAt: (index: number) => void;
  focusStep: (step: number) => void;
  focusOn: (taskId: number | null) => void;
  hoverOn: (taskId: number | null) => void;
  land: (taskId: number) => void;
} {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [landingId, setLandingId] = useState<number | null>(null);
  const lastFocusedId = useRef<number | null>(null);
  const followingPointer = useRef(true);
  const pointerX = useRef<number | null>(null);
  const pointerY = useRef<number | null>(null);

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
    requestAnimationFrame(() => {
      const landed = boardRef.current?.querySelector(
        `[data-task="${landingId}"]`,
      );
      if (landed) {
        easeToTop(landed);
      }
    });
  }, [landingId, shown, boardRef]);

  useEffect(() => {
    function pressed(): void {
      followingPointer.current = false;
    }
    function moved(event: PointerEvent): void {
      if (
        event.clientX === pointerX.current &&
        event.clientY === pointerY.current
      ) {
        return;
      }
      pointerX.current = event.clientX;
      pointerY.current = event.clientY;
      followingPointer.current = true;
    }
    window.addEventListener("keydown", pressed);
    window.addEventListener("pointermove", moved);
    return () => {
      window.removeEventListener("keydown", pressed);
      window.removeEventListener("pointermove", moved);
    };
  }, []);

  function focusOn(taskId: number | null): void {
    if (taskId !== null) {
      lastFocusedId.current = taskId;
    }
    setFocusedId(taskId);
  }

  function hoverOn(taskId: number | null): void {
    if (!followingPointer.current) {
      return;
    }
    focusOn(taskId);
  }

  function focusAt(index: number): void {
    const task =
      shown[Math.min(Math.max(index, 0), shown.length - 1)];
    if (!task) {
      return;
    }
    focusOn(task.id);
    boardRef.current
      ?.querySelector(`[data-task="${task.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function focusStep(step: number): void {
    if (focusedId !== null) {
      focusAt(focusedIndex + step);
      return;
    }
    const resuming = shown.findIndex(
      (task) => task.id === lastFocusedId.current,
    );
    focusAt(resuming === -1 ? 0 : resuming + step);
  }

  return {
    focusedId: focusedId,
    focusAt: focusAt,
    focusStep: focusStep,
    focusOn: focusOn,
    hoverOn: hoverOn,
    land: setLandingId,
  };
}
