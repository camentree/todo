import type { Locator, Page } from "playwright";

export async function openSheetFor(
  page: Page,
  row: Locator,
): Promise<void> {
  await row.locator(".task-title").first().click();
  await page.waitForTimeout(450);
  await page.locator(".task-info").first().click();
  await page.waitForTimeout(600);
}

export async function openFirstSheet(page: Page): Promise<void> {
  await openSheetFor(page, page.locator(".task").first());
}
