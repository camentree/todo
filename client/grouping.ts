import { parseISO } from "date-fns";

import type { BoardGroup } from "./components/TaskBoard.tsx";
import { formatDueDate } from "./format.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import type { Task, ViewPreference } from "@shared/types.ts";

export function buildGroups({
  tasks,
  view,
  lists,
  settling,
}: {
  tasks: Task[];
  view: ViewPreference;
  lists: string[];
  settling?: Set<number>;
}): BoardGroup[] {
  const sorted = sortTasks({
    tasks: tasks,
    view: view,
    settling: settling,
  });

  if (view.breakUpBy === "none") {
    return [{ key: "all", label: "", tasks: sorted }];
  }

  if (view.breakUpBy === "list") {
    return lists
      .map((list) => ({
        key: `list-${list}`,
        label: list,
        list: list,
        tasks: sorted.filter((task) => task.list === list),
      }))
      .filter((group) => group.tasks.length > 0);
  }

  if (view.breakUpBy === "stage") {
    return TASK_STAGES.map((stage) => ({
      key: `stage-${stage}`,
      label: stageLabel(stage),
      stage: stage,
      omitFromMeta: "stage" as const,
      tasks: sorted.filter((task) => stageOf(task) === stage),
    })).filter((group) => group.tasks.length > 0);
  }

  const buckets = new Map<string, Task[]>();
  const rank = new Map<string, string | null>();
  for (const task of sorted) {
    for (const label of labelsFor({
      task: task,
      breakUpBy: view.breakUpBy,
    })) {
      const existing = buckets.get(label);
      if (existing) {
        existing.push(task);
      } else {
        buckets.set(label, [task]);
        rank.set(
          label,
          rankFor({
            task: task,
            breakUpBy: view.breakUpBy,
            label: label,
          }),
        );
      }
    }
  }

  const backwards =
    view.breakUpBy === "due_date" && view.sortDirection === "desc";

  const entries = [...buckets.entries()].sort(([left], [right]) => {
    const leftRank = rank.get(left) ?? null;
    const rightRank = rank.get(right) ?? null;
    if (leftRank === null || rightRank === null) {
      return leftRank === rightRank ? 0 : leftRank === null ? 1 : -1;
    }
    const order = leftRank.localeCompare(rightRank);
    return backwards ? -order : order;
  });

  return entries.map(([label, grouped]) => ({
    key: `${view.breakUpBy}-${label}`,
    label: label,
    omitFromMeta: view.breakUpBy,
    tasks: grouped,
  }));
}

function stageOf(task: Task): TaskStage {
  if (task.state === "complete") {
    return "complete";
  }
  return task.stage ?? "to_do";
}

function sinks(task: Task): boolean {
  return isTerminal(task.state) || task.state === "hidden";
}

export function sortTasks({
  tasks,
  view,
  settling = new Set<number>(),
}: {
  tasks: Task[];
  view: ViewPreference;
  settling?: Set<number>;
}): Task[] {
  const direction = view.sortDirection === "desc" ? -1 : 1;

  return [...tasks].sort((left, right) => {
    const leftDone = sinks(left) && !settling.has(left.id);
    const rightDone = sinks(right) && !settling.has(right.id);
    if (leftDone !== rightDone) {
      return leftDone ? 1 : -1;
    }
    return (
      compare({ left: left, right: right, view: view }) * direction
    );
  });
}

function compare({
  left,
  right,
  view,
}: {
  left: Task;
  right: Task;
  view: ViewPreference;
}): number {
  if (view.sortBy === "title") {
    return left.title.localeCompare(right.title);
  }
  if (view.sortBy === "created_at") {
    return (
      parseISO(left.createdAt).getTime() -
      parseISO(right.createdAt).getTime()
    );
  }
  if (view.sortBy === "resolved_at") {
    if (!left.resolvedAt && !right.resolvedAt) {
      return left.sortOrder - right.sortOrder;
    }
    if (!left.resolvedAt) return 1;
    if (!right.resolvedAt) return -1;
    return left.resolvedAt.localeCompare(right.resolvedAt);
  }
  if (view.sortBy === "due_date") {
    if (!left.dueDate && !right.dueDate) {
      return left.sortOrder - right.sortOrder;
    }
    if (!left.dueDate) return 1;
    if (!right.dueDate) return -1;
    return left.dueDate.localeCompare(right.dueDate);
  }
  return left.sortOrder - right.sortOrder;
}

function rankFor({
  task,
  breakUpBy,
  label,
}: {
  task: Task;
  breakUpBy: ViewPreference["breakUpBy"];
  label: string;
}): string | null {
  if (breakUpBy === "due_date") {
    return task.dueDate;
  }
  if (breakUpBy === "who") {
    return task.who;
  }
  return task.tags.length > 0 ? label : null;
}

function labelsFor({
  task,
  breakUpBy,
}: {
  task: Task;
  breakUpBy: ViewPreference["breakUpBy"];
}): string[] {
  if (breakUpBy === "tag") {
    return task.tags.length > 0 ? task.tags : ["No tag"];
  }
  if (breakUpBy === "who") {
    return [task.who ?? "Nobody"];
  }
  return [formatDueDate(task.dueDate) ?? "No date"];
}
