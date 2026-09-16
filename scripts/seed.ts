import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isDue } from "../shared/schedule.ts";
import { serializeMarkdown } from "../server/store.ts";
import type { Comment, Definition, JournalEntry, Part, Task } from "../shared/model.ts";

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

function part({ name, kind = "boolean", target = 0, timer = 0, note = "" }: Partial<Part> & { name: string }): Part {
  return { name, kind, target, timer, note };
}

function definition(fields: Partial<Definition> & { name: string; group: string; every: string }): Definition {
  return {
    id: identifier("def"),
    kind: "boolean",
    target: 0,
    timer: 0,
    rest: 0,
    time: null,
    anchor: daysFromToday(-historyDays),
    parts: [],
    note: "",
    sort: 0,
    created: daysFromToday(-historyDays),
    ended: null,
    ...fields,
  };
}

const definitions: Definition[] = [
  definition({ name: "Journal", group: "habits", every: "1d", sort: 0 }),
  definition({ name: "Meditate", group: "habits", every: "1d", kind: "timer", timer: 600, sort: 1 }),
  definition({ name: "Drink water", group: "habits", every: "1d", kind: "count", target: 8, sort: 2 }),
  definition({ name: "Read for twenty minutes", group: "habits", every: "1d", kind: "timer", timer: 1200, time: "21:00", sort: 3 }),
  definition({
    name: "Morning stretch",
    group: "exercise",
    every: "mo,we,fr",
    rest: 30,
    time: "07:30",
    note: "Keep hips level through the plank. Breathe out on the way down in cat cow.",
    parts: [
      part({ name: "neck rolls", kind: "timer", timer: 30 }),
      part({ name: "cat cow", kind: "count", target: 10 }),
      part({ name: "plank", kind: "timer", timer: 45, note: "elbows under shoulders" }),
      part({ name: "side bend", kind: "count", target: 8 }),
    ],
    sort: 0,
  }),
  definition({ name: "Pull-ups", group: "exercise", every: "mo,we,fr", kind: "count", target: 5, sort: 1 }),
  definition({ name: "Push-ups", group: "exercise", every: "mo,we,fr", kind: "count", target: 20, sort: 2 }),
  definition({ name: "Yoga", group: "exercise", every: "tu,th", kind: "timer", timer: 1800, sort: 3 }),
  definition({
    name: "Physio and mobility",
    group: "exercise",
    every: "tu,th,sa",
    rest: 45,
    parts: [
      part({ name: "cat-cow with slow breathing", kind: "count", target: 12 }),
      part({ name: "bird dog, hold each side for two breaths", kind: "count", target: 10 }),
      part({ name: "glute bridge", kind: "count", target: 15 }),
      part({ name: "dead bug", kind: "count", target: 10 }),
    ],
    sort: 4,
  }),
  definition({ name: "Long run", group: "exercise", every: "sa", kind: "timer", timer: 3600, sort: 5 }),
  definition({ name: "Water the plants", group: "garden", every: "1w", sort: 0 }),
  definition({ name: "Change the water filter", group: "personal", every: "1m", sort: 5 }),
  definition({ name: "Weekly review", group: "personal", every: "su", kind: "text", note: "Clear the inbox, look at next week, tidy the lists.", sort: 6 }),
];

const tasks: Task[] = [];
const instantiated: string[] = [];
const random = seeded(7);

for (let offset = -historyDays; offset <= 0; offset += 1) {
  const date = daysFromToday(offset);
  instantiated.push(date);
  for (const each of definitions) {
    if (!isDue({ every: each.every, anchor: each.anchor, date })) continue;
    const task: Task = {
      id: identifier("tsk"),
      definitionId: each.id,
      date,
      time: each.time,
      name: each.name,
      group: each.group,
      kind: each.kind,
      target: each.target,
      timer: each.timer,
      rest: each.rest,
      current: 0,
      value: "",
      doneAt: null,
      note: each.note,
      parts: each.parts.map((piece) => ({ ...piece, current: 0, value: "", doneAt: null })),
      sort: each.sort,
      created: `${date}T00:00:00`,
    };
    if (offset < 0) finishSomehow({ task, chance: each.group === "exercise" ? 0.6 : 0.8, date });
    tasks.push(task);
  }
}

function finishSomehow({ task, chance, date }: { task: Task; chance: number; date: string }): void {
  const roll = random();
  if (roll > chance) {
    if (task.kind === "count" && roll < chance + 0.1) task.current = Math.floor(task.target * random());
    return;
  }
  const at = `${date}T${task.time ?? "18:30"}:00`;
  task.doneAt = at;
  if (task.kind === "count") task.current = task.target;
  if (task.kind === "text") task.value = "Inbox at zero. Next week is light until Thursday.";
  for (const piece of task.parts) {
    piece.doneAt = at;
    if (piece.kind === "count") piece.current = piece.target;
  }
}

function oneOff(fields: Partial<Task> & { name: string; group: string }): Task {
  return {
    id: identifier("one"),
    definitionId: null,
    date: null,
    time: null,
    kind: "boolean",
    target: 0,
    timer: 0,
    rest: 0,
    current: 0,
    value: "",
    doneAt: null,
    note: "",
    parts: [],
    sort: 0,
    created: stamp(-10, "09:00:00"),
    ...fields,
  };
}

tasks.push(
  oneOff({ name: "Call the pharmacy about the refill", group: "personal", date: daysFromToday(-3), sort: 0 }),
  oneOff({ name: "Get groceries", group: "personal", date: daysFromToday(0), time: "15:00", note: "Lentils, ghee, coffee beans, the good tomatoes.", sort: 1 }),
  oneOff({ name: "Take the bins out", group: "personal", date: daysFromToday(-1), doneAt: stamp(-1, "07:10:00"), sort: 2 }),
  oneOff({ name: "Book the dentist", group: "personal", date: daysFromToday(2), sort: 3 }),
  oneOff({ name: "Return the library books", group: "personal", date: daysFromToday(4), time: "17:00", sort: 4 }),
  oneOff({ name: "Sam's birthday dinner", group: "personal", date: daysFromToday(6), time: "19:30", note: "Bring the bottle from the cupboard.", sort: 5 }),
  oneOff({ name: "Renew the passport", group: "personal", note: "Photos first. The form wants the old number.", sort: 10 }),
  oneOff({
    name: "Plan the trip to Portland",
    group: "personal",
    parts: [
      { name: "Pick dates", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: stamp(-4, "20:00:00") },
      { name: "Look at flights", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: null },
      { name: "Ask about the dog", kind: "boolean", target: 0, timer: 0, note: "", current: 0, value: "", doneAt: null },
    ],
    sort: 11,
  }),
  oneOff({ name: "Order more coffee", group: "personal", sort: 12 }),
  oneOff({ name: "Fix the gate latch", group: "garden", sort: 0 }),
  oneOff({ name: "Move the rosemary to the sunny bed", group: "garden", sort: 1 }),
  oneOff({ name: "Refactor the auth middleware", group: "programming", note: "Started on branch auth-middleware.", sort: 0 }),
  oneOff({ name: "Write tests for the recurrence maths", group: "programming", sort: 1 }),
  oneOff({ name: "Tidy the dotfiles flake", group: "programming", sort: 2 }),
  oneOff({ name: "Cache the health view refresh", group: "programming", doneAt: stamp(-2, "16:40:00"), date: daysFromToday(-2), sort: 3 }),
  oneOff({ name: "Read the Overstory", group: "personal", kind: "count", target: 12, current: 3, note: "Chapters. Library copy, due in three weeks.", sort: 13 }),
);

const stretch = definitions.find((each) => each.name === "Morning stretch")!;
const physio = definitions.find((each) => each.name === "Physio and mobility")!;

const comments: Comment[] = [
  { id: identifier("cmt"), definitionId: stretch.id, taskName: stretch.name, body: "Left hip tight. Go slower on the second side of cat cow.", author: "camen", writtenAt: stamp(-3, "07:52:00"), seenAt: stamp(-3, "07:52:00") },
  { id: identifier("cmt"), definitionId: stretch.id, taskName: stretch.name, body: "Plank felt easy at 45s, try 60s next week.", author: "camen", writtenAt: stamp(-10, "07:48:00"), seenAt: stamp(-10, "07:48:00") },
  { id: identifier("cmt"), definitionId: physio.id, taskName: physio.name, body: "Bird dog: the cue that works is reaching, not lifting.", author: "camen", writtenAt: stamp(-5, "08:05:00"), seenAt: stamp(-5, "08:05:00") },
  { id: identifier("cmt"), definitionId: null, taskName: "Refactor the auth middleware", body: "The middleware reads the session from two places. Which one is canonical, the cookie or the header?", author: "claude", writtenAt: stamp(0, "06:12:00"), seenAt: null },
  { id: identifier("cmt"), definitionId: null, taskName: "Plan the trip to Portland", body: "Flights are cheapest the second week of October.", author: "camen", writtenAt: stamp(-4, "20:10:00"), seenAt: stamp(-4, "20:10:00") },
];

const journal: JournalEntry[] = [
  { id: identifier("jnl"), at: stamp(-14, "08:15"), tags: ["personal"], task: null, body: "Quiet morning. Coffee on the step. The neighbour's cat came over and sat on the warm stone." },
  { id: identifier("jnl"), at: stamp(-12, "21:40"), tags: ["therapy"], task: null, body: "Talked about the thing from Tuesday. It is smaller when I say it out loud, more like a fact than a weather system.\n\nHomework: notice when I am bracing." },
  { id: identifier("jnl"), at: stamp(-9, "19:30"), tags: ["exercise", "climbing"], task: null, body: "Hangboard felt heavy. Kept the 60s rest and it was fine by the third set." },
  { id: identifier("jnl"), at: stamp(-7, "07:42"), tags: ["personal"], task: "Journal", body: "Slept badly. Sat for twelve minutes anyway. The room was quiet by the end and I noticed I did not want it to end." },
  { id: identifier("jnl"), at: stamp(-5, "18:05"), tags: ["climbing"], task: null, body: "Sent the blue V4 on the overhang. Heel hook first, then trust the left hand." },
  { id: identifier("jnl"), at: stamp(-3, "21:10"), tags: ["therapy", "personal"], task: null, body: "Walked before dinner. Fewer tabs open in my head." },
  { id: identifier("jnl"), at: stamp(-1, "07:40"), tags: ["personal"], task: "Journal", body: "Rain. Wrote three lines and that was enough.\n\n- call the pharmacy\n- water is running low, eight glasses is a lot" },
];

const notebook: JournalEntry[] = [
  { id: identifier("nte"), at: stamp(-20, "15:15"), tags: ["books"], task: null, body: "Sam recommended The Overstory. Library has it, hold placed." },
  { id: identifier("nte"), at: stamp(-11, "20:40"), tags: ["recipes"], task: null, body: "**Dal**: 1 cup red lentils, 3 cups water, turmeric, salt. Temper cumin, garlic, chilli in ghee at the end. 25 minutes." },
  { id: identifier("nte"), at: stamp(-6, "11:02"), tags: ["programming"], task: null, body: "Parallax read-only role is `parallax_reader`. The todo schema is granted at migration time, so a new table needs a grant in the same migration." },
  { id: identifier("nte"), at: stamp(-2, "18:20"), tags: ["house"], task: null, body: "Water filter is the 3-pack, model on the inside of the fridge door. Change it the first of every month." },
  { id: identifier("nte"), at: stamp(0, "09:30"), tags: ["garden"], task: null, body: "Rosemary wants the sunny bed by the fence. Move it before the frost." },
];

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "parallax.json"), JSON.stringify({ definitions, tasks, comments, instantiated }, null, 2));
writeFileSync(join(directory, "journal.md"), serializeMarkdown(journal));
writeFileSync(join(directory, "notebook.md"), serializeMarkdown(notebook));
console.log(`seeded ${directory}: ${definitions.length} definitions, ${tasks.length} tasks, ${comments.length} comments, ${journal.length} journal entries, ${notebook.length} notes`);
