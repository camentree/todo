import { chromium, devices, type Page } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function listOf(title: string): Promise<string> {
  const tasks = (await (
    await fetch(`${BASE_URL}/api/tasks`)
  ).json()) as { title: string; list: string }[];
  return tasks.find((task) => task.title === title)?.list ?? "gone";
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
  await source.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(300);

  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) {
    throw new Error("missing row");
  }

  const x = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endY = to.y + to.height / 2;

  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x, y: startY }],
  });
  await page.waitForTimeout(600);
  for (let step = 1; step <= 12; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x, y: startY + ((endY - startY) * step) / 12 },
      ],
    });
    await page.waitForTimeout(35);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(1200);
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

await page.goto(`${BASE_URL}/todo`, { waitUntil: "networkidle" });

const moving = "Read for 20 minutes";
console.log(`"${moving}" starts in:`, await listOf(moving));
console.log(
  "groups on screen:",
  await page.locator(".group-head").count(),
);

await touchDrag({
  page: page,
  title: moving,
  overTitle: "Book the dentist",
});

console.log(`"${moving}" now in:  `, await listOf(moving));

await browser.close();
