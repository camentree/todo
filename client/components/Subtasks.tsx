import type { ReactNode } from "react";

import { Row } from "./Row.tsx";
import { usePending } from "../data/pending.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

export const BLANK_TASK: Task = {
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
  finishedAt: null,
  createdAt: "",
  updatedAt: "",
  commentCount: 0,
  schedule: null,
  subtasks: [],
};

export interface SubtaskActions {
  toggle: (task: CreatedTask) => void;
  rename: (task: CreatedTask, changes: Partial<Task>) => void;
  remove: (task: CreatedTask) => void;
  create: (changes: Partial<Task>) => Promise<CreatedTask>;
  reparent: (task: CreatedTask, parentId: number | null) => void;
}

export function SubtaskRow({
  subtask,
  index,
  actions,
  editing,
  onEditingChange,
  onInfoOpen,
  expanded,
  onExpandedChange,
  onTab,
  dropAt,
  moving = false,
  onLongPress,
}: {
  subtask: CreatedTask;
  index: number;
  actions: SubtaskActions;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onInfoOpen?: () => void;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  onTab?: (backwards: boolean) => void;
  dropAt?: "before" | "after";
  moving?: boolean;
  onLongPress?: (pointerX: number, pointerY: number) => void;
}): ReactNode {
  const pending = usePending();

  return (
    <div
      className="task-shell"
      data-row="true"
      data-task={subtask.id}
      data-parent={subtask.parentId ?? undefined}
      data-index={index}
      data-drop={dropAt}
      data-moving={moving}
    >
      <Row
        task={{
          ...subtask,
          ...pending.get(subtask.id),
          subtasks: subtask.subtasks,
        }}
        onLongPress={onLongPress}
        isEditing={editing}
        onEditingChange={onEditingChange}
        onInfoOpen={onInfoOpen}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        onTab={onTab}
        onCommit={(changes) =>
          "state" in changes
            ? actions.toggle(subtask)
            : actions.rename(subtask, changes)
        }
        swipeLeft={{
          name: "Delete",
          action: () => actions.remove(subtask),
        }}
        swipeRight={{
          name: "Own task",
          action: () => actions.reparent(subtask, null),
        }}
        showAttributes={false}
        parseAttributes={false}
      />
    </div>
  );
}

export function NewSubtaskRow({
  parent,
  actions,
  index,
  dropAt,
}: {
  parent: Task;
  actions: SubtaskActions;
  index: number;
  dropAt?: "before" | "after";
}): ReactNode {
  return (
    <div
      className="task-shell"
      data-row="true"
      data-parent={parent.id ?? undefined}
      data-index={index}
      data-drop={dropAt}
    >
      <Row
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
        parseAttributes={false}
      />
    </div>
  );
}
