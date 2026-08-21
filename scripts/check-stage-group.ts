import { chromium, devices } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

async function groupsOnScreen(page: import("playwright").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".group")].map((group) => ({
      name: group.querySelector(".group-name")?.textContent ?? "",
      titles: [...group.querySelectorAll(".task-title")].map(
        (title) => title.textContent ?? "",
      ),
    })),
  );
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  ...devices["iPhone 14"],
  hasTouch: true,
  isMobile: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();

await page.goto(`${BASE_URL}/list/Programming`, {
  waitUntil: "networkidle",
});
await page.getByRole("button", { name: "Arrange" }).click();
await page.waitForTimeout(300);
await page
  .locator(".menu-field select")
  .first()
  .selectOption("stage");
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

for (const group of await groupsOnScreen(page)) {
  console.log(`${group.name}: ${group.titles.join(" | ")}`);
}

console.log("\nticking the first To Do task...");
const toDoGroup = page
  .locator(".group")
  .filter({ hasText: "To Do" })
  .first();
await toDoGroup.locator(".task-tick").first().click();
await page.waitForTimeout(1400);

for (const group of await groupsOnScreen(page)) {
  console.log(`${group.name}: ${group.titles.join(" | ")}`);
}

await browser.close();
