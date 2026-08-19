import { chromium, type Page } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function describe(title: string): Promise<string> {
  const lists = (await (
    await fetch(`${BASE_URL}/api/lists`)
  ).json()) as string[];
  for (const list of lists) {
    const tasks = (await (
      await fetch(
        `${BASE_URL}/api/tasks?list=${encodeURIComponent(list)}`,
      )
    ).json()) as {
      title: string;
      state: string;
      dueDate: string | null;
    }[];
    const found = tasks.find((task) => task.title === title);
    if (found) {
      return `${found.state} due=${found.dueDate ?? "-"}`;
    }
  }
  const archived = (await (
    await fetch(`${BASE_URL}/api/archive`)
  ).json()) as { title: string }[];
  return archived.some((task) => task.title === title)
    ? "archived"
    : "gone";
}

async function swipe({
  page,
  title,
  distance,
}: {
  page: Page;
  title: string;
  distance: number;
}): Promise<void> {
  const row = page.locator(".task", { hasText: title }).first();
  await row.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(350);
  const box = await row.boundingBox();
  if (!box) {
    throw new Error(`no row for ${title}`);
  }
  const startX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  await page.mouse.move(startX, centreY);
  await page.mouse.down();
  await page.mouse.move(startX + distance / 2, centreY, { steps: 6 });
  await page.mouse.move(startX + distance, centreY, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(900);
}

const RIGHT = 170;
const LEFT = -170;
const TOO_SHORT = 60;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
});

await page.goto(`${BASE_URL}/list/Personal`, {
  waitUntil: "networkidle",
});

async function step({
  title,
  distance,
  expect,
  path = "/list/Personal",
}: {
  title: string;
  distance: number;
  expect: string;
  path?: string;
}): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  const before = await describe(title);
  await swipe({ page: page, title: title, distance: distance });
  const after = await describe(title);
  const direction = distance < 0 ? "left " : "right";
  console.log(
    `${direction} ${Math.abs(distance)}px on "${title}"\n  want ${expect}\n  ${before}  ->  ${after}`,
  );
}

await step({
  title: "Back up the photos",
  distance: TOO_SHORT,
  expect: "no change, springs back",
});
await step({
  title: "Back up the photos",
  distance: RIGHT,
  expect: "hidden",
});
await step({
  title: "Back up the photos",
  distance: RIGHT,
  expect: "unhidden, same direction as hide",
});
await step({
  title: "Get groceries",
  distance: RIGHT,
  expect: "due date pushed a day",
});
await step({
  title: "Fix the bike puncture",
  distance: LEFT,
  expect: "archived",
});
await step({
  title: "Fix the bike puncture",
  distance: LEFT,
  expect: "unarchived",
  path: "/archive",
});

await browser.close();
