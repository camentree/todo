import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function subtaskTitles(): Promise<string[]> {
  const tasks = (await (
    await fetch(`${BASE_URL}/api/tasks?list=Habits`)
  ).json()) as Task[];
  const parent = tasks.find((task) => task.title === "10 pushups");
  return (parent?.subtasks ?? []).map((subtask) => subtask.title);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/list/Habits`, {
  waitUntil: "networkidle",
});
await openSheetFor(
  page,
  page.locator(".task", { hasText: "10 pushups" }).first(),
);
await page
  .locator(".sheet-section-head", { hasText: "Subtasks" })
  .click();
await page.waitForTimeout(600);

console.log("before:", (await subtaskTitles()).join(" | "));
console.log(
  "plus buttons in the section:",
  await page.locator(".sheet-plus").count(),
);
console.log(
  "rows in the section:",
  await page.locator(".sheet-subtask").count(),
);

await page.locator(".subtask-title").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({
  path: "/tmp/parallax-shots/subtask-add.png",
});

await page.locator(".subtask-title").fill("cool down");
await page.keyboard.press("Enter");
await page.waitForTimeout(1300);

console.log("after: ", (await subtaskTitles()).join(" | "));
console.log(
  "field cleared for the next one:",
  (await page.locator(".subtask-title").inputValue()) === "",
);

await browser.close();
