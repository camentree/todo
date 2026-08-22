import { sql } from "../database.ts";
import { CAMEN } from "./comments.ts";
import * as events from "./events.ts";
import * as recurring from "./recurring.ts";
import { canonicalName } from "@shared/names.ts";
import { reassignSlots } from "@shared/ordering.ts";
import { isTerminal } from "@shared/states.ts";
import type { TaskState } from "@shared/states.ts";
import type { Attribute } from "@shared/attributes.ts";
import type { EventSource, Schedule, Task } from "@shared/types.ts";

const NOT_LONG_RESOLVED = sql`
  (state not in ('complete', 'skipped') or resolved_at::date = current_date)
`;

const COLUMNS = sql`
  id, list, parent_id, recurring_task_id, title, note, state, stage, tags, who,
  due_date, due_time, sort_order, resolved_at, archived_at, created_at,
  updated_at,
  (select count(*)::int from todo.comments where task_id = todo.tasks.id)
    as comment_count,
  (
    select count(*)::int from todo.comments
    where task_id = todo.tasks.id and seen_at is null
  ) as unseen_comment_count,
  coalesce(
    (
      select author <> ${CAMEN} from todo.comments
      where task_id = todo.tasks.id
      order by created_at desc, id desc
      limit 1
    ),
    false
  ) as last_comment_from_others,
  (
    select json_build_object(
      'frequency', schedule.frequency,
      'repeatEvery', schedule.repeat_every,
      'weekdays', schedule.weekdays,
      'dayOfMonth', schedule.day_of_month,
      'startsOn', schedule.starts_on
    )
    from todo.recurring_tasks as schedule
    where schedule.id = todo.tasks.recurring_task_id
      and schedule.ended_at is null
  ) as schedule
`;

const FILTERS: Record<
  Attribute,
  (value: string) => ReturnType<typeof sql>
> = {
  list: (value) => sql`list = ${canonicalName(value)}`,
  tag: (value) => sql`tags @> ${[canonicalName(value)]}`,
  who: (value) => sql`who = ${canonicalName(value)}`,
  stage: (value) => sql`stage = ${value}`,
  state: (value) => sql`state = ${value}`,
  due_time: (value) => sql`due_time = ${value}::time`,
  recurring: (value) =>
    value === "true"
      ? sql`recurring_task_id is not null`
      : sql`recurring_task_id is null`,
  archived: (value) =>
    value === "true"
      ? sql`archived_at is not null`
      : sql`archived_at is null`,
  due_date: (value) => sql`
    case when ${value}::date = current_date
      then state <> 'missed' and (
        due_date <= current_date
        or exists (
          select 1 from todo.comments
          where task_id = todo.tasks.id and seen_at is null
        )
      )
      else due_date = ${value}::date
    end
  `,
};

export async function query({
  attribute,
  value,
  everything = false,
}: {
  attribute: Attribute | null;
  value: string;
  everything?: boolean;
}): Promise<Task[]> {
  const parents = await sql<Task[]>`
    select ${COLUMNS}
    from todo.tasks
    where parent_id is null
      ${
        attribute === "state" || everything
          ? sql``
          : sql`and ${NOT_LONG_RESOLVED}`
      }
      ${
        attribute === "archived" || everything
          ? sql``
          : sql`and archived_at is null`
      }
      ${attribute ? sql`and ${FILTERS[attribute](value)}` : sql``}
    order by sort_order asc, id asc
  `;

  return attachSubtasks(parents);
}

async function attachSubtasks(parents: Task[]): Promise<Task[]> {
  if (parents.length === 0) {
    return [];
  }

  const parentIds = parents.map((parent) => parent.id);
  const children = await sql<Task[]>`
    select ${COLUMNS}
    from todo.tasks
    where parent_id = any(${parentIds}) and archived_at is null
    order by sort_order asc, id asc
  `;

  return parents.map((parent) => ({
    ...parent,
    subtasks: children.filter(
      (child) => child.parentId === parent.id,
    ),
  }));
}

export async function byId(id: number): Promise<Task | null> {
  const [found] = await sql<Task[]>`
    select ${COLUMNS} from todo.tasks where id = ${id}
  `;
  if (!found) {
    return null;
  }
  const [withChildren] = await attachSubtasks([found]);
  return withChildren ?? found;
}

export interface NewTask {
  list: string;
  title: string;
  parentId?: number | null;
  recurringTaskId?: number | null;
  note?: string | null;
  state?: TaskState;
  stage?: string | null;
  tags?: string[];
  who?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  schedule?: Schedule | null;
}

export async function create(
  task: NewTask,
  source: EventSource = "app",
): Promise<Task> {
  if (task.parentId) {
    await requireCanHaveChildren(task.parentId);
  }

  const [created] = await sql<Task[]>`
    insert into todo.tasks (
      list, parent_id, recurring_task_id, title, note, state, stage, tags, who,
      due_date, due_time, sort_order
    )
    values (
      ${canonicalName(task.list)},
      ${task.parentId ?? null},
      ${task.recurringTaskId ?? null},
      ${task.title},
      ${task.note ?? null},
      ${task.state ?? "to_do"},
      ${task.stage ?? null},
      ${(task.tags ?? []).map(canonicalName)},
      ${task.who ? canonicalName(task.who) : null},
      ${task.dueDate ?? null},
      ${task.dueTime ?? null},
      coalesce((select max(sort_order) + 1 from todo.tasks), 0)
    )
    returning ${COLUMNS}
  `;

  if (!created) {
    throw new Error("could not create the task");
  }

  if (source !== "app") {
    await events.record({
      taskId: created.id,
      source: source,
      summary: `Added "${created.title}"`,
    });
  }

  if (!task.schedule) {
    return created;
  }

  await recurring.startFrom({
    taskId: created.id,
    schedule: task.schedule,
  });
  return (await byId(created.id)) ?? created;
}

async function requireCanHaveChildren(
  parentId: number,
): Promise<void> {
  const [parent] = await sql<{ parentId: number | null }[]>`
    select parent_id from todo.tasks where id = ${parentId}
  `;
  if (!parent) {
    throw new Error(`no task with id ${parentId}`);
  }
  if (parent.parentId !== null) {
    throw new Error("a subtask cannot have subtasks of its own");
  }
}

export interface TaskChanges {
  title?: string;
  note?: string | null;
  list?: string;
  stage?: string | null;
  tags?: string[];
  who?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  parentId?: number | null;
  schedule?: Schedule | null;
}

const SHARED_WITH_SCHEDULE = [
  "title",
  "note",
  "list",
  "tags",
  "who",
  "dueTime",
];

type TaskFields = Omit<TaskChanges, "schedule">;

function canonicalNamesIn(changes: TaskFields): TaskFields {
  return {
    ...changes,
    ...(changes.list === undefined
      ? {}
      : { list: canonicalName(changes.list) }),
    ...(changes.who ? { who: canonicalName(changes.who) } : {}),
    ...(changes.tags
      ? { tags: changes.tags.map(canonicalName) }
      : {}),
  };
}

export async function update(
  id: number,
  changes: TaskChanges,
  source: EventSource = "app",
): Promise<Task> {
  const { schedule, ...fields } = changes;
  const assignments = pruneUndefined(canonicalNamesIn(fields));

  if (Object.keys(assignments).length > 0) {
    await sql`
      update todo.tasks
      set ${sql(assignments)}, updated_at = now()
      where id = ${id}
    `;
  }

  const edited = await byId(id);
  if (!edited) {
    throw new Error(`no task with id ${id}`);
  }

  if (schedule !== undefined) {
    await applySchedule({ task: edited, schedule: schedule });
  }
  await shareWithSchedule({ taskId: id, assignments: assignments });

  const updated = (await byId(id)) ?? edited;

  if (source !== "app") {
    await events.record({
      taskId: id,
      source: source,
      summary: `Edited "${updated.title}"`,
    });
  }

  return updated;
}

async function applySchedule({
  task,
  schedule,
}: {
  task: Task;
  schedule: Schedule | null;
}): Promise<void> {
  if (schedule === null) {
    if (task.schedule && task.recurringTaskId) {
      await recurring.end(task.recurringTaskId);
    }
    return;
  }
  if (task.schedule && task.recurringTaskId) {
    await recurring.configure(task.recurringTaskId, schedule);
    return;
  }
  await recurring.startFrom({ taskId: task.id, schedule: schedule });
}

async function shareWithSchedule({
  taskId,
  assignments,
}: {
  taskId: number;
  assignments: TaskFields;
}): Promise<void> {
  const task = await byId(taskId);
  if (!task?.schedule || !task.recurringTaskId) {
    return;
  }
  const shared = Object.fromEntries(
    Object.entries(assignments).filter(([field]) =>
      SHARED_WITH_SCHEDULE.includes(field),
    ),
  );
  if (Object.keys(shared).length > 0) {
    await recurring.update(task.recurringTaskId, shared);
  }
}

export async function setState(
  id: number,
  state: TaskState,
  source: EventSource = "app",
): Promise<Task> {
  const updated = await sql.begin(async (transaction) => {
    const [task] = await transaction<Task[]>`
      update todo.tasks
      set state = ${state},
          resolved_at = ${isTerminal(state) ? sql`now()` : sql`null`},
          stage = ${
            state === "complete"
              ? sql`case when stage is null then null else 'complete' end`
              : sql`case when stage = 'complete' then 'to_do' else stage end`
          },
          updated_at = now()
      where id = ${id}
      returning ${COLUMNS}
    `;

    if (task && state === "complete") {
      await transaction`
        update todo.tasks
        set state = 'complete', resolved_at = now(), updated_at = now()
        where parent_id = ${id} and state <> 'complete'
      `;
    }

    return task;
  });

  if (!updated) {
    throw new Error(`no task with id ${id}`);
  }

  if (source !== "app") {
    await events.record({
      taskId: id,
      source: source,
      summary: `"${updated.title}" is now ${state.replace(/_/g, " ")}`,
    });
  }

  return updated;
}

export async function archive(ids: number[]): Promise<void> {
  await sql`
    update todo.tasks
    set archived_at = now(), updated_at = now()
    where id = any(${ids}) or parent_id = any(${ids})
  `;
}

export async function unarchive(ids: number[]): Promise<void> {
  await sql`
    update todo.tasks
    set archived_at = null, updated_at = now()
    where id = any(${ids}) or parent_id = any(${ids})
  `;
}

export async function remove(id: number): Promise<void> {
  await sql`delete from todo.tasks where id = ${id}`;
}

export async function hide(id: number): Promise<void> {
  await sql`
    update todo.tasks set state = 'hidden', updated_at = now() where id = ${id}
  `;
}

export async function unhide(id: number): Promise<void> {
  await sql`
    update todo.tasks
    set state = 'to_do', updated_at = now()
    where id = ${id} and state = 'hidden'
  `;
}

export async function deferByOneDay(id: number): Promise<void> {
  await sql`
    update todo.tasks
    set due_date = coalesce(due_date, current_date) + 1, updated_at = now()
    where id = ${id}
  `;
}

export async function reorder(orderedIds: number[]): Promise<void> {
  const positions = await sql<{ sortOrder: number }[]>`
    select sort_order from todo.tasks
    where id = any(${orderedIds})
    order by sort_order asc, id asc
  `;

  const slots = reassignSlots(
    positions.map((position) => position.sortOrder),
  );

  await sql.begin(async (transaction) => {
    for (const [index, id] of orderedIds.entries()) {
      const slot = slots[index];
      if (slot === undefined) {
        continue;
      }
      await transaction`
        update todo.tasks set sort_order = ${slot} where id = ${id}
      `;
    }
  });
}

function pruneUndefined<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Partial<T>;
}
