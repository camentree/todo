import { sql } from "../database.ts";
import * as events from "./events.ts";
import * as recurring from "./recurring.ts";
import { canonicalName } from "@shared/names.ts";
import { reassignSlots } from "@shared/ordering.ts";
import { toDateString } from "@shared/recurrence.ts";
import { isTerminal } from "@shared/states.ts";
import type { TaskState } from "@shared/states.ts";
import type {
  EventSource,
  Schedule,
  CreatedTask,
} from "@shared/types.ts";

const COLUMNS = sql`
  id, list, parent_id, recurring_task_id, title, note, state, stage, tags, who,
  due_date, due_time, sort_order, finished_at, created_at,
  updated_at,
  (select count(*)::int from todo.comments where task_id = todo.tasks.id)
    as comment_count,
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

export async function query({
  since,
}: {
  since: string | null;
}): Promise<CreatedTask[]> {
  const parents = await sql<CreatedTask[]>`
    select ${COLUMNS}
    from todo.tasks
    where parent_id is null
      ${
        since === null
          ? sql``
          : sql`and (
              finished_at is null or finished_at >= ${since}::date
            )`
      }
    order by sort_order asc, id asc
  `;

  return attachSubtasks(parents);
}

async function attachSubtasks(
  parents: CreatedTask[],
): Promise<CreatedTask[]> {
  if (parents.length === 0) {
    return [];
  }

  const parentIds = parents.map((parent) => parent.id);
  const children = await sql<CreatedTask[]>`
    select ${COLUMNS}
    from todo.tasks
    where parent_id = any(${parentIds}) and state <> 'archived'
    order by sort_order asc, id asc
  `;

  return parents.map((parent) => ({
    ...parent,
    subtasks: children.filter(
      (child) => child.parentId === parent.id,
    ),
  }));
}

export async function byId(id: number): Promise<CreatedTask | null> {
  const [found] = await sql<CreatedTask[]>`
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
  finishedAt?: string | null;
}

export async function create(
  task: NewTask,
  source: EventSource = "app",
): Promise<CreatedTask> {
  if (task.parentId) {
    await requireCanHaveChildren(task.parentId);
  }

  const [created] = await sql<CreatedTask[]>`
    insert into todo.tasks (
      list, parent_id, recurring_task_id, title, note, state, stage, tags, who,
      due_date, due_time, finished_at, sort_order
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
      ${task.finishedAt ?? null},
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
  state?: TaskState;
  finishedAt?: string | null;
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
): Promise<CreatedTask> {
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
  task: CreatedTask;
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
): Promise<CreatedTask[]> {
  const updated = await sql.begin(async (transaction) => {
    const [task] = await transaction<CreatedTask[]>`
      update todo.tasks
      set state = ${state},
          finished_at = ${isTerminal(state) ? sql`now()` : sql`null`},
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
        set state = 'complete', finished_at = now(), updated_at = now()
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

  const following =
    isTerminal(state) && updated.recurringTaskId !== null
      ? await recurring.nextInstanceAfter({
          recurringId: updated.recurringTaskId,
          dueDate: updated.dueDate,
        })
      : null;
  if (following === null) {
    return [updated];
  }

  const next = await byId(following);
  return next ? [updated, next] : [updated];
}

export async function archive(ids: number[]): Promise<CreatedTask[]> {
  return sql<CreatedTask[]>`
    update todo.tasks
    set state = 'archived', finished_at = now(), updated_at = now()
    where id = any(${ids}) or parent_id = any(${ids})
    returning ${COLUMNS}
  `;
}

export async function unarchive(
  ids: number[],
): Promise<CreatedTask[]> {
  return sql<CreatedTask[]>`
    update todo.tasks
    set state = 'to_do', finished_at = null, updated_at = now()
    where (id = any(${ids}) or parent_id = any(${ids}))
      and state = 'archived'
    returning ${COLUMNS}
  `;
}

export async function remove(id: number): Promise<number[]> {
  const removed = await sql<{ id: number }[]>`
    delete from todo.tasks
    where id = ${id} or parent_id = ${id}
    returning id
  `;
  return removed.map((row) => row.id);
}

export async function hide(id: number): Promise<CreatedTask[]> {
  return sql<CreatedTask[]>`
    update todo.tasks set state = 'hidden', updated_at = now() where id = ${id}
    returning ${COLUMNS}
  `;
}

export async function unhide(id: number): Promise<CreatedTask[]> {
  return sql<CreatedTask[]>`
    update todo.tasks
    set state = 'to_do', updated_at = now()
    where id = ${id} and state = 'hidden'
    returning ${COLUMNS}
  `;
}

export async function deferByOneDay(
  id: number,
): Promise<CreatedTask[]> {
  const task = await byId(id);
  if (!task) {
    throw new Error(`no task with id ${id}`);
  }
  if (
    task.recurringTaskId !== null &&
    (task.dueDate === null ||
      task.dueDate > toDateString(new Date()))
  ) {
    throw new Error("that is not due yet");
  }

  return sql<CreatedTask[]>`
    update todo.tasks
    set due_date = coalesce(due_date, current_date) + 1, updated_at = now()
    where id = ${id}
    returning ${COLUMNS}
  `;
}

export async function reorder(
  orderedIds: number[],
): Promise<CreatedTask[]> {
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

  return sql<CreatedTask[]>`
    select ${COLUMNS} from todo.tasks where id = any(${orderedIds})
  `;
}

function pruneUndefined<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Partial<T>;
}
