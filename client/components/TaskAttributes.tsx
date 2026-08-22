import {
  cadenceOf,
  formatDueDate,
  formatDueTime,
} from "../format.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import { parse, type ParsedToken } from "@shared/parser.ts";
import { stageLabel } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

export interface TaskAttribute {
  field: Attribute;
  text: string;
  to?: string;
}

export type DescribedTask = Pick<
  Task,
  | "list"
  | "tags"
  | "who"
  | "dueDate"
  | "dueTime"
  | "stage"
  | "archivedAt"
  | "schedule"
>;

export function typedTask({
  changes,
  list,
}: {
  changes: Partial<Task>;
  list: string;
}): DescribedTask {
  return {
    tags: [],
    who: null,
    dueDate: null,
    dueTime: null,
    stage: null,
    archivedAt: null,
    schedule: null,
    ...changes,
    list: list,
  };
}

export function attributesOf(task: DescribedTask): TaskAttribute[] {
  const archived = task.archivedAt !== null;
  const due = archived ? null : formatDueDate(task.dueDate);
  const time = archived ? null : formatDueTime(task.dueTime);

  const items: (TaskAttribute | null)[] = [
    task.list
      ? {
          field: "list" as const,
          text: task.list,
          to: `/list/${encodeURIComponent(task.list)}`,
        }
      : null,
    ...task.tags.map(
      (tag): TaskAttribute => ({
        field: "tag",
        text: tag,
        to: `/tag/${encodeURIComponent(tag)}`,
      }),
    ),
    task.who
      ? {
          field: "who",
          text: task.who,
          to: `/who/${encodeURIComponent(task.who)}`,
        }
      : null,
    due && task.dueDate
      ? {
          field: "due_date",
          text: due,
          to: `/due_date/${task.dueDate}`,
        }
      : null,
    time && task.dueTime
      ? {
          field: "due_time",
          text: time,
          to: `/due_time/${task.dueTime.slice(0, 5)}`,
        }
      : null,
    task.schedule
      ? {
          field: "recurring",
          text: cadenceOf(task.schedule),
          to: "/recurring/true",
        }
      : null,
    task.stage
      ? {
          field: "stage",
          text: stageLabel(task.stage),
          to: `/stage/${task.stage}`,
        }
      : null,
  ];

  return items.filter((item): item is TaskAttribute => item !== null);
}

export function asRenamed({
  task,
  draft,
}: {
  task: Task;
  draft: string;
}): Task {
  return { ...task, ...renameChanges(draft) };
}

export function AttributeText({ task }: { task: DescribedTask }) {
  const attributes = attributesOf(task);
  if (attributes.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {attributes.map(({ field, text }) => (
        <span key={`${field}-${text}`}>{text.toLowerCase()}</span>
      ))}
    </span>
  );
}

export function AttributeChips({
  task,
  onRemove,
}: {
  task: DescribedTask;
  onRemove?: (attribute: TaskAttribute) => void;
}) {
  const attributes = attributesOf(task);
  if (attributes.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {attributes.map((attribute) =>
        onRemove && attribute.field !== "list" ? (
          <button
            type="button"
            key={`${attribute.field}-${attribute.text}`}
            className="capture-chip removable"
            data-field={attribute.field}
            aria-label={`Remove ${attribute.text}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onRemove(attribute)}
          >
            {sigilFor(attribute.field)}
            {attribute.text.toLowerCase()}
          </button>
        ) : (
          <span
            key={`${attribute.field}-${attribute.text}`}
            className="capture-chip"
            data-field={attribute.field}
          >
            {sigilFor(attribute.field)}
            {attribute.text.toLowerCase()}
          </span>
        ),
      )}
    </span>
  );
}

export function withoutAttribute({
  task,
  draft,
  attribute,
}: {
  task: DescribedTask;
  draft: string;
  attribute: TaskAttribute;
}): { draft: string; changes: Partial<Task> } {
  const spoken = parse({ input: draft, today: new Date() })
    .tokens.filter((token) =>
      saysSo({ token: token, attribute: attribute }),
    )
    .map((token) => token.text);

  return {
    draft: spoken
      .reduce((text, word) => text.split(word).join(" "), draft)
      .replace(/\s+/g, " ")
      .trim(),
    changes: clearing({ task: task, attribute: attribute }),
  };
}

function saysSo({
  token,
  attribute,
}: {
  token: ParsedToken;
  attribute: TaskAttribute;
}): boolean {
  if (attribute.field === "recurring") {
    return token.kind === "recurrence";
  }
  if (attribute.field === "due_date") {
    return token.kind === "dueDate";
  }
  if (attribute.field === "due_time") {
    return token.kind === "dueTime";
  }
  if (attribute.field === "tag") {
    return token.kind === "tag" && token.value === attribute.text;
  }
  return token.kind === attribute.field;
}

function clearing({
  task,
  attribute,
}: {
  task: DescribedTask;
  attribute: TaskAttribute;
}): Partial<Task> {
  if (attribute.field === "tag") {
    return {
      tags: task.tags.filter((tag) => tag !== attribute.text),
    };
  }
  if (attribute.field === "who") {
    return { who: null };
  }
  if (attribute.field === "stage") {
    return { stage: null };
  }
  if (attribute.field === "due_date") {
    return { dueDate: null };
  }
  if (attribute.field === "due_time") {
    return { dueTime: null };
  }
  if (attribute.field === "recurring") {
    return { schedule: null };
  }
  return {};
}

function sigilFor(field: Attribute): string {
  if (field === "tag") {
    return "#";
  }
  if (field === "who") {
    return "@";
  }
  if (field === "list") {
    return "/";
  }
  if (field === "stage") {
    return "!";
  }
  return "";
}
