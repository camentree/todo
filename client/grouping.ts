import { parseISO } from "date-fns";

import { HIDDEN_GROUP } from "./components/TaskBoard.tsx";
import type {
  BoardGroup,
  MetaOmission,
} from "./components/TaskBoard.tsx";
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
  scoped,
}: {
  tasks: Task[];
  view: ViewPreference;
  lists: string[];
  settling?: Set<number>;
  scoped?: MetaOmission | null;
}): BoardGroup[] {
  const sorted = sortTasks({
    tasks: tasks,
    view: view,
    settling: settling,
  });

  const screenWide = scoped ? [scoped] : [];
  const held = settling ?? new Set<number>();
  const showingFinished = scoped?.field === "state";
  const setAside = (task: Task) =>
    !showingFinished && putAway(task, held);
  const hidden = sorted.filter(setAside);

  const groups = groupsOf({
    sorted: sorted.filter((task) => !setAside(task)),
    view: view,
    lists: lists,
    screenWide: screenWide,
  });

  if (hidden.length === 0) {
    return groups;
  }

  return [
    ...groups,
    {
      key: HIDDEN_GROUP,
      label: "Hidden",
      omitFromMeta: screenWide,
      tasks: hidden,
    },
  ];
}

function putAway(task: Task, settling: Set<number>): boolean {
  return (
    (task.state === "hidden" || isTerminal(task.state)) &&
    !settling.has(task.id)
  );
}

function groupsOf({
  sorted,
  view,
  lists,
  screenWide,
}: {
  sorted: Task[];
  view: ViewPreference;
  lists: string[];
  screenWide: MetaOmission[];
}): BoardGroup[] {
  if (view.breakUpBy === "none") {
    return [
      {
        key: "all",
        label: "",
        omitFromMeta: screenWide,
        tasks: sorted,
      },
    ];
  }

  if (view.breakUpBy === "list") {
    return lists
      .map((list) => ({
        key: `list-${list}`,
        label: list,
        list: list,
        prefill: `/${list}`,
        omitFromMeta: [
          ...screenWide,
          { field: "list" as const, label: list },
        ],
        tasks: sorted.filter((task) => task.list === list),
      }))
      .filter((group) => group.tasks.length > 0);
  }

  if (view.breakUpBy === "stage") {
    return TASK_STAGES.map((stage) => ({
      key: `stage-${stage}`,
      label: stageLabel(stage),
      stage: stage,
      prefill: `!${stage}`,
      omitFromMeta: [
        ...screenWide,
        { field: "stage" as const, label: stageLabel(stage) },
      ],
      tasks: sorted.filter((task) => stageOf(task) === stage),
    })).filter((group) => group.tasks.length > 0);
  }

  const breakUpBy = view.breakUpBy;
  const buckets = new Map<string, Task[]>();
  const rank = new Map<string, string | null>();
  const prefill = new Map<string, string | undefined>();
  for (const task of sorted) {
    for (const label of labelsFor({
      task: task,
      breakUpBy: breakUpBy,
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
            breakUpBy: breakUpBy,
            label: label,
          }),
        );
        prefill.set(
          label,
          prefillFor({
            task: task,
            breakUpBy: view.breakUpBy,
            label: label,
          }),
        );
      }
    }
  }

  const backwards =
    breakUpBy === "due_date" && view.sortDirection === "desc";

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
    key: `${breakUpBy}-${label}`,
    label: label,
    prefill: prefill.get(label),
    omitFromMeta: [...screenWide, { field: breakUpBy, label: label }],
    tasks: grouped,
  }));
}

function prefillFor({
  task,
  breakUpBy,
  label,
}: {
  task: Task;
  breakUpBy: ViewPreference["breakUpBy"];
  label: string;
}): string | undefined {
  if (breakUpBy === "due_date") {
    return task.dueDate ?? undefined;
  }
  if (breakUpBy === "who") {
    return task.who ? `@${task.who}` : undefined;
  }
  return task.tags.includes(label) ? `#${label}` : undefined;
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
