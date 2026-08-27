import { parseISO } from "date-fns";

import type { Attribute } from "../tasks/attributes.ts";
import { formatDueDate } from "../tasks/format.ts";
import { stageLabel, TASK_STAGES } from "@shared/stages.ts";
import type { TaskStage } from "@shared/stages.ts";
import { canonicalName } from "@shared/names.ts";
import { isTerminal } from "@shared/states.ts";
import type {
  CreatedTask,
  ViewPreference,
} from "@shared/types.ts";

export const HIDDEN_GROUP = "hidden";

export interface TaskGroup {
  key: string;
  label: string;
  groupedBy: Attribute[];
  guessedAttributes: Attribute[];
  hiddenAttributes: Attribute[];
  tasks: CreatedTask[];
}

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
  hiddenAttributes?: Attribute[];
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
      groupedBy: [],
      hiddenAttributes: screenWide,
      tasks: hidden,
    },
  ].map(withGuesses);
}

function withGuesses(group: GroupBeforeGuessing): TaskGroup {
  const [first, ...rest] = group.tasks;
  if (!first) {
    return { ...group, guessedAttributes: [] };
  }

  const grouping = new Set(
    group.groupedBy.map((attribute) => attribute.field),
  );
  const guessed: Attribute[] = [];

  if (
    !grouping.has("list") &&
    rest.every((task) => task.list === first.list)
  ) {
    guessed.push({
      field: "list",
      value: first.list,
      label: first.list,
    });
  }
  if (
    !grouping.has("who") &&
    first.who !== null &&
    rest.every((task) => task.who === first.who)
  ) {
    guessed.push({ field: "who", value: first.who, label: first.who });
  }
  if (
    !grouping.has("stage") &&
    first.stage !== null &&
    rest.every((task) => task.stage === first.stage)
  ) {
    guessed.push({
      field: "stage",
      value: first.stage,
      label: stageLabel(first.stage),
    });
  }

  if (
    !grouping.has("due_date") &&
    first.dueDate !== null &&
    rest.every((task) => task.dueDate === first.dueDate)
  ) {
    guessed.push({
      field: "due_date",
      value: first.dueDate,
      label: formatDueDate(first.dueDate) ?? first.dueDate,
    });
  }
  if (
    !grouping.has("due_time") &&
    first.dueTime !== null &&
    rest.every((task) => task.dueTime === first.dueTime)
  ) {
    guessed.push({
      field: "due_time",
      value: first.dueTime,
      label: first.dueTime,
    });
  }

  const groupingTags = group.groupedBy
    .filter((attribute) => attribute.field === "tag")
    .map((attribute) => attribute.value ?? "");
  for (const tag of first.tags) {
    if (holdsTag(groupingTags, tag)) {
      continue;
    }
    if (!rest.every((task) => holdsTag(task.tags, tag))) {
      continue;
    }
    guessed.push({ field: "tag", value: tag, label: tag });
  }

  return { ...group, guessedAttributes: guessed };
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
  screenWide: Attribute[];
}): GroupBeforeGuessing[] {
  if (view.groupBy === "none") {
    return [
      {
        key: "all",
        label: "",
        groupedBy: [],
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
      .map((list) => {
        const attribute: Attribute = {
          field: "list",
          value: list,
          label: list,
        };
        return {
          key: `list-${list}`,
          label: list,
          groupedBy: [attribute],
          hiddenAttributes: [...screenWide, attribute],
          tasks: sorted.filter((task) => task.list === list),
        };
      })
      .filter((group) => group.tasks.length > 0);
  }

  if (view.groupBy === "stage") {
    return TASK_STAGES.map((stage) => {
      const attribute: Attribute = {
        field: "stage",
        value: stage,
        label: stageLabel(stage),
      };
      return {
        key: `stage-${stage}`,
        label: stageLabel(stage),
        groupedBy: [attribute],
        hiddenAttributes: [...screenWide, attribute],
        tasks: sorted.filter((task) => stageOf(task) === stage),
      };
    }).filter((group) => group.tasks.length > 0);
  }

  const groupBy = view.groupBy;
  const buckets = new Map<string, CreatedTask[]>();
  const rank = new Map<string, string | null>();
  const groupedByForLabel = new Map<string, Attribute[]>();
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

  return entries.map(([label, grouped]) => {
    const grouping = groupedByForLabel.get(label) ?? [];
    return {
      key: `${groupBy}-${label}`,
      label: label,
      groupedBy: grouping,
      hiddenAttributes: [...screenWide, ...grouping],
      tasks: grouped,
    };
  });
}

function groupedByFor({
  task,
  groupBy,
  label,
}: {
  task: CreatedTask;
  groupBy: ViewPreference["groupBy"];
  label: string;
}): Attribute[] {
  if (groupBy === "due_date") {
    return [
      { field: "due_date", value: task.dueDate, label: label },
    ];
  }
  if (groupBy === "who") {
    return [{ field: "who", value: task.who, label: label }];
  }
  return [
    {
      field: "tag",
      value: task.tags.length > 0 ? label : null,
      label: label,
    },
  ];
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
  if (view.orderBy === "finished_at") {
    if (!left.finishedAt && !right.finishedAt) {
      return left.sortOrder - right.sortOrder;
    }
    if (!left.finishedAt) return 1;
    if (!right.finishedAt) return -1;
    return left.finishedAt.localeCompare(right.finishedAt);
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
