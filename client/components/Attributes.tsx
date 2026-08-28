import {
  cadenceOf,
  formatDueDate,
  formatDueTime,
} from "../tasks/format.ts";
import { Chip } from "./ui/Chip.tsx";
import type { Attribute } from "../tasks/attributes.ts";
import type { AttributeField } from "@shared/attributes.ts";
import { parse, type ParsedToken } from "@shared/parser.ts";
import { stageLabel } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

export type DescribedTask = Pick<
  Task,
  | "list"
  | "tags"
  | "who"
  | "dueDate"
  | "dueTime"
  | "stage"
  | "state"
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
    state: "to_do",
    schedule: null,
    ...changes,
    list: list,
  };
}

export function attributesOf(task: DescribedTask): Attribute[] {
  const archived = task.state === "archived";
  const due = archived ? null : formatDueDate(task.dueDate);
  const time = archived ? null : formatDueTime(task.dueTime);

  const items: (Attribute | null)[] = [
    task.list
      ? { field: "list" as const, value: task.list, label: task.list }
      : null,
    ...task.tags.map(
      (tag): Attribute => ({
        field: "tag",
        value: tag,
        label: tag,
      }),
    ),
    task.who
      ? { field: "who" as const, value: task.who, label: task.who }
      : null,
    due && task.dueDate
      ? {
          field: "due_date" as const,
          value: task.dueDate,
          label: due,
        }
      : null,
    time && task.dueTime
      ? {
          field: "due_time" as const,
          value: task.dueTime.slice(0, 5),
          label: time,
        }
      : null,
    task.schedule
      ? {
          field: "recurring" as const,
          value: "true",
          label: cadenceOf(task.schedule),
        }
      : null,
    task.stage
      ? {
          field: "stage" as const,
          value: task.stage,
          label: stageLabel(task.stage),
        }
      : null,
  ];

  return items.filter((item): item is Attribute => item !== null);
}

export function AttributeText({ task }: { task: DescribedTask }) {
  const attributes = attributesOf(task);
  if (attributes.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {attributes.map(({ field, label }) => (
        <span key={`${field}-${label}`}>{label.toLowerCase()}</span>
      ))}
    </span>
  );
}

export function AttributeChips({
  task,
  onRemove,
}: {
  task: DescribedTask;
  onRemove?: (attribute: Attribute) => void;
}) {
  const attributes = attributesOf(task);
  if (attributes.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {attributes.map((attribute) => (
        <Chip
          key={`${attribute.field}-${attribute.label}`}
          label={attribute.label}
          sigil={sigilFor(attribute.field)}
          field={attribute.field}
          onRemove={
            onRemove && attribute.field !== "list"
              ? () => onRemove(attribute)
              : undefined
          }
        />
      ))}
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
  attribute: Attribute;
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
    changes:
      spoken.length > 0
        ? {}
        : clearing({ task: task, attribute: attribute }),
  };
}

function saysSo({
  token,
  attribute,
}: {
  token: ParsedToken;
  attribute: Attribute;
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
    return token.kind === "tag" && token.value === attribute.value;
  }
  return token.kind === attribute.field;
}

function clearing({
  task,
  attribute,
}: {
  task: DescribedTask;
  attribute: Attribute;
}): Partial<Task> {
  if (attribute.field === "tag") {
    return {
      tags: task.tags.filter((tag) => tag !== attribute.value),
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

function sigilFor(field: AttributeField): string {
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
