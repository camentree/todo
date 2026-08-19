import { chromium, devices, type Page } from "playwright";

import { openSheetFor } from "./openSheet.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function titles(page: Page): Promise<string[]> {
  return page.locator(".task-title").allTextContents();
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

let reorderCalls = 0;
await page.route("**/api/tasks/reorder", async (route) => {
  reorderCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 800));
  await route.continue();
});

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

console.log("REORDER SHOWS BEFORE THE SERVER ANSWERS");
console.log("  (the reorder request is held for 800ms)");

const before = await titles(page);
const moved = before[0] ?? "";
const row = page.locator(".task", { hasText: moved }).first();
const box = await row.boundingBox();
const client = await context.newCDPSession(page);

if (box) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x, y: y }],
  });
  await page.waitForTimeout(600);
  for (const step of [0.3, 0.6, 1]) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x, y: y + 260 * step }],
    });
    await page.waitForTimeout(80);
  }
  const released = Date.now();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  await page.waitForFunction(
    (was) =>
      [...document.querySelectorAll(".task-title")][0]
        ?.textContent !== was,
    moved,
    { timeout: 3000 },
  );
  console.log(`  list reordered after ${Date.now() - released}ms`);
}

console.log("  reorder requests sent so far:", reorderCalls);
await page.waitForTimeout(1800);
console.log("  after the debounce:", reorderCalls);

console.log("\nWEEKDAY CHIP FILLS ON TAP");
await page.goto(`${BASE_URL}/list/Habits`, {
  waitUntil: "networkidle",
});
await openSheetFor(
  page,
  page.locator(".task", { hasText: "10 pushups" }).first(),
);
await page.locator(".sheet-every select").selectOption("weekly");
await page.waitForTimeout(900);

const chip = page.locator(".weekday").nth(5);
const wasOn = (await chip.getAttribute("data-on")) === "true";
const tapped = Date.now();
await chip.click();
await page.waitForFunction(
  (expected) => {
    const nodes = document.querySelectorAll(".weekday");
    return nodes[5]?.getAttribute("data-on") === String(!expected);
  },
  wasOn,
  { timeout: 3000 },
);
console.log(`  chip flipped after ${Date.now() - tapped}ms`);

await browser.close();
