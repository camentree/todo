import { chromium } from "playwright";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
});
page.setDefaultTimeout(5000);
await page.goto(`${BASE_URL}/list/Personal`, {
  waitUntil: "networkidle",
});

console.log(
  "swipe bars visible at rest:",
  await page.locator(".swipe-action").count(),
);

const before = Date.now();
await page.locator(".task-tick").first().click();
await page.waitForFunction(
  () => document.querySelector('.task[data-done="true"]') !== null,
  undefined,
  { timeout: 3000 },
);
console.log(`tick feedback: ${Date.now() - before}ms`);

await browser.close();
