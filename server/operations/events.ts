import { sql } from "../database.ts";
import type { Event, EventSource } from "@shared/types.ts";

export async function record({
  taskId,
  source,
  summary,
}: {
  taskId: number | null;
  source: EventSource;
  summary: string;
}): Promise<void> {
  await sql`
    insert into todo.events (task_id, source, summary)
    values (${taskId}, ${source}, ${summary})
  `;
}

export async function unseen(): Promise<Event[]> {
  return sql<Event[]>`
    select
      events.id, events.task_id, events.source, events.summary,
      events.created_at, tasks.title as task_title
    from todo.events as events
    left join todo.tasks as tasks on tasks.id = events.task_id
    where events.source <> 'app' and events.seen_at is null
    order by events.created_at desc
    limit 50
  `;
}

export async function markSeen(id: number): Promise<void> {
  await sql`update todo.events set seen_at = now() where id = ${id}`;
}

export async function markAllSeen(): Promise<void> {
  await sql`update todo.events set seen_at = now() where seen_at is null`;
}
