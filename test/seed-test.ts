import { addDays, format } from "date-fns";

import { migrate } from "../scripts/migrate.ts";
import { sql } from "../server/database.ts";
import * as recurring from "../server/operations/recurring.ts";
import * as tasks from "../server/operations/tasks.ts";
import type { TaskStage } from "@shared/stages.ts";
import type { TaskState } from "@shared/states.ts";

function day(offset: number): string {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

interface Seed {
  title: string;
  list: string;
  state?: TaskState;
  stage?: TaskStage;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[];
  who?: string | null;
  note?: string | null;
  subtasks?: string[];
  agentComment?: string;
}

const SEEDS: Seed[] = [
  {
    list: "Personal",
    title: "Call the pharmacy about the refill",
    dueDate: day(0),
  },
  {
    list: "Personal",
    title: "Get groceries",
    dueDate: day(0),
    dueTime: "15:00",
    tags: ["errand"],
  },
  {
    list: "Personal",
    title: "Pay rent",
    dueDate: day(-2),
    tags: ["money"],
    note: "Standing order failed last month, check it went through.",
  },
  {
    list: "Personal",
    title: "Book the dentist",
    dueDate: day(-5),
    tags: ["health"],
  },
  {
    list: "Personal",
    title: "Renew the passport",
    dueDate: day(-12),
    tags: ["admin"],
  },
  {
    list: "Personal",
    title: "Email the landlord about the boiler",
    tags: ["admin"],
  },
  {
    list: "Personal",
    title: "Plan the trip to Portland",
    dueDate: day(6),
    tags: ["trip"],
    subtasks: ["Pick dates", "Look at flights", "Ask about the dog"],
  },
  {
    list: "Personal",
    title: "Return the library books",
    dueDate: day(1),
    tags: ["errand"],
  },
  {
    list: "Personal",
    title: "Fix the bike puncture",
    tags: ["house"],
  },
  {
    list: "Personal",
    title: "Order more coffee",
    dueDate: day(3),
    tags: ["errand"],
  },
  { list: "Personal", title: "Back up the photos", tags: ["admin"] },
  {
    list: "Personal",
    title: "Write to Sam",
    dueDate: day(-1),
    state: "skipped",
    tags: ["people"],
  },
  {
    list: "Personal",
    title: "Clear the garage",
    dueDate: day(-8),
    state: "missed",
  },
  {
    list: "Personal",
    title: "Take the bins out",
    dueDate: day(0),
    state: "complete",
  },
  {
    list: "Personal",
    title: "Pick up the prescription",
    dueDate: day(-3),
    state: "complete",
  },

  { list: "Habits", title: "Read for 20 minutes", dueDate: day(0) },
  {
    list: "Habits",
    title: "Journal",
    dueDate: day(-1),
    state: "skipped",
  },

  {
    list: "Programming",
    title: "Refactor the auth middleware",
    stage: "blocked",
    tags: ["parallax"],
    who: "claude",
    dueDate: day(0),
    agentComment:
      "Two auth paths exist, the Access header and the legacy token. Which do I keep?",
  },
  {
    list: "Programming",
    title: "Add pagination to the notes endpoint",
    stage: "in_progress",
    tags: ["parallax"],
    who: "claude",
  },
  {
    list: "Programming",
    title: "Cache the health view refresh",
    stage: "in_review",
    tags: ["parallax"],
    who: "claude",
    dueDate: day(-1),
  },
  {
    list: "Programming",
    title: "Port the ntfy client to the new config",
    stage: "blocked",
    tags: ["parallax"],
    who: "claude",
    note: "Waiting on the server rebuild.",
  },
  {
    list: "Programming",
    title: "Write tests for the recurrence maths",
    tags: ["parallax-frontend"],
    who: "claude",
    dueDate: day(2),
  },
  {
    list: "Programming",
    title: "Set up the MCP server route",
    tags: ["parallax-frontend"],
    who: "claude",
  },
  {
    list: "Programming",
    title: "Tidy the dotfiles flake",
    tags: ["dotfiles"],
    who: "camen",
    dueDate: day(4),
  },
  {
    list: "Programming",
    title: "Upgrade Postgres to 18",
    stage: "blocked",
    tags: ["dotfiles"],
    who: "camen",
  },
  {
    list: "Programming",
    title: "Delete the dead status agent",
    state: "complete",
    tags: ["parallax"],
    who: "claude",
    dueDate: day(0),
  },
  {
    list: "Programming",
    title: "Investigate the slow memory search",
    stage: "in_progress",
    tags: ["parallax"],
    who: "claude",
    dueDate: day(-2),
  },
];

const LIVE_DATABASE = "parallax";

function refuseToSeedLiveData(): void {
  const databaseName = new URL(
    process.env.DATABASE_URL ?? "",
  ).pathname.replace("/", "");
  if (databaseName === LIVE_DATABASE) {
    throw new Error(
      `${LIVE_DATABASE} holds the real tasks and seeding truncates. Point DATABASE_URL somewhere else.`,
    );
  }
}

async function seed(): Promise<void> {
  refuseToSeedLiveData();

  await migrate();

  await sql`
    truncate todo.tasks, todo.recurring_tasks, todo.events, todo.comments
    restart identity cascade
  `;

  for (const entry of SEEDS) {
    const created = await tasks.create({
      list: entry.list,
      title: entry.title,
      note: entry.note ?? null,
      stage: entry.stage ?? null,
      tags: entry.tags ?? [],
      who: entry.who ?? null,
      dueDate: entry.dueDate ?? null,
      dueTime: entry.dueTime ?? null,
    });

    for (const title of entry.subtasks ?? []) {
      await tasks.create({
        list: entry.list,
        parentId: created.id,
        title: title,
      });
    }

    if (entry.state) {
      await tasks.setState(created.id, entry.state);
    }

    if (entry.agentComment) {
      await sql`
        insert into todo.comments (task_id, author, body)
        values (${created.id}, 'claude', ${entry.agentComment})
      `;
    }
  }

  await recurring.create({
    list: "Habits",
    title: "10 pushups",
    frequency: "daily",
    subtaskTitles: ["warm up", "10 pushups", "stretch"],
  });
  await recurring.create({
    list: "Habits",
    title: "Physio — lower back",
    frequency: "daily",
    dueTime: "08:00",
    subtaskTitles: ["cat-cow", "bird dog", "glute bridge"],
  });
  await recurring.create({
    list: "Habits",
    title: "Water the plants",
    frequency: "weekly",
    weekdays: [1],
  });
  await recurring.create({
    list: "Personal",
    title: "Weekly review",
    frequency: "weekly",
    weekdays: [0],
    subtaskTitles: [
      "Clear the inbox",
      "Look at next week",
      "Tidy the lists",
    ],
  });
  await recurring.create({
    list: "Personal",
    title: "Change the water filter",
    frequency: "monthly",
    dayOfMonth: 1,
  });

  await recurring.generateDue();

  await sql`
    insert into todo.events (task_id, source, summary) values
      (null, 'agent', 'Claude asked something on "Refactor the auth middleware"'),
      (null, 'agent', '"Cache the health view refresh" moved to In Review'),
      (null, 'mcp', 'Added "Order more coffee" from a conversation')
  `;

  await sql.end();
  console.log("seeded");
}

await seed();
