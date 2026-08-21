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

export type Attribute = (typeof ATTRIBUTES)[number];

export function asAttribute(value: unknown): Attribute | null {
  return ATTRIBUTES.find((attribute) => attribute === value) ?? null;
}
