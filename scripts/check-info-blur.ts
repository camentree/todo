import { chromium, devices } from "playwright";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function titlesInToday(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/api/today`);
  const tasks = (await response.json()) as Task[];
  return tasks.map((task) => task.title);
}

async function focusedTag(
  page: import("playwright").Page,
): Promise<string> {
  return page.evaluate(
    () => document.activeElement?.tagName ?? "NONE",
  );
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

await page.locator(".task-title").first().click();
await page.waitForTimeout(400);
console.log("focused while editing:", await focusedTag(page));

await page.locator(".task-info").first().click();
await page.waitForTimeout(800);
console.log("focused after tapping info:", await focusedTag(page));
console.log(
  "sheet opened:",
  (await page.locator(".sheet").count()) > 0,
);
console.log(
  "row left edit mode:",
  (await page.locator("input.task-title").count()) === 0,
);

await page.locator(".scrim").click({ position: { x: 10, y: 10 } });
await page.waitForTimeout(1100);

console.log("\nAN EDIT IN PROGRESS IS KEPT");
await page.locator(".task-title").first().click();
await page.waitForTimeout(400);
await page.locator("input.task-title").fill("Edited then opened");
await page.locator(".task-info").first().click();
await page.waitForTimeout(1200);
console.log(
  "  saved:",
  (await titlesInToday()).includes("Edited then opened"),
);
console.log("  focused:", await focusedTag(page));

await browser.close();
