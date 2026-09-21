import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isDue } from "../shared/schedule.ts";
import { serializeMarkdown, tagsFrom } from "../shared/journal.ts";
import { isNumericType } from "../shared/model.ts";
import type { Comment, JournalEntry, Schedule, SubtaskSpec, Task } from "../shared/model.ts";

type Row = Omit<Task, "subtasks" | "comments">;

const directory = process.argv[2] ?? process.env.DATA_DIR ?? "data/dev";
const historyDays = 21;

function dateKey(date: Date): string {
  return date.toLocaleDateString("sv-SE");
}

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

function stamp(offset: number, time: string): string {
  return `${daysFromToday(offset)}T${time}`;
}

let counter = 0;
function identifier(prefix: string): string {
  counter += 1;
  return `${prefix}${counter.toString(36).padStart(3, "0")}`;
}

function created(offset: number): string {
  return `${daysFromToday(offset)}T05:00:00+00:00`;
}

function spec({ title, type = "boolean", target = null, note = "", sortOrder = 0 }: Partial<SubtaskSpec> & { title: string }): SubtaskSpec {
  return { title, type, target, restSeconds: null, note, sortOrder };
}

function schedule(fields: Partial<Schedule> & { title: string; group: string }): Schedule {
  return {
    id: identifier("sch"),
    type: "boolean",
    target: null,
    restSeconds: null,
    subtasks: [],
    dueTime: null,
    frequency: "daily",
    repeatEvery: 1,
    weekdays: null,
    dayOfMonth: null,
    startsOn: daysFromToday(-historyDays),
    endedOn: null,
    note: "",
    sortOrder: 0,
    createdAt: created(-historyDays),
    ...fields,
  };
}

const weekly = (days: number[]) => ({ frequency: "weekly" as const, weekdays: days });

const schedules: Schedule[] = [
  schedule({ title: "Journal", group: "habits", sortOrder: 0 }),
  schedule({ title: "Meditate", group: "habits", type: "timer_seconds", target: 600, sortOrder: 1 }),
  schedule({ title: "Drink water", group: "habits", type: "count", target: 8, sortOrder: 2 }),
  schedule({ title: "Read for twenty minutes", group: "habits", type: "timer_seconds", target: 1200, dueTime: "21:00", sortOrder: 3 }),
  schedule({
    title: "Morning stretch",
    group: "exercise",
    ...weekly([0, 2, 4]),
    restSeconds: 30,
    dueTime: "07:30",
    note: "Keep hips level through the plank. Breathe out on the way down in cat cow.",
    subtasks: [
      spec({ title: "neck rolls", type: "timer_seconds", target: 30, sortOrder: 0 }),
      spec({ title: "cat cow", type: "count", target: 10, sortOrder: 1 }),
      spec({ title: "plank", type: "timer_seconds", target: 45, note: "elbows under shoulders", sortOrder: 2 }),
      spec({ title: "side bend", type: "count", target: 8, sortOrder: 3 }),
    ],
    sortOrder: 0,
  }),
  schedule({ title: "Pull-ups", group: "exercise", ...weekly([0, 2, 4]), type: "count", target: 5, sortOrder: 1 }),
  schedule({ title: "Push-ups", group: "exercise", ...weekly([0, 2, 4]), type: "count", target: 20, sortOrder: 2 }),
  schedule({ title: "Yoga", group: "exercise", ...weekly([1, 3]), type: "timer_seconds", target: 1800, sortOrder: 3 }),
  schedule({
    title: "Physio and mobility",
    group: "exercise",
    ...weekly([1, 3, 5]),
    restSeconds: 45,
    subtasks: [
      spec({ title: "cat-cow with slow breathing", type: "count", target: 12, sortOrder: 0 }),
      spec({ title: "bird dog, hold each side for two breaths", type: "count", target: 10, sortOrder: 1 }),
      spec({ title: "glute bridge", type: "count", target: 15, sortOrder: 2 }),
      spec({ title: "dead bug", type: "count", target: 10, sortOrder: 3 }),
    ],
    sortOrder: 4,
  }),
  schedule({ title: "Long run", group: "exercise", ...weekly([5]), type: "timer_seconds", target: 3600, sortOrder: 5 }),
  schedule({ title: "Water the plants", group: "garden", frequency: "weekly", sortOrder: 0 }),
  schedule({ title: "Change the water filter", group: "personal", frequency: "monthly", sortOrder: 5 }),
  schedule({ title: "Weekly review", group: "personal", ...weekly([6]), type: "text", note: "Clear the inbox, look at next week, tidy the lists.", sortOrder: 6 }),
];

const rows: Row[] = [];
const instantiated: string[] = [];
const random = seeded(7);

function instantiate({ from, date }: { from: Schedule; date: string }): { parent: Row; children: Row[] } {
  const parent: Row = {
    id: identifier("tsk"),
    parentId: null,
    scheduleId: from.id,
    dueDate: date,
    dueTime: from.dueTime,
    title: from.title,
    group: from.group,
    type: from.type,
    target: from.target,
    numericalValue: isNumericType(from.type) ? 0 : null,
    stringValue: from.type === "text" ? "" : null,
    restSeconds: from.restSeconds,
    finalizedAt: null,
    isSkipped: false,
    assignee: null,
    note: from.note,
    sortOrder: from.sortOrder,
    createdAt: `${date}T05:00:00+00:00`,
    deletedAt: null,
  };
  const children = from.subtasks.map(
    (piece): Row => ({
      id: identifier("sub"),
      parentId: parent.id,
      scheduleId: null,
      dueDate: null,
      dueTime: null,
      title: piece.title,
      group: from.group,
      type: piece.type,
      target: piece.target,
      numericalValue: isNumericType(piece.type) ? 0 : null,
      stringValue: piece.type === "text" ? "" : null,
      restSeconds: piece.restSeconds,
      finalizedAt: null,
      isSkipped: false,
      assignee: null,
      note: piece.note,
      sortOrder: piece.sortOrder,
      createdAt: `${date}T05:00:00+00:00`,
      deletedAt: null,
    }),
  );
  return { parent, children };
}

for (let offset = -historyDays; offset <= 0; offset += 1) {
  const date = daysFromToday(offset);
  instantiated.push(date);
  for (const each of schedules) {
    if (!isDue({ schedule: each, date })) continue;
    const { parent, children } = instantiate({ from: each, date });
    if (offset < 0) finishSomehow({ parent, children, chance: each.group === "exercise" ? 0.6 : 0.8, date });
    rows.push(parent, ...children);
  }
}

function finishSomehow({ parent, children, chance, date }: { parent: Row; children: Row[]; chance: number; date: string }): void {
  const roll = random();
  if (roll > chance) {
    if (parent.type === "count" && roll < chance + 0.1) parent.numericalValue = Math.floor((parent.target ?? 0) * random());
    return;
  }
  const at = `${date}T${parent.dueTime ?? "18:30"}:00`;
  parent.finalizedAt = at;
  if (isNumericType(parent.type)) parent.numericalValue = parent.target;
  if (parent.type === "text") parent.stringValue = "Inbox at zero. Next week is light until Thursday.";
  for (const piece of children) {
    piece.finalizedAt = at;
    if (isNumericType(piece.type)) piece.numericalValue = piece.target;
  }
}

function oneOff(fields: Partial<Row> & { title: string; group: string }): Row {
  return {
    id: identifier("one"),
    parentId: null,
    scheduleId: null,
    dueDate: null,
    dueTime: null,
    type: "boolean",
    target: null,
    numericalValue: null,
    stringValue: null,
    restSeconds: null,
    finalizedAt: null,
    isSkipped: false,
    assignee: null,
    note: "",
    sortOrder: 0,
    createdAt: created(-15),
    deletedAt: null,
    ...fields,
  };
}

rows.push(
  oneOff({ title: "Call the pharmacy about the refill", group: "personal", dueDate: daysFromToday(-3), sortOrder: 0 }),
  oneOff({ title: "Get groceries", group: "personal", dueDate: daysFromToday(0), dueTime: "15:00", note: "Lentils, ghee, coffee beans, the good tomatoes.", sortOrder: 1 }),
  oneOff({ title: "Take the bins out", group: "personal", dueDate: daysFromToday(-1), finalizedAt: stamp(-1, "07:10:00"), sortOrder: 2 }),
  oneOff({ title: "Book the dentist", group: "personal", dueDate: daysFromToday(2), sortOrder: 3 }),
  oneOff({ title: "Return the library books", group: "personal", dueDate: daysFromToday(4), dueTime: "17:00", sortOrder: 4 }),
  oneOff({ title: "Sam's birthday dinner", group: "personal", dueDate: daysFromToday(6), dueTime: "19:30", note: "Bring the bottle from the cupboard.", sortOrder: 5 }),
  oneOff({ title: "Renew the passport", group: "personal", note: "Photos first. The form wants the old number.", sortOrder: 10 }),
  oneOff({ title: "Order more coffee", group: "personal", sortOrder: 12 }),
  oneOff({ title: "Fix the gate latch", group: "garden", sortOrder: 0 }),
  oneOff({ title: "Move the rosemary to the sunny bed", group: "garden", sortOrder: 1 }),
  oneOff({ title: "Refactor the auth middleware", group: "programming", note: "Started on branch auth-middleware.", sortOrder: 0 }),
  oneOff({ title: "Write tests for the recurrence maths", group: "programming", sortOrder: 1 }),
  oneOff({ title: "Tidy the dotfiles flake", group: "programming", sortOrder: 2 }),
  oneOff({ title: "Cache the health view refresh", group: "programming", finalizedAt: stamp(-2, "16:40:00"), dueDate: daysFromToday(-2), sortOrder: 3 }),
  oneOff({ title: "Read the Overstory", group: "personal", type: "count", target: 12, numericalValue: 3, note: "Chapters. Library copy, due in three weeks.", sortOrder: 13 }),
);

const portland = oneOff({ title: "Plan the trip to Portland", group: "personal", sortOrder: 11 });
rows.push(
  portland,
  oneOff({ title: "Pick dates", group: "personal", parentId: portland.id, finalizedAt: stamp(-4, "20:00:00"), sortOrder: 0 }),
  oneOff({ title: "Look at flights", group: "personal", parentId: portland.id, sortOrder: 1 }),
  oneOff({ title: "Ask about the dog", group: "personal", parentId: portland.id, sortOrder: 2 }),
);

function latestInstance(title: string): Row {
  const instances = rows.filter((row) => {
    const from = schedules.find((each) => each.id === row.scheduleId);
    return from?.title === title && row.parentId === null;
  });
  const found = instances[instances.length - 1];
  if (!found) throw new Error(`no instance of ${title}`);
  return found;
}

function oneOffRow(title: string): Row {
  const found = rows.find((row) => row.title === title && row.scheduleId === null && row.parentId === null);
  if (!found) throw new Error(`no one-off named ${title}`);
  return found;
}

const comments: Comment[] = [
  { id: identifier("cmt"), taskId: latestInstance("Morning stretch").id, body: "Left hip tight. Go slower on the second side of cat cow.", author: "user", writtenAt: stamp(-3, "07:52:00"), seenAt: stamp(-3, "07:52:00"), createdAt: created(-3) },
  { id: identifier("cmt"), taskId: latestInstance("Morning stretch").id, body: "Plank felt easy at 45s, try 60s next week.", author: "user", writtenAt: stamp(-10, "07:48:00"), seenAt: stamp(-10, "07:48:00"), createdAt: created(-10) },
  { id: identifier("cmt"), taskId: latestInstance("Physio and mobility").id, body: "Bird dog: the cue that works is reaching, not lifting.", author: "user", writtenAt: stamp(-5, "08:05:00"), seenAt: stamp(-5, "08:05:00"), createdAt: created(-5) },
  { id: identifier("cmt"), taskId: oneOffRow("Refactor the auth middleware").id, body: "The middleware reads the session from two places. Which one is canonical, the cookie or the header?", author: "agent", writtenAt: stamp(0, "06:12:00"), seenAt: null, createdAt: created(0) },
  { id: identifier("cmt"), taskId: oneOffRow("Plan the trip to Portland").id, body: "Flights are cheapest the second week of October.", author: "user", writtenAt: stamp(-4, "20:10:00"), seenAt: stamp(-4, "20:10:00"), createdAt: created(-4) },
];

function entry({ at, title, tags, body }: { at: string; title?: string; tags: string; body: string }): JournalEntry {
  return { sectionTitle: at, at, body, metadata: { ...(title ? { displayTitle: title } : {}), tags: tagsFrom(tags) } };
}

const journal: JournalEntry[] = [
  entry({ at: stamp(-14, "08:15:00"), tags: "personal", body: "Quiet morning. Coffee on the step. The neighbour's cat came over and sat on the warm stone." }),
  entry({
    at: stamp(-12, "21:40:00"),
    title: "after the session",
    tags: "therapy",
    body: "Talked about the thing from Tuesday. It is smaller when I say it out loud, more like a fact than a weather system.\n\n### homework\n\nNotice when I am bracing.",
  }),
  entry({ at: stamp(-9, "19:30:00"), tags: "exercise, climbing", body: "Hangboard felt heavy. Kept the 60s rest and it was fine by the third set." }),
  entry({
    at: stamp(-7, "07:42:00"),
    title: "slept badly",
    tags: "personal",
    body: "Slept badly. Sat for twelve minutes anyway. The room was quiet by the end and I noticed I did not want it to end.",
  }),
  entry({ at: stamp(-5, "18:05:00"), title: "blue v4", tags: "climbing", body: "Sent the blue V4 on the overhang. Heel hook first, then trust the left hand." }),
  entry({ at: stamp(-3, "21:10:00"), tags: "therapy, personal", body: "Walked before dinner. Fewer tabs open in my head." }),
  entry({
    at: stamp(-1, "07:40:00"),
    tags: "personal",
    body: "Rain. Wrote three lines and that was enough.\n\n- call the pharmacy\n- water is running low, eight glasses is a lot",
  }),
];

const notebook: JournalEntry[] = [
  entry({ at: stamp(-20, "15:15:00"), title: "the overstory", tags: "books", body: "Sam recommended The Overstory. Library has it, hold placed." }),
  entry({
    at: stamp(-18, "22:05:00"),
    title: "the dawn of everything",
    tags: "books",
    body: "Two hundred pages in and the argument is that the question itself is wrong. Worth finishing before the hold on The Overstory comes in.",
  }),
  entry({
    at: stamp(-11, "20:40:00"),
    title: "dal",
    tags: "recipes",
    body: "**Dal**: 1 cup red lentils, 3 cups water, turmeric, salt. 25 minutes.\n\n### tempering\n\nCumin, garlic and chilli in ghee at the end, poured over.",
  }),
  entry({
    at: stamp(-8, "19:15:00"),
    tags: "recipes",
    body: "Roast tomatoes at 200 for forty minutes with garlic and thyme, then blend with the stock. Cream is optional and the bread is not.",
  }),
  entry({
    at: stamp(-6, "11:02:00"),
    tags: "programming",
    body: "Parallax read-only role is `parallax_reader`. The todo schema is granted at migration time, so a new table needs a grant in the same migration.",
  }),
  entry({ at: stamp(-4, "13:30:00"), title: "books to find", tags: "books", body: "Anything else by Powers. The Le Guin essays. The short one about walking that Ana mentioned." }),
  entry({
    at: stamp(-2, "18:20:00"),
    title: "water filter",
    tags: "house",
    body: "The filter is the 3-pack, model on the inside of the fridge door. Change it the first of every month.",
  }),
  entry({ at: stamp(0, "09:30:00"), title: "rosemary", tags: "garden", body: "The rosemary wants the sunny bed by the fence. Move it before the frost." }),
];

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "parallax.json"), JSON.stringify({ schedules, tasks: rows, comments, instantiated }, null, 2));
writeFileSync(join(directory, "journal.md"), serializeMarkdown(journal));
writeFileSync(join(directory, "notebook.md"), serializeMarkdown(notebook));
console.log(`seeded ${directory}: ${schedules.length} schedules, ${rows.length} task rows, ${comments.length} comments, ${journal.length} journal entries, ${notebook.length} notes`);
