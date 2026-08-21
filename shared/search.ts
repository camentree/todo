import { format } from "date-fns";

import { parse } from "./parser.ts";
import type { Task } from "./types.ts";

const SHORTEST_FUZZY_TERM = 3;

interface SearchCriteria {
  tags: string[];
  who: string[];
  lists: string[];
  stages: string[];
  phrases: string[];
  terms: string[];
  overdue: boolean;
  noDueDate: boolean;
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
  if (isBlank(criteria)) {
    return [];
  }
  const todayText = format(today, "yyyy-MM-dd");
  return tasks.filter((task) =>
    matches({ task: task, criteria: criteria, today: todayText }),
  );
}

function read({
  input,
  today,
}: {
  input: string;
  today: Date;
}): SearchCriteria {
  const criteria: SearchCriteria = {
    tags: [],
    who: [],
    lists: [],
    stages: [],
    phrases: [],
    terms: [],
    overdue: false,
    noDueDate: false,
  };

  const parsed = parse({ input: input, today: today, search: true });

  for (const token of parsed.tokens) {
    if (token.kind === "tag") {
      criteria.tags.push(token.value.toLowerCase());
    } else if (token.kind === "who") {
      criteria.who.push(token.value.toLowerCase());
    } else if (token.kind === "list") {
      criteria.lists.push(token.value.toLowerCase());
    } else if (token.kind === "stage") {
      criteria.stages.push(token.value);
    } else if (token.kind === "phrase") {
      criteria.phrases.push(token.value.toLowerCase());
    } else if (token.kind === "overdue") {
      criteria.overdue = true;
    } else if (token.kind === "noDueDate") {
      criteria.noDueDate = true;
    } else {
      criteria.terms.push(token.text.toLowerCase());
    }
  }

  for (const word of parsed.title.split(/\s+/)) {
    if (word.length === 0) {
      continue;
    }
    if (word.startsWith("!") && word.length > 1) {
      criteria.stages.push(word.slice(1).toLowerCase());
    } else {
      criteria.terms.push(word.toLowerCase());
    }
  }

  return criteria;
}

function isBlank(criteria: SearchCriteria): boolean {
  return (
    !criteria.overdue &&
    !criteria.noDueDate &&
    criteria.tags.length === 0 &&
    criteria.who.length === 0 &&
    criteria.lists.length === 0 &&
    criteria.stages.length === 0 &&
    criteria.phrases.length === 0 &&
    criteria.terms.length === 0
  );
}

function matches({
  task,
  criteria,
  today,
}: {
  task: Task;
  criteria: SearchCriteria;
  today: string;
}): boolean {
  if (
    criteria.overdue &&
    !(task.dueDate !== null && task.dueDate < today)
  ) {
    return false;
  }
  if (criteria.noDueDate && task.dueDate !== null) {
    return false;
  }

  const tags = task.tags.map((tag) => tag.toLowerCase());
  if (
    !criteria.tags.every((wanted) =>
      tags.some((tag) => tag.includes(wanted)),
    )
  ) {
    return false;
  }
  if (
    !criteria.who.every((wanted) =>
      (task.who ?? "").toLowerCase().includes(wanted),
    )
  ) {
    return false;
  }
  if (
    !criteria.lists.every((wanted) =>
      task.list.toLowerCase().includes(wanted),
    )
  ) {
    return false;
  }
  if (
    !criteria.stages.every((wanted) =>
      spaced(task.stage ?? "").includes(spaced(wanted)),
    )
  ) {
    return false;
  }

  const title = task.title.toLowerCase();
  const haystack = [
    title,
    (task.note ?? "").toLowerCase(),
    task.list.toLowerCase(),
    tags.join(" "),
    (task.who ?? "").toLowerCase(),
  ].join(" ");

  if (
    !criteria.phrases.every((phrase) => haystack.includes(phrase))
  ) {
    return false;
  }

  return criteria.terms.every(
    (term) =>
      haystack.includes(term) ||
      (term.length >= SHORTEST_FUZZY_TERM &&
        isSubsequenceOf({ term: term, within: title })),
  );
}

function spaced(value: string): string {
  return value.replace(/[_-]+/g, " ");
}

function isSubsequenceOf({
  term,
  within,
}: {
  term: string;
  within: string;
}): boolean {
  let cursor = 0;
  for (const letter of within) {
    if (letter === term[cursor]) {
      cursor += 1;
      if (cursor === term.length) {
        return true;
      }
    }
  }
  return false;
}
