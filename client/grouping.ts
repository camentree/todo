import { parseISO } from "date-fns";

import { HIDDEN_GROUP } from "./components/TaskBoard.tsx";
import type {
  BoardGroup,
  AttributeOmission,
} from "./components/TaskBoard.tsx";
import { formatDueDate } from "./format.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

export function buildGroups({
  tasks,
  view,
  lists,
  omitAttributes = [],
  showFinished = false,
}: {
  tasks: CreatedTask[];
  view: ViewPreference;
  lists: string[];
  omitAttributes?: AttributeOmission[];
  showFinished?: boolean;
}): BoardGroup[] {
  const sorted = sortTasks({ tasks: tasks, view: view });

  const screenWide = omitAttributes;
  const setAside = (task: CreatedTask) =>
    !showFinished && putAway(task);
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
      omitAttributes: screenWide,
      tasks: hidden,
    },
  ];
}

function putAway(task: CreatedTask): boolean {
  return task.state === "hidden" || isTerminal(task.state);
}

function groupsOf({
  sorted,
  view,
  lists,
  screenWide,
}: {
  sorted: CreatedTask[];
  view: ViewPreference;
  lists: string[];
  screenWide: AttributeOmission[];
}): BoardGroup[] {
  if (view.breakUpBy === "none") {
    return [
      {
        key: "all",
        label: "",
        omitAttributes: screenWide,
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
        seed: { list: list },
        omitAttributes: [
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
      seed: { stage: stage },
      omitAttributes: [
        ...screenWide,
        { field: "stage" as const, label: stageLabel(stage) },
      ],
      tasks: sorted.filter((task) => stageOf(task) === stage),
    })).filter((group) => group.tasks.length > 0);
  }

  const breakUpBy = view.breakUpBy;
  const buckets = new Map<string, CreatedTask[]>();
  const rank = new Map<string, string | null>();
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
    seed: seedFor({ breakUpBy: breakUpBy, label: label }),
    omitAttributes: [
      ...screenWide,
      { field: breakUpBy, label: label },
    ],
    tasks: grouped,
  }));
}

function seedFor({
  breakUpBy,
  label,
}: {
  breakUpBy: ViewPreference["breakUpBy"];
  label: string;
}): Partial<Task> {
  if (breakUpBy === "due_date") {
    return { dueDate: label };
  }
  if (breakUpBy === "who") {
    return { who: label };
  }
  if (breakUpBy === "tag") {
    return { tags: [label] };
  }
  return {};
}

function stageOf(task: CreatedTask): TaskStage {
  if (task.state === "complete") {
    return "complete";
  }
  return task.stage ?? "to_do";
}

function sinks(task: CreatedTask): boolean {
  return isTerminal(task.state) || task.state === "hidden";
}

export function sortTasks({
  tasks,
  view,
}: {
  tasks: CreatedTask[];
  view: ViewPreference;
}): CreatedTask[] {
  if (view.sortBy === "relevance") {
    return tasks;
  }

  const direction = view.sortDirection === "desc" ? -1 : 1;

  return [...tasks].sort((left, right) => {
    const leftDone = sinks(left);
    const rightDone = sinks(right);
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
  left: CreatedTask;
  right: CreatedTask;
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
  task: CreatedTask;
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
  task: CreatedTask;
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
