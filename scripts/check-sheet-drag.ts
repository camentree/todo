import { chromium, devices } from "playwright";

import { openSheetFor } from "./openSheet.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

async function openTheSheet(): Promise<void> {
  await page.goto(`${BASE_URL}/list/Habits`, {
    waitUntil: "networkidle",
  });
  await openSheetFor(
    page,
    page.locator(".task", { hasText: "10 pushups" }).first(),
  );
}

async function dragDownFrom(
  x: number,
  y: number,
  by: number,
): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + by / 2, { steps: 6 });
  await page.mouse.move(x, y + by, { steps: 6 });
  await page.mouse.up();
}

async function sheetIsClosing(): Promise<boolean> {
  return (
    (await page.locator('.sheet[data-closing="true"]').count()) > 0
  );
}

console.log("THE HANDLE ALWAYS CLOSES, EVEN SCROLLED DOWN");
await openTheSheet();
await page.locator(".sheet-body").evaluate((node) => {
  node.scrollTop = 250;
});
await page.waitForTimeout(300);
const scrolled = await page
  .locator(".sheet-body")
  .evaluate((node) => node.scrollTop);
console.log("  scrolled to:", scrolled);

const handle = await page.locator(".sheet-handle").boundingBox();
if (handle) {
  await dragDownFrom(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
    220,
  );
}
await page.waitForTimeout(200);
console.log("  closing:", await sheetIsClosing());
await page.waitForTimeout(900);

console.log("\nDRAGGING THE BODY WHILE SCROLLED DOWN DOES NOT CLOSE");
await openTheSheet();
await page.locator(".sheet-body").evaluate((node) => {
  node.scrollTop = 250;
});
await page.waitForTimeout(300);
const body = await page.locator(".sheet-body").boundingBox();
if (body) {
  await dragDownFrom(
    body.x + body.width / 2,
    body.y + body.height / 2,
    200,
  );
}
await page.waitForTimeout(300);
console.log("  closing:", await sheetIsClosing());

console.log("\nAT THE TOP, DRAGGING THE BODY CLOSES");
await openTheSheet();
await page.waitForTimeout(600);
const atTop = await page.locator(".sheet-body").boundingBox();
if (atTop) {
  await dragDownFrom(
    atTop.x + atTop.width / 2,
    atTop.y + atTop.height / 3,
    200,
  );
}
await page.waitForTimeout(200);
console.log("  closing:", await sheetIsClosing());
await page.waitForTimeout(900);

console.log("\nDRAGGING INSIDE THE NOTE DOES NOT CLOSE");
await openTheSheet();
await page
  .locator(".sheet-section-head", { hasText: "Note" })
  .click();
await page.waitForTimeout(400);
const note = await page.locator(".sheet-body textarea").boundingBox();
if (note) {
  await dragDownFrom(
    note.x + note.width / 2,
    note.y + note.height / 2,
    160,
  );
}
await page.waitForTimeout(300);
console.log("  closing:", await sheetIsClosing());

await browser.close();
