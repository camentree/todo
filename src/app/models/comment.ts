import type { Task } from "./task.ts";

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  author: string;
  writtenAt: string;
  seenAt: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export function commentsFor(task: Task): Comment[] {
  return [...task.comments].sort((a, b) => b.writtenAt.localeCompare(a.writtenAt));
}

export function unseenFor(task: Task): boolean {
  return task.comments.some((comment) => comment.seenAt === null);
}
