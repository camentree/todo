import { chromium, devices } from "playwright";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function titlesInToday(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/api/today`);
  const tasks = (await response.json()) as Task[];
  return tasks.map((task) => task.title);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

console.log("RENAMING IN PLACE");
const firstTitle = await page
  .locator(".task-title")
  .first()
  .textContent();
console.log("  before:", firstTitle);

await page.locator(".task-title").first().click();
await page.waitForTimeout(400);
console.log(
  "  info button appeared:",
  (await page.locator(".task-info").count()) > 0,
);

await page
  .locator("input.task-title")
  .fill("Renamed without the sheet");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);

console.log(
  "  saved:",
  (await titlesInToday()).includes("Renamed without the sheet"),
);
console.log(
  "  sheet stayed shut:",
  (await page.locator(".sheet").count()) === 0,
);

console.log("\nOPENING INFO FROM THE ROW");
await page.locator(".task-title").first().click();
await page.waitForTimeout(400);
await page.locator(".task-info").click();
await page.waitForTimeout(700);
console.log(
  "  sheet opened:",
  (await page.locator(".sheet").count()) > 0,
);
await page.locator(".scrim").click({ position: { x: 10, y: 10 } });
await page.waitForTimeout(1100);

console.log("\nADDING A TASK IN THE LIST");
await page.getByRole("button", { name: "Add a task" }).click();
await page.waitForTimeout(500);
console.log(
  "  draft row present:",
  (await page.locator(".new-task").count()) > 0,
);
console.log(
  "  floating card gone:",
  (await page.locator(".capture-card").count()) === 0,
);

await page
  .locator(".new-task input")
  .fill("Water the fiddle leaf #plants tomorrow");
await page.waitForTimeout(500);
console.log(
  "  chips:",
  await page
    .locator(".new-task .capture-chip")
    .allTextContents()
    .then((chips) => chips.join(" ")),
);

await page.keyboard.press("Enter");
await page.waitForTimeout(1400);

const saved = (await (
  await fetch(`${BASE_URL}/api/tasks`)
).json()) as Task[];
const added = saved.find((task) =>
  task.title.startsWith("Water the fiddle"),
);
console.log("  saved title:", added?.title);
console.log("  landed in list:", added?.list);
console.log("  tags:", added?.tags.join(","));
console.log("  due:", added?.dueDate);
console.log(
  "  row stays open for the next one:",
  (await page.locator(".new-task").count()) > 0,
);

await browser.close();
