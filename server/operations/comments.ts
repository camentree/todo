import { sql } from "../database.ts";
import * as events from "./events.ts";
import type { Comment, EventSource } from "@shared/types.ts";

export const CAMEN = "camen";

function summaryFor({
  author,
  body,
}: {
  author: string;
  body: string;
}): string {
  return `${author} commented: ${body.slice(0, 80)}`;
}

export async function forTask(taskId: number): Promise<Comment[]> {
  return sql<Comment[]>`
    select id, task_id, author, body, created_at
    from todo.comments
    where task_id = ${taskId}
    order by created_at asc
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
    insert into todo.comments (task_id, author, body)
    values (${taskId}, ${author}, ${body})
    returning id, task_id, author, body, created_at
  `;

  if (!created) {
    throw new Error("could not add the comment");
  }

  if (source !== "app") {
    await events.record({
      taskId: taskId,
      source: source,
      summary: summaryFor({ author: author, body: body }),
    });
  }

  return created;
}

export async function resurface(commentId: number): Promise<void> {
  const [comment] = await sql<Comment[]>`
    select id, task_id, author, body, created_at
    from todo.comments
    where id = ${commentId}
  `;

  if (!comment) {
    throw new Error("could not find the comment");
  }

  await events.record({
    taskId: comment.taskId,
    source: "system",
    summary: summaryFor({
      author: comment.author,
      body: comment.body,
    }),
  });
}

export async function remove(commentId: number): Promise<void> {
  await sql`delete from todo.comments where id = ${commentId}`;
}
