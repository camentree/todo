import { format } from "date-fns";
import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Sweep the porch";

async function matching(): Promise<Task[]> {
  const response = await fetch(`${BASE_URL}/api/today`);
  const tasks = (await response.json()) as Task[];
  return tasks.filter((task) => task.title === TITLE);
}

const created = (await fetch(`${BASE_URL}/api/tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    list: "Personal",
    title: TITLE,
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueTime: "09:00",
  }),
}).then((response) => response.json())) as Task;

console.log(`created one "${TITLE}", id ${created.id}`);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await openSheetFor(
  page,
  page.locator(".task", { hasText: TITLE }).first(),
);

await page.locator(".sheet-check input").click();
await page.waitForTimeout(1500);

console.log(
  "frequency shown:",
  await page.locator(".sheet-field select").last().inputValue(),
);

const afterRepeat = await matching();
console.log(`tasks named "${TITLE}" now:`, afterRepeat.length);
console.log(
  "the original is now recurring:",
  afterRepeat[0]?.recurringTaskId !== null,
);

await page
  .locator(".sheet-field select")
  .last()
  .selectOption("weekly");
await page.waitForTimeout(1200);
console.log(
  "after switching to weekly:",
  await page.locator(".sheet-every select").inputValue(),
);
console.log("tasks after switching:", (await matching()).length);

await page.locator(".sheet-check input").click();
await page.waitForTimeout(1500);
console.log(
  "still ticked after unticking:",
  await page.locator(".sheet-check input").isChecked(),
);
console.log(
  `tasks named "${TITLE}" after unticking:`,
  (await matching()).length,
);

await browser.close();

const UNDATED = "Wipe down the counters";

const undated = (await fetch(`${BASE_URL}/api/tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ list: "Personal", title: UNDATED }),
}).then((response) => response.json())) as Task;

await fetch(`${BASE_URL}/api/tasks/${undated.id}/repeat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ frequency: "daily" }),
});

const linked = (await fetch(
  `${BASE_URL}/api/tasks/${undated.id}`,
).then((response) => response.json())) as Task;

const todaysTasks = (await fetch(`${BASE_URL}/api/today`).then(
  (response) => response.json(),
)) as Task[];

console.log(
  "a dateless task made daily is due today:",
  linked.dueDate === format(new Date(), "yyyy-MM-dd"),
);
console.log(
  "and shows in Today:",
  todaysTasks.some((task) => task.title === UNDATED),
);
