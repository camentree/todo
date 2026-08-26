import {
  dueDateIn,
  dueTimeIn,
  listIn,
  parse,
  recurrenceIn,
  stageIn,
  stateIn,
  tagsIn,
  whoIn,
} from "@shared/parser.ts";
import { toDateString } from "@shared/recurrence.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

export function taskAsLine(task: CreatedTask): string {
  return [
    task.title,
    ...task.tags.map((tag) => `#${tag}`),
    task.who ? `@${task.who}` : "",
    `/${task.list}`,
    task.stage ? `!${task.stage}` : "",
    task.dueDate ?? "",
    task.dueTime ? task.dueTime.slice(0, 5) : "",
  ]
    .filter((part) => part)
    .join(" ");
}

export function renameChanges(input: string): Partial<Task> {
  const parsed = parse({ input: input, today: new Date() });

  const tags = tagsIn(parsed.tokens);
  const who = whoIn(parsed.tokens);
  const list = listIn(parsed.tokens);
  const stage = stageIn(parsed.tokens);
  const state = stateIn(parsed.tokens);
  const dueDate = dueDateIn(parsed.tokens);
  const dueTime = dueTimeIn(parsed.tokens);
  const recurrence = recurrenceIn(parsed.tokens);
  const startsOn = dueDate ?? toDateString(new Date());

  return {
    title: parsed.title,
    ...(recurrence
      ? {
          schedule: { ...recurrence, startsOn: startsOn },
          dueDate: startsOn,
        }
      : {}),
    ...(tags.length > 0
      ? { tags: tags.filter((tag) => tag.length > 0) }
      : {}),
    ...(who === null ? {} : { who: who === "" ? null : who }),
    ...(list ? { list: list } : {}),
    ...(stage === null ? {} : { stage: stage === "" ? null : stage }),
    ...(state === null || state === "archived"
      ? {}
      : { state: state }),
    ...(state === "archived"
      ? { archivedAt: new Date().toISOString() }
      : {}),
    ...(dueDate ? { dueDate: dueDate } : {}),
    ...(dueTime ? { dueTime: dueTime } : {}),
  };
}
