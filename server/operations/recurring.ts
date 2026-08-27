import { addDays, format, parseISO } from "date-fns";

import { sql } from "../database.ts";
import type { Transaction } from "../database.ts";
import * as events from "./events.ts";
import { canonicalName } from "@shared/names.ts";
import {
  latestDueDateOnOrBefore,
  nextDueDateAfter,
  toDateString,
} from "@shared/recurrence.ts";
import type { Schedule } from "@shared/recurrence.ts";
import type { Frequency, RecurringTask } from "@shared/types.ts";

interface RecurringRow extends RecurringTask {
  subtaskTitles: string[];
  createdOn: string;
}

const COLUMNS = sql`
  id, list, title, note, tags, who, subtask_titles, frequency, repeat_every,
  weekdays, day_of_month, due_time, starts_on, ended_at, generated_through,
  created_at::date as created_on
`;

export async function byId(id: number): Promise<RecurringRow | null> {
  const [found] = await sql<RecurringRow[]>`
    select ${COLUMNS} from todo.recurring_tasks where id = ${id}
  `;
  return found ?? null;
}

export interface NewRecurringTask {
  list: string;
  title: string;
  note?: string | null;
  tags?: string[];
  who?: string | null;
  subtaskTitles?: string[];
  frequency: Frequency;
  repeatEvery?: number;
  weekdays?: number[];
  dayOfMonth?: number | null;
  dueTime?: string | null;
  startsOn?: string;
}

export async function create(
  task: NewRecurringTask,
): Promise<RecurringRow> {
  const [created] = await sql<RecurringRow[]>`
    insert into todo.recurring_tasks (
      list, title, note, tags, who, subtask_titles, frequency, repeat_every,
      weekdays, day_of_month, due_time, starts_on
    )
    values (
      ${canonicalName(task.list)},
      ${task.title},
      ${task.note ?? null},
      ${(task.tags ?? []).map(canonicalName)},
      ${task.who ? canonicalName(task.who) : null},
      ${task.subtaskTitles ?? []},
      ${task.frequency},
      ${task.repeatEvery ?? 1},
      ${task.weekdays ?? []},
      ${task.dayOfMonth ?? null},
      ${task.dueTime ?? null},
      ${task.startsOn ?? toDateString(new Date())}
    )
    returning ${COLUMNS}
  `;
  if (!created) {
    throw new Error("could not create the recurring task");
  }
  return created;
}

export async function startFrom({
  taskId,
  schedule,
}: {
  taskId: number;
  schedule: Schedule;
}): Promise<RecurringRow> {
  const [task] = await sql<
    {
      list: string;
      title: string;
      note: string | null;
      tags: string[];
      who: string | null;
      dueDate: string | null;
      dueTime: string | null;
    }[]
  >`
    select list, title, note, tags, who, due_date, due_time
    from todo.tasks
    where id = ${taskId}
  `;

  if (!task) {
    throw new Error(`no task with id ${taskId}`);
  }

  const today = toDateString(new Date());
  const startsOn = schedule.startsOn || task.dueDate || today;
  const settled = settledSchedule({
    schedule: schedule,
    startsOn: startsOn,
  });

  const created = await create({
    list: task.list,
    title: task.title,
    note: task.note,
    tags: task.tags,
    who: task.who,
    dueTime: task.dueTime,
    frequency: settled.frequency,
    repeatEvery: settled.repeatEvery,
    weekdays: settled.weekdays,
    dayOfMonth: settled.dayOfMonth,
    startsOn: settled.startsOn,
  });

  await sql`
    update todo.recurring_tasks
    set generated_through = ${startsOn}
    where id = ${created.id}
  `;

  await sql`
    update todo.tasks
    set recurring_task_id = ${created.id},
        due_date = ${startsOn},
        updated_at = now()
    where id = ${taskId}
  `;

  return { ...created, generatedThrough: startsOn };
}

function settledSchedule({
  schedule,
  startsOn,
}: {
  schedule: Schedule;
  startsOn: string;
}): Schedule {
  const startDate = parseISO(startsOn);
  return {
    frequency: schedule.frequency,
    repeatEvery: schedule.repeatEvery,
    startsOn: startsOn,
    weekdays:
      schedule.frequency === "weekly"
        ? schedule.weekdays.length > 0
          ? schedule.weekdays
          : [startDate.getDay()]
        : [],
    dayOfMonth:
      schedule.frequency === "monthly" ? startDate.getDate() : null,
  };
}

export async function update(
  id: number,
  changes: Partial<NewRecurringTask>,
): Promise<RecurringRow> {
  const assignments = Object.fromEntries(
    Object.entries(changes).filter(
      ([, value]) => value !== undefined,
    ),
  );

  const [updated] = await sql<RecurringRow[]>`
    update todo.recurring_tasks
    set ${sql(assignments)}, updated_at = now()
    where id = ${id}
    returning ${COLUMNS}
  `;
  if (!updated) {
    throw new Error(`no recurring task with id ${id}`);
  }
  return updated;
}

export async function configure(
  id: number,
  schedule: Schedule,
): Promise<RecurringRow> {
  const existing = await byId(id);
  if (!existing) {
    throw new Error(`no recurring task with id ${id}`);
  }

  const settled = settledSchedule({
    schedule: schedule,
    startsOn: schedule.startsOn || existing.startsOn,
  });
  const updated = await update(id, settled);

  if (settled.startsOn !== existing.startsOn) {
    await sql`
      update todo.tasks
      set due_date = ${settled.startsOn}, updated_at = now()
      where recurring_task_id = ${id}
        and state not in ('complete', 'missed', 'skipped')
    `;
  }

  return updated;
}

export async function rollOver(): Promise<void> {
  const today = toDateString(new Date());

  const active = await sql<RecurringRow[]>`
    select ${COLUMNS}
    from todo.recurring_tasks
    where ended_at is null
  `;

  for (const recurring of active) {
    await rollOverOne({ recurring: recurring, today: today });
  }
}

function scheduleOf(recurring: RecurringRow): Schedule {
  return {
    frequency: recurring.frequency,
    repeatEvery: recurring.repeatEvery,
    weekdays: recurring.weekdays,
    dayOfMonth: recurring.dayOfMonth,
    startsOn: recurring.startsOn,
  };
}

async function liveInstance(
  recurringId: number,
): Promise<{ id: number; dueDate: string | null } | null> {
  const [live] = await sql<{ id: number; dueDate: string | null }[]>`
    select id, due_date
    from todo.tasks
    where recurring_task_id = ${recurringId}
      and parent_id is null
      and state not in ('complete', 'missed', 'skipped', 'archived')
    limit 1
  `;
  return live ?? null;
}

async function rollOverOne({
  recurring,
  today,
}: {
  recurring: RecurringRow;
  today: string;
}): Promise<void> {
  const schedule = scheduleOf(recurring);
  const live = await liveInstance(recurring.id);

  if (live === null) {
    const due =
      latestDueDateOnOrBefore({
        schedule: schedule,
        onOrBefore: today,
      }) ??
      nextDueDateAfter({
        schedule: schedule,
        after: format(addDays(parseISO(today), -1), "yyyy-MM-dd"),
      });
    if (due !== null) {
      await sql.begin((transaction) =>
        createInstance({
          recurring: recurring,
          dueDate: due,
          transaction: transaction,
        }),
      );
    }
    return;
  }

  if (live.dueDate === null) {
    return;
  }
  const following = nextDueDateAfter({
    schedule: schedule,
    after: live.dueDate,
  });
  if (following === null || following > today) {
    return;
  }

  await sql.begin(async (transaction) => {
    await transaction`
      update todo.tasks
      set state = 'missed', finished_at = now(), updated_at = now()
      where id = ${live.id}
    `;
    await createInstance({
      recurring: recurring,
      dueDate:
        latestDueDateOnOrBefore({
          schedule: schedule,
          onOrBefore: today,
        }) ?? following,
      transaction: transaction,
    });
  });
}

async function createInstance({
  recurring,
  dueDate,
  transaction,
}: {
  recurring: RecurringRow;
  dueDate: string;
  transaction: Transaction;
}): Promise<number | null> {
  const [instance] = await transaction<{ id: number }[]>`
    insert into todo.tasks (
      list, recurring_task_id, title, note, tags, who, due_date, due_time,
      sort_order
    )
    values (
      ${recurring.list},
      ${recurring.id},
      ${recurring.title},
      ${recurring.note},
      ${recurring.tags},
      ${recurring.who},
      ${dueDate},
      ${recurring.dueTime},
      0
    )
    on conflict do nothing
    returning id
  `;

  if (!instance) {
    return null;
  }

  for (const [
    position,
    title,
  ] of recurring.subtaskTitles.entries()) {
    await transaction`
      insert into todo.tasks (
        list, parent_id, recurring_task_id, title, tags, who, due_date,
        due_time, sort_order
      )
      values (
        ${recurring.list},
        ${instance.id},
        ${recurring.id},
        ${title},
        ${recurring.tags},
        ${recurring.who},
        ${dueDate},
        ${recurring.dueTime},
        ${position}
      )
    `;
  }

  return instance.id;
}

export async function splitOff({
  taskId,
  fromRecurringId,
  title,
  dueDate,
}: {
  taskId: number;
  fromRecurringId: number;
  title: string;
  dueDate: string | null;
}): Promise<number | null> {
  const shared = await byId(fromRecurringId);
  if (!shared || shared.endedAt !== null) {
    return null;
  }

  const startsOn = dueDate ?? shared.startsOn;
  const own = await create({
    list: shared.list,
    title: title,
    tags: shared.tags,
    who: shared.who,
    dueTime: shared.dueTime,
    frequency: shared.frequency,
    repeatEvery: shared.repeatEvery,
    weekdays: shared.weekdays,
    dayOfMonth: shared.dayOfMonth,
    startsOn: startsOn,
  });

  await sql`
    update todo.recurring_tasks
    set generated_through = ${startsOn}
    where id = ${own.id}
  `;
  await sql`
    update todo.tasks
    set recurring_task_id = ${own.id}, updated_at = now()
    where id = ${taskId}
  `;
  return own.id;
}

export async function nextInstanceAfter({
  recurringId,
  dueDate,
}: {
  recurringId: number;
  dueDate: string | null;
}): Promise<number | null> {
  const recurring = await byId(recurringId);
  if (!recurring || recurring.endedAt !== null || dueDate === null) {
    return null;
  }
  const following = nextDueDateAfter({
    schedule: scheduleOf(recurring),
    after: dueDate,
  });
  if (following === null) {
    return null;
  }
  return sql.begin((transaction) =>
    createInstance({
      recurring: recurring,
      dueDate: following,
      transaction: transaction,
    }),
  );
}

export async function end(id: number): Promise<void> {
  await sql`
    update todo.recurring_tasks
    set ended_at = now(), updated_at = now()
    where id = ${id} and ended_at is null
  `;
  await events.record({
    taskId: null,
    source: "app",
    summary: "Stopped a repeating task",
  });
}
