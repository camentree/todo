import { format } from "date-fns";
import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import { sql } from "../server/database.ts";
import * as comments from "../server/operations/comments.ts";
import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function today(): Promise<Task[]> {
  const response = await fetch(
    `${BASE_URL}/api/tasks?attribute=due_date&value=${format(new Date(), "yyyy-MM-dd")}`,
  );
  return response.json() as Promise<Task[]>;
}

const created = (await fetch(`${BASE_URL}/api/tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    list: "Programming",
    title: "Undated task the agent asked about",
  }),
}).then((response) => response.json())) as Task;

await comments.add({
  taskId: created.id,
  body: "Which database should this use?",
  author: "claude",
  source: "agent",
});

const before = await today();
const commented = before.find((task) => task.id === created.id);

if (!commented) {
  console.log("an undated task with a comment never reached Today");
  await sql.end();
  process.exit(1);
}

console.log(
  `"${commented.title}" is in Today with ${commented.unseenCommentCount} unseen and no due date`,
);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await openSheetFor(
  page,
  page.locator(".task", { hasText: commented.title }).first(),
);
await page
  .locator(".sheet-section-head", { hasText: "Comments" })
  .click();
await page.waitForTimeout(900);

const after = await today();
const stillThere = after.find((task) => task.id === commented.id);

console.log(
  "unseen after opening comments:",
  (await fetch(`${BASE_URL}/api/tasks/${commented.id}`)
    .then((response) => response.json())
    .then((task: Task) => task.unseenCommentCount)) ?? "?",
);
console.log("still in Today:", stillThere !== undefined);

await browser.close();
await sql.end();
