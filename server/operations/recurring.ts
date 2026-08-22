import { addDays, format, parseISO } from "date-fns";

import { sql } from "../database.ts";
import * as events from "./events.ts";
import { canonicalName } from "@shared/names.ts";
import { dueDatesBetween, toDateString } from "@shared/recurrence.ts";
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

export async function generateDue(): Promise<void> {
  const today = toDateString(new Date());

  const pending = await sql<RecurringRow[]>`
    select ${COLUMNS}
    from todo.recurring_tasks
    where ended_at is null
      and (generated_through is null or generated_through < ${today})
  `;

  for (const recurring of pending) {
    await generateOne({ recurring: recurring, today: today });
  }
}

async function generateOne({
  recurring,
  today,
}: {
  recurring: RecurringRow;
  today: string;
}): Promise<void> {
  const resumeFrom = recurring.generatedThrough
    ? format(
        addDays(parseISO(recurring.generatedThrough), 1),
        "yyyy-MM-dd",
      )
    : recurring.startsOn;
  const from =
    resumeFrom > recurring.createdOn
      ? resumeFrom
      : recurring.createdOn;

  const schedule: Schedule = {
    frequency: recurring.frequency,
    repeatEvery: recurring.repeatEvery,
    weekdays: recurring.weekdays,
    dayOfMonth: recurring.dayOfMonth,
    startsOn: recurring.startsOn,
  };

  const dates =
    from > today
      ? []
      : dueDatesBetween({
          schedule: schedule,
          from: from,
          through: today,
        });

  await sql.begin(async (transaction) => {
    for (const dueDate of dates) {
      const missed = await transaction<{ id: number }[]>`
        update todo.tasks
        set state = 'missed', updated_at = now()
        where recurring_task_id = ${recurring.id}
          and parent_id is null
          and due_date < ${dueDate}
          and state not in ('complete', 'missed', 'skipped')
        returning id
      `;

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
        returning id
      `;

      if (instance) {
        for (const [
          position,
          title,
        ] of recurring.subtaskTitles.entries()) {
          await transaction`
            insert into todo.tasks (list, parent_id, title, sort_order)
            values (${recurring.list}, ${instance.id}, ${title}, ${position})
          `;
        }
      }

      if (missed.length > 0) {
        await transaction`
          insert into todo.events (task_id, source, summary)
          values (
            ${instance?.id ?? null},
            'system',
            ${`"${recurring.title}" went unfinished and rolled over`}
          )
        `;
      }
    }

    await transaction`
      update todo.recurring_tasks
      set generated_through = ${today}, updated_at = now()
      where id = ${recurring.id}
    `;
  });
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
