import { chromium, devices, type Page } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function onScreen(page: Page): Promise<string[]> {
  return page.locator(".task-title").allInnerTexts();
}

async function touchDrag({
  page,
  title,
  overTitle,
}: {
  page: Page;
  title: string;
  overTitle: string;
}): Promise<void> {
  const source = page.locator(".task", { hasText: title }).first();
  const target = page
    .locator(".task", { hasText: overTitle })
    .first();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) {
    throw new Error("missing row");
  }

  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endY = to.y + to.height / 2;

  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY }],
  });
  await page.waitForTimeout(600);

  const steps = 10;
  for (let step = 1; step <= steps; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: startX, y: startY + ((endY - startY) * step) / steps },
      ],
    });
    await page.waitForTimeout(40);
  }

  const dropLines = await page.locator(".drop-line").count();
  console.log("  drop line visible mid-drag:", dropLines > 0);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error")
    console.log("  console:", message.text());
});

await page.goto(`${BASE_URL}/list/Personal`, {
  waitUntil: "networkidle",
});

console.log("TOUCH DRAG (how a phone actually does it)");
console.log(
  "  before:",
  (await onScreen(page)).slice(0, 4).join(" | "),
);
await touchDrag({
  page: page,
  title: "Call the pharmacy about the refill",
  overTitle: "Book the dentist",
});
console.log(
  "  after: ",
  (await onScreen(page)).slice(0, 4).join(" | "),
);
await page.reload({ waitUntil: "networkidle" });
console.log(
  "  reload:",
  (await onScreen(page)).slice(0, 4).join(" | "),
);

await browser.close();
