import { parseISO } from "date-fns";

import type { HiddenAttribute, TaskGroup } from "./types.ts";
import { formatDueDate } from "./format.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import { canonicalName } from "@shared/names.ts";
import { isTerminal } from "@shared/states.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

export const HIDDEN_GROUP = "hidden";

type GroupBeforeGuessing = Omit<TaskGroup, "guessedAttributes">;

export function buildGroups({
  tasks,
  view,
  lists,
  hiddenAttributes = [],
  showFinished = false,
}: {
  tasks: CreatedTask[];
  view: ViewPreference;
  lists: string[];
  hiddenAttributes?: HiddenAttribute[];
  showFinished?: boolean;
}): TaskGroup[] {
  const sorted = sortTasks({ tasks: tasks, view: view });

  const screenWide = hiddenAttributes;
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
    return groups.map(withGuesses);
  }

  return [
    ...groups,
    {
      key: HIDDEN_GROUP,
      label: "Hidden",
      groupedBy: {},
      hiddenAttributes: screenWide,
      tasks: hidden,
    },
  ].map(withGuesses);
}

function withGuesses(group: GroupBeforeGuessing): TaskGroup {
  const [first, ...rest] = group.tasks;
  if (!first) {
    return { ...group, guessedAttributes: {} };
  }

  const guessed: Partial<Task> = {};
  if (
    group.groupedBy.list === undefined &&
    rest.every((task) => task.list === first.list)
  ) {
    guessed.list = first.list;
  }
  if (
    group.groupedBy.who === undefined &&
    first.who !== null &&
    rest.every((task) => task.who === first.who)
  ) {
    guessed.who = first.who;
  }
  if (
    group.groupedBy.stage === undefined &&
    first.stage !== null &&
    rest.every((task) => task.stage === first.stage)
  ) {
    guessed.stage = first.stage;
  }

  const alreadyGrouping = group.groupedBy.tags ?? [];
  const sharedTags = first.tags.filter(
    (tag) =>
      !holdsTag(alreadyGrouping, tag) &&
      rest.every((task) => holdsTag(task.tags, tag)),
  );
  if (sharedTags.length > 0) {
    guessed.tags = sharedTags;
  }

  return { ...group, guessedAttributes: guessed };
}

export function mergeTags(
  existing: string[],
  added: string[],
): string[] {
  return [
    ...existing,
    ...added.filter((tag) => !holdsTag(existing, tag)),
  ];
}

function holdsTag(tags: string[], wanted: string): boolean {
  return tags.some(
    (tag) => canonicalName(tag) === canonicalName(wanted),
  );
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
  screenWide: HiddenAttribute[];
}): GroupBeforeGuessing[] {
  if (view.groupBy === "none") {
    return [
      {
        key: "all",
        label: "",
        groupedBy: {},
        hiddenAttributes: screenWide,
        tasks: sorted,
      },
    ];
  }

  if (view.groupBy === "list") {
    const everyList = [
      ...new Set([...lists, ...sorted.map((task) => task.list)]),
    ];
    return everyList
      .map((list) => ({
        key: `list-${list}`,
        label: list,
        groupedBy: { list: list },
        hiddenAttributes: [
          ...screenWide,
          { field: "list" as const, label: list },
        ],
        tasks: sorted.filter((task) => task.list === list),
      }))
      .filter((group) => group.tasks.length > 0);
  }

  if (view.groupBy === "stage") {
    return TASK_STAGES.map((stage) => ({
      key: `stage-${stage}`,
      label: stageLabel(stage),
      groupedBy: { stage: stage },
      hiddenAttributes: [
        ...screenWide,
        { field: "stage" as const, label: stageLabel(stage) },
      ],
      tasks: sorted.filter((task) => stageOf(task) === stage),
    })).filter((group) => group.tasks.length > 0);
  }

  const groupBy = view.groupBy;
  const buckets = new Map<string, CreatedTask[]>();
  const rank = new Map<string, string | null>();
  const groupedByForLabel = new Map<string, Partial<Task>>();
  for (const task of sorted) {
    for (const label of labelsFor({
      task: task,
      groupBy: groupBy,
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
            groupBy: groupBy,
            label: label,
          }),
        );
        groupedByForLabel.set(
          label,
          groupedByFor({
            task: task,
            groupBy: groupBy,
            label: label,
          }),
        );
      }
    }
  }

  const backwards =
    groupBy === "due_date" && view.orderDirection === "desc";

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
    key: `${groupBy}-${label}`,
    label: label,
    groupedBy: groupedByForLabel.get(label) ?? {},
    hiddenAttributes: [...screenWide, { field: groupBy, label: label }],
    tasks: grouped,
  }));
}

function groupedByFor({
  task,
  groupBy,
  label,
}: {
  task: CreatedTask;
  groupBy: ViewPreference["groupBy"];
  label: string;
}): Partial<Task> {
  if (groupBy === "due_date") {
    return { dueDate: task.dueDate };
  }
  if (groupBy === "who") {
    return { who: task.who };
  }
  return { tags: task.tags.length > 0 ? [label] : [] };
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
  if (view.orderBy === "relevance") {
    return tasks;
  }

  const direction = view.orderDirection === "desc" ? -1 : 1;

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
  if (view.orderBy === "title") {
    return left.title.localeCompare(right.title);
  }
  if (view.orderBy === "created_at") {
    return (
      parseISO(left.createdAt).getTime() -
      parseISO(right.createdAt).getTime()
    );
  }
  if (view.orderBy === "resolved_at") {
    if (!left.resolvedAt && !right.resolvedAt) {
      return left.sortOrder - right.sortOrder;
    }
    if (!left.resolvedAt) return 1;
    if (!right.resolvedAt) return -1;
    return left.resolvedAt.localeCompare(right.resolvedAt);
  }
  if (view.orderBy === "due_date") {
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
  groupBy,
  label,
}: {
  task: CreatedTask;
  groupBy: ViewPreference["groupBy"];
  label: string;
}): string | null {
  if (groupBy === "due_date") {
    return task.dueDate;
  }
  if (groupBy === "who") {
    return task.who;
  }
  return task.tags.length > 0 ? label : null;
}

function labelsFor({
  task,
  groupBy,
}: {
  task: CreatedTask;
  groupBy: ViewPreference["groupBy"];
}): string[] {
  if (groupBy === "tag") {
    return task.tags.length > 0 ? task.tags : ["No tag"];
  }
  if (groupBy === "who") {
    return [task.who ?? "Nobody"];
  }
  return [formatDueDate(task.dueDate) ?? "No date"];
}
