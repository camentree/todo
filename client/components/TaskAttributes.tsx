import { formatDueDate, formatDueTime } from "../format.ts";
import { renameChanges } from "../useTaskActions.ts";
import type { Attribute } from "@shared/attributes.ts";
import { stageLabel } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

export interface TaskAttribute {
  field: Attribute;
  text: string;
  to?: string;
}

export function attributesOf(task: Task): TaskAttribute[] {
  const archived = task.archivedAt !== null;
  const due = archived ? null : formatDueDate(task.dueDate);
  const time = archived ? null : formatDueTime(task.dueTime);

  const items: (TaskAttribute | null)[] = [
    {
      field: "list",
      text: task.list,
      to: `/list/${encodeURIComponent(task.list)}`,
    },
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
    due
      ? {
          field: "due_date",
          text: due,
          to: `/due_date/${encodeURIComponent(due)}`,
        }
      : null,
    time && task.dueTime
      ? {
          field: "due_time",
          text: time,
          to: `/due_time/${task.dueTime.slice(0, 5)}`,
        }
      : null,
    task.recurringTaskId
      ? {
          field: "recurring",
          text: "recurring",
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

export function AttributeText({ task }: { task: Task }) {
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

export function AttributeChips({ task }: { task: Task }) {
  const attributes = attributesOf(task);
  if (attributes.length === 0) {
    return null;
  }

  return (
    <span className="task-meta">
      {attributes.map(({ field, text }) => (
        <span
          key={`${field}-${text}`}
          className="capture-chip"
          data-field={field}
        >
          {sigilFor(field)}
          {text.toLowerCase()}
        </span>
      ))}
    </span>
  );
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
