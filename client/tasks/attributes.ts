import type { AttributeField } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import type { Task } from "@shared/types.ts";

export interface Attribute {
  field: AttributeField;
  value: string | null;
  label: string;
}

export function searchFor(attribute: Attribute): string | null {
  if (attribute.value === null) {
    return null;
  }
  if (attribute.field === "tag") {
    return `#${attribute.value}`;
  }
  if (attribute.field === "who") {
    return `@${attribute.value}`;
  }
  if (attribute.field === "list") {
    return `/${attribute.value}`;
  }
  if (attribute.field === "stage") {
    return `!${attribute.value}`;
  }
  if (
    attribute.field === "due_date" ||
    attribute.field === "due_time"
  ) {
    return attribute.value;
  }
  return null;
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
