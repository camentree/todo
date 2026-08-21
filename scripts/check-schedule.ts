import { addDays, format, parseISO } from "date-fns";
import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import { dueDatesBetween } from "@shared/recurrence.ts";
import type { RecurringTask, Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Sweep the porch";

async function scheduleOf(
  recurringTaskId: number,
): Promise<RecurringTask> {
  const response = await fetch(
    `${BASE_URL}/api/recurring/${recurringTaskId}`,
  );
  return response.json() as Promise<RecurringTask>;
}

async function taskById(id: number): Promise<Task> {
  const response = await fetch(`${BASE_URL}/api/tasks/${id}`);
  return response.json() as Promise<Task>;
}

const created = (await fetch(`${BASE_URL}/api/tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    list: "Personal",
    title: TITLE,
    dueDate: format(new Date(), "yyyy-MM-dd"),
  }),
}).then((response) => response.json())) as Task;

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

await page.locator(".sheet-every select").selectOption("weekly");
await page.waitForTimeout(1200);
await page.locator(".sheet-every input").fill("2");
await page.locator(".sheet-every input").blur();
await page.waitForTimeout(1200);

const chips = page.locator(".weekday");
const wanted = new Set([2, 4]);
for (let index = 0; index < 7; index += 1) {
  const on =
    (await chips.nth(index).getAttribute("data-on")) === "true";
  if (on !== wanted.has(index)) {
    await chips.nth(index).click();
    await page.waitForTimeout(900);
  }
}

console.log(
  "chips on:",
  await page
    .locator('.weekday[data-on="true"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent).join(""),
    ),
);

await page.locator('.sheet-field input[type="time"]').fill("07:30");
await page.locator('.sheet-field input[type="time"]').blur();
await page.waitForTimeout(1400);

const linked = await taskById(created.id);
const schedule = await scheduleOf(linked.recurringTaskId ?? 0);

console.log("frequency:", schedule.frequency);
console.log("every:", schedule.repeatEvery);
console.log("weekdays:", schedule.weekdays.join(","));
console.log("starts on:", schedule.startsOn);
console.log("schedule time:", schedule.dueTime);
console.log("task time followed:", linked.dueTime);

console.log(
  "next six dates:",
  dueDatesBetween({
    schedule: {
      frequency: schedule.frequency,
      repeatEvery: schedule.repeatEvery,
      weekdays: schedule.weekdays,
      dayOfMonth: schedule.dayOfMonth,
      startsOn: schedule.startsOn,
    },
    from: schedule.startsOn,
    through: format(
      addDays(parseISO(schedule.startsOn), 40),
      "yyyy-MM-dd",
    ),
  })
    .slice(0, 6)
    .map((date) => format(parseISO(date), "EEE d MMM"))
    .join(" · "),
);

await browser.close();
