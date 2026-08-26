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
  resolvedAt: null,
  archivedAt: null,
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
}

export function SubtaskRow({
  subtask,
  actions,
  editing,
  onEditingChange,
  expanded,
  onExpandedChange,
  onTab,
}: {
  subtask: CreatedTask;
  actions: SubtaskActions;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  onTab?: (backwards: boolean) => void;
}): ReactNode {
  const pending = usePending();

  return (
    <Row
      task={{ ...subtask, ...pending.get(subtask.id) }}
      isEditing={editing}
      onEditingChange={onEditingChange}
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
      showAttributes={false}
      parseAttributes={false}
    />
  );
}

export function NewSubtaskRow({
  parent,
  actions,
}: {
  parent: Task;
  actions: SubtaskActions;
}): ReactNode {
  return (
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
  );
}
