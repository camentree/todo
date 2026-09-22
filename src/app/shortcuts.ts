import type { Shortcut } from "@shared/hooks/useShortcuts.ts";

export type ShortcutAction = "close" | "down" | "up" | "switch" | "fold" | "select" | "complete" | "edit" | "delete" | "today" | "thread" | "add" | "help";

export const shortcuts: Shortcut<ShortcutAction>[] = [
  { keys: ["Escape"], action: "close", label: "close what is open" },
  { keys: ["j", "ctrl+n"], action: "down", label: "move down" },
  { keys: ["k", "ctrl+p"], action: "up", label: "move up" },
  { keys: ["[", "]"], action: "switch", label: "today or backlog" },
  { keys: ["f"], action: "fold", label: "fold and unfold" },
  { keys: ["space"], action: "select", label: "select" },
  { keys: ["enter"], action: "complete", label: "complete" },
  { keys: ["i"], action: "edit", label: "edit" },
  { keys: ["d"], action: "delete", label: "delete" },
  { keys: ["t"], action: "today", label: "today, or not today" },
  { keys: ["c"], action: "thread", label: "comments" },
  { keys: ["n"], action: "add", label: "new task" },
  { keys: ["?"], action: "help", label: "this list" },
];
