import { format } from "date-fns";
import { chromium, devices } from "playwright";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

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

async function renameFirstTo(text: string): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.locator(".task-title").first().click();
  await page.waitForTimeout(400);
  await page.locator("input.task-title").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1300);
}

const before = (await (
  await fetch(
    `${BASE_URL}/api/tasks?attribute=due_date&value=${format(new Date(), "yyyy-MM-dd")}`,
  )
).json()) as Task[];
const original = before[0];
console.log(
  `starting from "${original?.title}", tags [${original?.tags.join(",")}], who ${original?.who ?? "-"}, due ${original?.dueDate ?? "-"}`,
);

console.log("\nSIGILS APPLY");
await renameFirstTo("Call the pharmacy #errand @camen");
const tagged = await taskNamed("Call the pharmacy");
console.log("  title:", tagged?.title);
console.log("  tags:", tagged?.tags.join(","));
console.log("  who:", tagged?.who);

console.log("\nDATE WORDS STAY IN THE TITLE");
await renameFirstTo("Call the pharmacy tomorrow morning");
const dated = await taskNamed("Call the pharmacy tomorrow morning");
console.log("  title kept verbatim:", dated !== undefined);
console.log(
  "  due date unchanged:",
  dated?.dueDate === original?.dueDate,
  `(${dated?.dueDate ?? "-"})`,
);

console.log("\nOLD VALUES SURVIVE A PLAIN RENAME");
await renameFirstTo("Call the chemist");
const plain = await taskNamed("Call the chemist");
console.log("  tags kept:", plain?.tags.join(","));
console.log("  who kept:", plain?.who);
console.log("  list kept:", plain?.list);

await browser.close();
