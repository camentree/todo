import { chromium, devices } from "playwright";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Get groceries";

async function taskByTitle(): Promise<Task> {
  const response = await fetch(`${BASE_URL}/api/tasks`);
  const tasks = (await response.json()) as Task[];
  return tasks.find((task) => task.title === TITLE) as Task;
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await page
  .locator(".task", { hasText: TITLE })
  .first()
  .locator(".task-title")
  .click();
await page.waitForTimeout(450);
await page
  .locator('.task[data-editing="true"] .task-info')
  .first()
  .click();
await page.waitForTimeout(700);

const date = page.getByLabel("Date", { exact: true });
const time = page.getByLabel("Time", { exact: true });

console.log("date starts at:", await date.inputValue());

await date.click();
await page.keyboard.press("Home");
for (const character of "12252027") {
  await page.keyboard.type(character);
  await page.waitForTimeout(150);
}
console.log("date after typing 12/25/2027:", await date.inputValue());

await time.click();
await page.keyboard.press("Home");
for (const character of "0945AM") {
  await page.keyboard.type(character);
  await page.waitForTimeout(150);
}
console.log("time after typing 09:45 AM:", await time.inputValue());

await page.locator(".sheet-title").click();
await page.waitForTimeout(1200);

const typed = await taskByTitle();
console.log("saved date:", typed.dueDate);
console.log("saved time:", typed.dueTime);

await page.getByLabel("Clear the time").click();
await page.waitForTimeout(900);
await page.getByLabel("Clear the date").click();
await page.waitForTimeout(900);

const cleared = await taskByTitle();
console.log("date after clearing:", cleared.dueDate);
console.log("time after clearing:", cleared.dueTime);
console.log(
  "empty date reads as empty:",
  await date.getAttribute("data-empty"),
);

await browser.close();
