import type { Task } from "./types.ts";

export function commentKey({ tasks, task }: { tasks: Task[]; task: Task }): string {
  const root = task.parent ? (tasks.find((each) => each.id === task.parent) ?? task) : task;
  return root.definitionId ?? "n:" + root.name.toLowerCase();
}

export function groupCommentKey(label: string): string {
  return "g:" + label.toLowerCase();
}
