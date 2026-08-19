import { sql } from "../database.ts";
import * as events from "./events.ts";
import type { Comment, EventSource } from "@shared/types.ts";

export const CAMEN = "camen";

export async function forTask(taskId: number): Promise<Comment[]> {
  return sql<Comment[]>`
    select id, task_id, author, body, created_at, seen_at
    from todo.comments
    where task_id = ${taskId}
    order by created_at asc
  `;
}

export async function markSeen(taskId: number): Promise<void> {
  await sql`
    update todo.comments
    set seen_at = now()
    where task_id = ${taskId} and seen_at is null
  `;
}

export async function add({
  taskId,
  body,
  author = CAMEN,
  source = "app",
}: {
  taskId: number;
  body: string;
  author?: string;
  source?: EventSource;
}): Promise<Comment> {
  const [created] = await sql<Comment[]>`
    insert into todo.comments (task_id, author, body, seen_at)
    values (
      ${taskId}, ${author}, ${body},
      ${source === "app" ? sql`now()` : sql`null`}
    )
    returning id, task_id, author, body, created_at, seen_at
  `;

  if (!created) {
    throw new Error("could not add the comment");
  }

  if (source !== "app") {
    await events.record({
      taskId: taskId,
      source: source,
      summary: `${author} commented: ${body.slice(0, 80)}`,
    });
  }

  return created;
}
