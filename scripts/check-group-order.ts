import { chromium, devices, type Page } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function groupNames(page: Page): Promise<string[]> {
  return page.locator(".group-name").allTextContents();
}

async function groupBy(page: Page, field: string): Promise<void> {
  await page.getByRole("button", { name: "Arrange" }).click();
  await page.waitForTimeout(300);
  await page
    .locator(".menu-field select")
    .first()
    .selectOption(field);
  await page.waitForTimeout(600);
  await page.locator(".scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(500);
}

async function orderBy(page: Page, direction: string): Promise<void> {
  await page.getByRole("button", { name: "Arrange" }).click();
  await page.waitForTimeout(300);
  await page
    .locator(".menu-field select")
    .last()
    .selectOption(direction);
  await page.waitForTimeout(600);
  await page.locator(".scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(500);
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/todo`, { waitUntil: "networkidle" });

await groupBy(page, "due_date");
console.log("BY DUE DATE, ASCENDING");
console.log("  ", (await groupNames(page)).join(" · "));

await orderBy(page, "due_date:desc");
console.log("BY DUE DATE, DESCENDING");
console.log("  ", (await groupNames(page)).join(" · "));

await orderBy(page, "due_date:asc");
await groupBy(page, "tag");
console.log("BY TAG");
console.log("  ", (await groupNames(page)).join(" · "));

await groupBy(page, "who");
console.log("BY PERSON");
console.log("  ", (await groupNames(page)).join(" · "));

await browser.close();
