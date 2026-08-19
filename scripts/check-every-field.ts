import { format } from "date-fns";
import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import type { RecurringTask, Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Water the ferns";

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

const every = page.locator(".sheet-every input");
console.log("starts at:", await every.inputValue());

await every.click();
await page.keyboard.press("Backspace");
console.log("after clearing:", `"${await every.inputValue()}"`);

await page.keyboard.type("3");
console.log("after typing 3:", await every.inputValue());

await page.keyboard.press("Enter");
await page.waitForTimeout(1400);

const task = (await (
  await fetch(`${BASE_URL}/api/tasks/${created.id}`)
).json()) as Task;
const schedule = (await (
  await fetch(`${BASE_URL}/api/recurring/${task.recurringTaskId}`)
).json()) as RecurringTask;

console.log("saved repeatEvery:", schedule.repeatEvery);
console.log("field shows:", await every.inputValue());

await browser.close();
