import type { AttributeField } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

export interface Attribute {
  field: AttributeField;
  value: string | null;
  label: string;
}

export function linkTo(attribute: Attribute): string | null {
  return attribute.value === null
    ? null
    : `/${attribute.field}/${encodeURIComponent(attribute.value)}`;
}

export function asChanges(attributes: Attribute[]): Partial<Task> {
  const changes: Partial<Task> = {};
  const tags: string[] = [];

  for (const attribute of attributes) {
    if (attribute.field === "tag") {
      if (
        attribute.value !== null &&
        !tags.some(
          (held) =>
            canonicalName(held) ===
            canonicalName(attribute.value ?? ""),
        )
      ) {
        tags.push(attribute.value);
      }
      continue;
    }
    if (attribute.field === "list" && attribute.value !== null) {
      changes.list = attribute.value;
    }
    if (attribute.field === "who") {
      changes.who = attribute.value;
    }
    if (attribute.field === "stage") {
      changes.stage =
        attribute.value === null ? null : asStage(attribute.value);
    }
    if (attribute.field === "due_date") {
      changes.dueDate = attribute.value;
    }
    if (attribute.field === "due_time") {
      changes.dueTime = attribute.value;
    }
  }

  if (attributes.some((attribute) => attribute.field === "tag")) {
    changes.tags = tags;
  }

  return changes;
}
