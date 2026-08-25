import type { Attribute } from "@shared/attributes.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

export interface HiddenAttribute {
  field: Attribute;
  label: string;
}

export interface SwipeAction {
  name: string;
  action: () => void;
}

export interface TaskGroup {
  key: string;
  label: string;
  groupedBy: Partial<Task>;
  guessedAttributes: Partial<Task>;
  hiddenAttributes: HiddenAttribute[];
  tasks: CreatedTask[];
}

export type DestinationAttributes = Partial<Task>;

export interface RowActions {
  toggle: (task: CreatedTask) => void;
  open: (task: CreatedTask) => void;
  rename: (task: CreatedTask, changes: Partial<Task>) => void;
  create: (changes: Partial<Task>) => Promise<CreatedTask>;
  remove: (task: CreatedTask) => void;
  swipeLeft: (task: CreatedTask) => void;
  swipeRight: (task: CreatedTask) => void;
  undo: () => void;
  redo: () => void;
}
