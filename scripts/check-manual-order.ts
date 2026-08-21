import { chromium, devices, type Page } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function titlesOnScreen(page: Page): Promise<string[]> {
  return page.locator(".task-title").allTextContents();
}

async function dragRow({
  page,
  title,
  by,
}: {
  page: Page;
  title: string;
  by: number;
}): Promise<void> {
  const row = page.locator(".task", { hasText: title }).first();
  const box = await row.boundingBox();
  if (!box) {
    throw new Error(`no row for ${title}`);
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x, y: y }],
  });
  await page.waitForTimeout(600);
  for (const step of [0.25, 0.5, 0.75, 1]) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x, y: y + by * step }],
    });
    await page.waitForTimeout(90);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(1400);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const before = await titlesOnScreen(page);
console.log("TODAY, SORTED BY DUE DATE TO START");
console.log("  before:", before.slice(0, 5).join(" | "));

const moved = before[0] ?? "";
await dragRow({ page: page, title: moved, by: 260 });

const after = await titlesOnScreen(page);
console.log(`  dragged "${moved}" down`);
console.log("  after: ", after.slice(0, 5).join(" | "));

const othersBefore = before.filter((title) => title !== moved);
const othersAfter = after.filter((title) => title !== moved);
console.log(
  "  every other row kept its order:",
  othersBefore.join("|") === othersAfter.join("|"),
);
console.log(
  "  the dragged row actually moved:",
  before.indexOf(moved) !== after.indexOf(moved),
  `(${before.indexOf(moved)} → ${after.indexOf(moved)})`,
);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
const reloaded = await titlesOnScreen(page);
console.log(
  "  survives a reload:",
  reloaded.join("|") === after.join("|"),
);
console.log("  reload:", reloaded.slice(0, 5).join(" | "));

await browser.close();
