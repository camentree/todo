import { format } from "date-fns";
import Fuse from "fuse.js";

import { parse } from "./parser.ts";
import type { Task } from "./types.ts";

const MATCHING = {
  threshold: 0.3,
  ignoreLocation: true,
  useExtendedSearch: true,
};

interface Filters {
  tags: string[];
  who: string[];
  lists: string[];
  stages: string[];
  phrases: string[];
  terms: string[];
  overdue: boolean;
  noDueDate: boolean;
}

interface SearchCriteria {
  wanted: Filters;
  unwanted: Filters;
}

export function searchTasks({
  tasks,
  input,
  today,
}: {
  tasks: Task[];
  input: string;
  today: Date;
}): Task[] {
  const criteria = read({ input: input, today: today });
  if (isBlank(criteria.wanted) && isBlank(criteria.unwanted)) {
    return [];
  }

  const todayText = format(today, "yyyy-MM-dd");
  const narrowed = tasks.filter(
    (task) =>
      fits({
        task: task,
        filters: criteria.wanted,
        today: todayText,
      }) &&
      !hits({
        task: task,
        filters: criteria.unwanted,
        today: todayText,
      }),
  );

  const ranked = rankedFor({
    tasks: narrowed,
    terms: criteria.wanted.terms,
  });
  const rejected = new Set(
    rankedFor({ tasks: narrowed, terms: criteria.unwanted.terms }),
  );

  return criteria.unwanted.terms.length === 0
    ? ranked
    : ranked.filter((task) => !rejected.has(task));
}

function rankedFor({
  tasks,
  terms,
}: {
  tasks: Task[];
  terms: string[];
}): Task[] {
  const typed = terms.join(" ");
  if (typed.length === 0) {
    return tasks;
  }

  const byTitle = rankedOn({
    tasks: tasks,
    typed: typed,
    field: "title",
  });
  const byNote = rankedOn({
    tasks: tasks,
    typed: typed,
    field: "note",
  }).filter((task) => !byTitle.includes(task));

  return [...byTitle, ...byNote];
}

function rankedOn({
  tasks,
  typed,
  field,
}: {
  tasks: Task[];
  typed: string;
  field: "title" | "note";
}): Task[] {
  return new Fuse(tasks, { ...MATCHING, keys: [field] })
    .search(typed)
    .map((result) => result.item);
}

function segmentsIn(input: string): string[] {
  return input.match(/-?"[^"]*"?|\S+/g) ?? [];
}

function read({
  input,
  today,
}: {
  input: string;
  today: Date;
}): SearchCriteria {
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const segment of segmentsIn(input)) {
    if (segment.startsWith("-") && segment.length > 1) {
      dropped.push(segment.slice(1));
    } else {
      kept.push(segment);
    }
  }

  return {
    wanted: filtersIn({ input: kept.join(" "), today: today }),
    unwanted: filtersIn({ input: dropped.join(" "), today: today }),
  };
}

function filtersIn({
  input,
  today,
}: {
  input: string;
  today: Date;
}): Filters {
  const filters: Filters = {
    tags: [],
    who: [],
    lists: [],
    stages: [],
    phrases: [],
    terms: [],
    overdue: false,
    noDueDate: false,
  };

  if (input.trim().length === 0) {
    return filters;
  }

  const parsed = parse({ input: input, today: today, search: true });

  for (const token of parsed.tokens) {
    if ("value" in token && token.value === "") {
      continue;
    }
    if (token.kind === "tag") {
      filters.tags.push(token.value.toLowerCase());
    } else if (token.kind === "who") {
      filters.who.push(token.value.toLowerCase());
    } else if (token.kind === "list") {
      filters.lists.push(token.value.toLowerCase());
    } else if (token.kind === "stage") {
      filters.stages.push(token.value);
    } else if (token.kind === "phrase") {
      filters.phrases.push(token.value.toLowerCase());
    } else if (token.kind === "overdue") {
      filters.overdue = true;
    } else if (token.kind === "noDueDate") {
      filters.noDueDate = true;
    } else {
      filters.terms.push(token.text.toLowerCase());
    }
  }

  for (const word of parsed.title.split(/\s+/)) {
    if (word.length === 0) {
      continue;
    }
    if (word.startsWith("!") && word.length > 1) {
      filters.stages.push(word.slice(1).toLowerCase());
    } else {
      filters.terms.push(word.toLowerCase());
    }
  }

  return filters;
}

function isBlank(filters: Filters): boolean {
  return (
    !filters.overdue &&
    !filters.noDueDate &&
    filters.tags.length === 0 &&
    filters.who.length === 0 &&
    filters.lists.length === 0 &&
    filters.stages.length === 0 &&
    filters.phrases.length === 0 &&
    filters.terms.length === 0
  );
}

function isOverdue(task: Task, today: string): boolean {
  return task.dueDate !== null && task.dueDate < today;
}

function tagsOf(task: Task): string[] {
  return task.tags.map((tag) => tag.toLowerCase());
}

function writtenIn(task: Task): string {
  return `${task.title} ${task.note ?? ""}`.toLowerCase();
}

function anyContains(values: string[], wanted: string[]): boolean {
  return wanted.some((needle) =>
    values.some((value) => value.includes(needle)),
  );
}

function fits({
  task,
  filters,
  today,
}: {
  task: Task;
  filters: Filters;
  today: string;
}): boolean {
  if (filters.overdue && !isOverdue(task, today)) {
    return false;
  }
  if (filters.noDueDate && task.dueDate !== null) {
    return false;
  }
  if (
    filters.tags.length > 0 &&
    !anyContains(tagsOf(task), filters.tags)
  ) {
    return false;
  }
  if (
    filters.who.length > 0 &&
    !anyContains([(task.who ?? "").toLowerCase()], filters.who)
  ) {
    return false;
  }
  if (
    filters.lists.length > 0 &&
    !anyContains([task.list.toLowerCase()], filters.lists)
  ) {
    return false;
  }
  if (
    filters.stages.length > 0 &&
    !anyContains(
      [spaced(task.stage ?? "")],
      filters.stages.map(spaced),
    )
  ) {
    return false;
  }
  return filters.phrases.every((phrase) =>
    writtenIn(task).includes(phrase),
  );
}

function hits({
  task,
  filters,
  today,
}: {
  task: Task;
  filters: Filters;
  today: string;
}): boolean {
  if (filters.overdue && isOverdue(task, today)) {
    return true;
  }
  if (filters.noDueDate && task.dueDate === null) {
    return true;
  }
  if (anyContains(tagsOf(task), filters.tags)) {
    return true;
  }
  if (anyContains([(task.who ?? "").toLowerCase()], filters.who)) {
    return true;
  }
  if (anyContains([task.list.toLowerCase()], filters.lists)) {
    return true;
  }
  if (
    anyContains(
      [spaced(task.stage ?? "")],
      filters.stages.map(spaced),
    )
  ) {
    return true;
  }
  return filters.phrases.some((phrase) =>
    writtenIn(task).includes(phrase),
  );
}

function spaced(value: string): string {
  return value.replace(/[_-]+/g, " ");
}
