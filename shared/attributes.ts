export const ATTRIBUTES = [
  "list",
  "tag",
  "who",
  "stage",
  "state",
  "due_date",
  "due_time",
  "recurring",
  "archived",
] as const;

export type AttributeField = (typeof ATTRIBUTES)[number];

export function asAttributeField(value: unknown): AttributeField | null {
  return ATTRIBUTES.find((attribute) => attribute === value) ?? null;
}
