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

const LEAST_KEPT = 15;

export async function recent(): Promise<Event[]> {
  return sql<Event[]>`
    select
      events.id, events.task_id, events.source, events.summary,
      events.created_at, events.seen_at, tasks.title as task_title
    from todo.events as events
    left join todo.tasks as tasks on tasks.id = events.task_id
    where events.source in ('mcp', 'agent')
      and (
        events.seen_at is null
        or events.id in (
          select id from todo.events
          where source in ('mcp', 'agent')
          order by created_at desc
          limit ${LEAST_KEPT}
        )
      )
    order by events.created_at desc
  `;
}

export async function markSeen(id: number): Promise<void> {
  await sql`update todo.events set seen_at = now() where id = ${id}`;
}

export async function markAllSeen(): Promise<void> {
  await sql`update todo.events set seen_at = now() where seen_at is null`;
}
