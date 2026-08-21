import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";
import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const TITLE = "Refactor the auth middleware";

async function taskNamed(title: string): Promise<Task | undefined> {
  const tasks = (await (
    await fetch(`${BASE_URL}/api/tasks`)
  ).json()) as Task[];
  return tasks.find((task) => task.title === title);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

await page.goto(`${BASE_URL}/list/Programming`, {
  waitUntil: "networkidle",
});
await openSheetFor(
  page,
  page.locator(".task", { hasText: TITLE }).first(),
);

console.log(
  "starting tags:",
  (await taskNamed(TITLE))?.tags.join(","),
);

console.log("\nA TAG TYPED INTO THE TITLE");
await page.locator(".sheet-title").fill(`${TITLE} #urgent @camen`);
await page.locator(".sheet-title").blur();
await page.waitForTimeout(1200);
const tagged = await taskNamed(TITLE);
console.log("  title:", tagged?.title);
console.log("  tags:", tagged?.tags.join(","));
console.log("  who:", tagged?.who);

console.log("\nNO WAY TO ADD A TAG BUT THE TITLE");
console.log(
  "  add field present:",
  (await page.locator(".tag-input").count()) > 0,
);

console.log("\nA DATE IS OFFERED, NOT TAKEN");
await page.locator(".sheet-title").fill(`${TITLE} tomorrow`);
await page.waitForTimeout(300);
console.log(
  "  chip offered:",
  await page
    .locator(".sheet-guesses .capture-chip")
    .allTextContents(),
);
await page.locator(".sheet-guesses .capture-chip").first().click();
await page.waitForTimeout(1200);
const dated = await taskNamed(TITLE);
console.log("  title:", dated?.title);
console.log("  due date:", dated?.dueDate);

console.log("\nCHIPS STILL REMOVE A TAG");
await page
  .locator(".tag-chip", { hasText: "parallax" })
  .first()
  .click();
await page.waitForTimeout(1200);
console.log(
  "  tags:",
  (await taskNamed(TITLE))?.tags.join(","),
  "· chips on screen:",
  await page.locator(".tag-chip").allTextContents(),
);

await browser.close();
