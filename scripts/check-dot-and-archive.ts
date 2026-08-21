import { format } from "date-fns";
import { chromium, devices } from "playwright";

import type { Task } from "@shared/types.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function taskById(id: number): Promise<Task> {
  return (await (
    await fetch(`${BASE_URL}/api/tasks/${id}`)
  ).json()) as Task;
}

const today = (await (
  await fetch(
    `${BASE_URL}/api/tasks?attribute=due_date&value=${format(new Date(), "yyyy-MM-dd")}`,
  )
).json()) as Task[];
const commented = today.find((task) => task.commentCount > 0);

if (!commented) {
  console.log("no commented task in the seed");
  process.exit(1);
}

console.log("THE DOT FOLLOWS WHO SPOKE LAST");
console.log(
  `  "${commented.title}" after the agent commented:`,
  commented.lastCommentFromOthers,
);

await fetch(`${BASE_URL}/api/tasks/${commented.id}/comments`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ body: "Use Postgres, same as the rest." }),
});

console.log(
  "  after I replied:",
  (await taskById(commented.id)).lastCommentFromOthers,
);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
console.log(
  "  dots on screen:",
  await page.locator(".comment-dot").count(),
);

console.log("\nARCHIVE");
await fetch(`${BASE_URL}/api/tasks/archive`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    ids: today.slice(0, 3).map((task) => task.id),
  }),
});
await page.goto(`${BASE_URL}/archived/true`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(500);

const rows = await page.locator(".task").count();
console.log("  archived rows:", rows);

const meta = await page.locator(".task-meta").allTextContents();
const withDates = meta.filter((line) =>
  /\d|today|tomorrow/i.test(line),
);
console.log("  meta lines showing a date:", withDates.length);

const before = await page
  .locator(".task-title")
  .first()
  .textContent();
const row = page.locator(".task").first();
const box = await row.boundingBox();
if (box) {
  const startX = box.x + 40;
  const middleY = box.y + box.height / 2;
  await page.mouse.move(startX, middleY);
  await page.mouse.down();
  await page.mouse.move(startX + 90, middleY, { steps: 6 });
  await page.mouse.move(startX + 200, middleY, { steps: 6 });
  console.log(
    "  skip action shown mid-swipe:",
    (await page.locator(".swipe-action.defer").count()) > 0,
  );
  await page.mouse.up();
  await page.waitForTimeout(1000);
}

const after = await page.locator(".task-title").first().textContent();
console.log("  first row unchanged by the swipe:", before === after);

await browser.close();
