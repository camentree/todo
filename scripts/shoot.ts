import { chromium, type Page } from "playwright";

import { openFirstSheet, openSheetFor } from "./openSheet.ts";

const BASE_URL = process.env.APP_URL ?? "http://localhost:8790";
const OUTPUT_DIRECTORY =
  process.env.SHOT_DIR ?? "/tmp/parallax-shots";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

interface Shot {
  name: string;
  path: string;
  viewport: { width: number; height: number };
  colorScheme: "dark" | "light";
  act?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  {
    name: "today-dark",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
  },
  {
    name: "today-light",
    path: "/",
    viewport: PHONE,
    colorScheme: "light",
  },
  {
    name: "today-expanded",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page
        .getByRole("button", { name: "Show subtasks" })
        .first()
        .click();
    },
  },
  {
    name: "sheet",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await openFirstSheet(page);
    },
  },
  {
    name: "todo",
    path: "/todo",
    viewport: PHONE,
    colorScheme: "dark",
  },
  {
    name: "todo-collapsed",
    path: "/todo",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.locator(".group-head").first().click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "changes-menu",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page
        .getByRole("button", { name: "Notifications" })
        .click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "view-menu",
    path: "/todo",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.getByRole("button", { name: "Arrange" }).click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "scope-menu",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.locator(".topbar-filter").click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "repeat-weekly",
    path: "/list/Habits",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await openSheetFor(
        page,
        page.locator(".task", { hasText: "10 pushups" }).first(),
      );
      await page
        .locator(".sheet-every select")
        .selectOption("weekly");
      await page.waitForTimeout(900);
      await page.locator(".weekday").nth(4).click();
      await page.waitForTimeout(900);
    },
  },
  {
    name: "grouped-by-stage",
    path: "/list/Programming",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.getByRole("button", { name: "Arrange" }).click();
      await page.waitForTimeout(300);
      await page
        .locator(".menu-field select")
        .first()
        .selectOption("stage");
      await page.waitForTimeout(600);
      await page.locator(".scrim").click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "personal-desktop",
    path: "/list/Personal",
    viewport: DESKTOP,
    colorScheme: "dark",
  },
  {
    name: "programming-board",
    path: "/list/Programming",
    viewport: DESKTOP,
    colorScheme: "dark",
  },
  {
    name: "archive",
    path: "/archive",
    viewport: PHONE,
    colorScheme: "dark",
  },
  {
    name: "capture-open",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.getByRole("button", { name: "Add a task" }).click();
      await page.waitForTimeout(350);
      await page
        .locator(".new-task input")
        .fill("Call the vet #pets tomorrow 2pm");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "sheet-tags",
    path: "/list/Programming",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await openSheetFor(
        page,
        page
          .locator(".task", { hasText: "Refactor the auth" })
          .first(),
      );
    },
  },
  {
    name: "multiline-title",
    path: "/",
    viewport: { width: 320, height: 844 },
    colorScheme: "dark",
  },
  {
    name: "renaming-in-place",
    path: "/",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await page.locator(".task-title").first().click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "sheet-sections",
    path: "/list/Habits",
    viewport: PHONE,
    colorScheme: "dark",
    act: async (page) => {
      await openSheetFor(
        page,
        page.locator(".task", { hasText: "10 pushups" }).first(),
      );
      await page.waitForTimeout(250);
    },
  },
];

async function shoot(): Promise<void> {
  const browser = await chromium.launch({ channel: "chrome" });
  const problems: string[] = [];

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      colorScheme: shot.colorScheme,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    page.on("console", (message) => {
      if (message.type() === "error") {
        problems.push(`${shot.name}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      problems.push(`${shot.name}: ${error.message}`);
    });

    await page.goto(`${BASE_URL}${shot.path}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(300);
    if (shot.act) {
      await shot.act(page);
    }
    await page.screenshot({
      path: `${OUTPUT_DIRECTORY}/${shot.name}.png`,
      fullPage: true,
    });
    await context.close();
  }

  await browser.close();

  if (problems.length > 0) {
    console.log("PROBLEMS");
    for (const problem of problems) {
      console.log(`  ${problem}`);
    }
  } else {
    console.log("no console errors");
  }
}

await shoot();
