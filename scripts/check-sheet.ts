import { chromium, type Page } from "playwright";

import { openSheetFor } from "./openSheet.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function openSheet(page: Page): Promise<void> {
  await openSheetFor(
    page,
    page.locator(".task", { hasText: "10 pushups" }).first(),
  );
}

async function check(): Promise<void> {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  page.setDefaultTimeout(5000);
  await page.goto(`${BASE_URL}/list/Habits`, {
    waitUntil: "networkidle",
  });

  await openSheet(page);

  const overflow = await page
    .locator(".sheet-body")
    .evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
  console.log(
    `horizontal overflow: ${overflow.scrollWidth - overflow.clientWidth}px`,
  );

  const bodyOverflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  console.log(
    `page overflow:       ${bodyOverflow.scrollWidth - bodyOverflow.clientWidth}px`,
  );

  const sheet = page.locator(".sheet");
  const box = await sheet.boundingBox();
  if (!box) {
    throw new Error("no sheet");
  }
  const centreX = box.x + box.width / 2;
  const grabberY = box.y + 12;

  await page.mouse.move(centreX, grabberY);
  await page.mouse.down();
  await page.mouse.move(centreX, grabberY + 90, { steps: 6 });
  await page.mouse.move(centreX, grabberY + 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log(
    "sheet closing after drag down:",
    (await page.locator('.sheet[data-closing="true"]').count()) > 0,
  );
  await page.waitForTimeout(900);
  console.log(
    "sheet gone:",
    (await page.locator(".sheet").count()) === 0,
  );

  await openSheet(page);
  await page.locator(".scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(120);
  console.log(
    "sheet closing after scrim click:",
    (await page.locator('.sheet[data-closing="true"]').count()) > 0,
  );
  await page.waitForTimeout(900);
  console.log(
    "sheet gone:",
    (await page.locator(".sheet").count()) === 0,
  );

  await browser.close();
}

await check();
