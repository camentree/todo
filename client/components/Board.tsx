import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Row } from "./Row.tsx";
import { NewSubtaskRow, SubtaskRow } from "./Subtasks.tsx";
import { leftSwipe, rightSwipes } from "../tasks/swipes.ts";
import type { SwipeHandlers } from "../tasks/swipes.ts";
import { buildGroups, COMPLETED_GROUP } from "../tasks/grouping.ts";
import type { TaskGroup } from "../tasks/grouping.ts";
import { useMoveTask } from "../hooks/useMoveTask.ts";
import { useRowFocus } from "../hooks/useRowFocus.ts";
import { Collapsible } from "./ui/Collapsible.tsx";
import { usePending } from "../data/pending.ts";
import { useFoldedGroups } from "../data/settings.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { renameChanges, taskAsLine } from "../tasks/taskLine.ts";
import { asChanges } from "../tasks/attributes.ts";
import type { Attribute } from "../tasks/attributes.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

export interface RowActions extends SwipeHandlers {
  toggle: (task: CreatedTask) => void;
  open: (task: CreatedTask) => void;
  search: (term: string) => void;
  rename: (task: CreatedTask, changes: Partial<Task>) => void;
  create: (changes: Partial<Task>) => Promise<CreatedTask>;
  remove: (task: CreatedTask) => void;
  reparent: (task: CreatedTask, parentId: number | null) => void;
  undo: () => void;
  redo: () => void;
}

export interface BoardProps {
  tasks: CreatedTask[];
  screen: string;
  view: ViewPreference;
  lists: string[];
  hiddenAttributes: Attribute[];
  showFinished: boolean;
  pending: boolean;
  emptyMessage: string;
  actions: RowActions;
  canCompose: boolean;
  onCompose: (seed: Partial<Task>) => void;
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
  screen,
  view,
  lists,
  hiddenAttributes,
  showFinished,
  pending,
  emptyMessage,
  actions,
  canCompose,
  onCompose,
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

  const [editingId, setEditingId] = useState<number | null>(null);
  const [collapsed, toggleCollapsed] = useFoldedGroups(screen, [
    COMPLETED_GROUP,
  ]);
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
        onInfoOpen={() => actions.open(subtask)}
        onTab={(backwards) =>
          editBeside(subtask.id, backwards ? -1 : 1)
        }
        moving={move?.taskId === subtask.id}
        dropAt={dropAt({
          parentId: subtask.parentId,
          index: index,
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
    groupKey,
    parentId,
    index,
    last = false,
  }: {
    groupKey?: string;
    parentId: number | null;
    index: number;
    last?: boolean;
  }): "before" | "after" | undefined {
    if (!move || move.parentId !== parentId) {
      return undefined;
    }
    if (parentId === null && move.toKey !== groupKey) {
      return undefined;
    }
    if (move.index === index) {
      return "before";
    }
    return last && move.index > index ? "after" : undefined;
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
          groupKey: group.key,
          parentId: null,
          index: index,
          last: index === group.tasks.length - 1,
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
          onSearch={actions.search}
          onFocusNext={() =>
            focusAt(shown.findIndex((row) => row.id === task.id) + 1)
          }
          onTab={(backwards) =>
            editBeside(task.id, backwards ? -1 : 1)
          }
          onAddSubtask={() => addSubtaskTo(task.id)}
          onCopy={() => copy(task)}
          swipeLeft={leftSwipe(task, actions)}
          swipeRight={rightSwipes(task, actions)}
          onLongPress={(pointerX, pointerY) =>
            startMove({
              taskId: task.id,
              fromKey: group.key,
              pointerX: pointerX,
              pointerY: pointerY,
            })
          }
          showAttributes={true}
          hiddenAttributes={[
            ...group.hiddenAttributes,
            ...sharedAcross(group),
          ]}
          expanded={expanded.has(task.id)}
          onExpandedChange={(open) => expand(task.id, open)}
          renderSubtask={(child, childIndex) =>
            subtaskRow(child, childIndex, group)
          }
          renderNewSubtask={newSubtaskRow}
        />
      </div>
    );
  }

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
    <div className="board" ref={boardRef}>
      {groups.map((group) => (
        <GroupedTasks
          key={group.key}
          group={group}
          renderTask={taskRow}
          canCompose={canCompose}
          onCompose={() =>
            onCompose({
              ...asChanges(group.guessedAttributes),
              ...asChanges(group.groupedBy),
            })
          }
          collapsed={collapsed.has(group.key)}
          onToggleCollapsed={() => toggleCollapsed(group.key)}
        />
      ))}
    </div>
  );
}

function sharedAcross(group: TaskGroup): Attribute[] {
  return group.label && group.tasks.length > 1
    ? group.guessedAttributes
    : [];
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
  canCompose,
  onCompose,
  collapsed,
  onToggleCollapsed,
}: {
  group: TaskGroup;
  renderTask: (
    task: CreatedTask,
    group: TaskGroup,
    index: number,
  ) => ReactNode;
  canCompose: boolean;
  onCompose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const composable = canCompose && group.key !== COMPLETED_GROUP;
  const shared = sharedAcross(group);

  return (
    <div className="group" data-group-key={group.key}>
      <Collapsible
        tone="group"
        label={
          group.label && (
            <>
              {group.label}
              {shared.length > 0 && (
                <span className="group-shared">
                  {shared
                    .map((attribute) => attribute.label.toLowerCase())
                    .join(" · ")}
                </span>
              )}
            </>
          )
        }
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
              <div key={task.id}>
                {renderTask(task, group, index)}
              </div>
            ))}
            {composable && (
              <button
                type="button"
                className="capture-space"
                aria-label={`Add to ${group.label || "this list"}`}
                onClick={onCompose}
              />
            )}
          </div>
        </div>
      </Collapsible>
    </div>
  );
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
