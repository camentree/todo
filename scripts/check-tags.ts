import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Refactor the auth middleware";

async function tagsOn(title: string): Promise<string[]> {
  const tasks = (await (
    await fetch(`${BASE_URL}/api/tasks`)
  ).json()) as Task[];
  return tasks.find((task) => task.title === title)?.tags ?? [];
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/list/Programming`, {
  waitUntil: "networkidle",
});
await openSheetFor(
  page,
  page.locator(".task", { hasText: TITLE }).first(),
);

console.log("starting tags:", (await tagsOn(TITLE)).join(","));

console.log(
  "suggestions offered:",
  await page
    .locator("#known-tags option")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value")).join(","),
    ),
);

await page.locator(".tag-input").fill("urgent");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
console.log("after adding urgent:", (await tagsOn(TITLE)).join(","));

await page
  .locator(".tag-chip", { hasText: "parallax" })
  .first()
  .click();
await page.waitForTimeout(1200);
console.log(
  "after removing parallax:",
  (await tagsOn(TITLE)).join(","),
);

console.log(
  "chips on screen:",
  await page.locator(".tag-chip").allTextContents(),
);

await browser.close();
