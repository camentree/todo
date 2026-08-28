import { describe, expect, it } from "vitest";

import { todayAsDateString } from "../client/tasks/format.ts";
import { leftSwipe, rightSwipes } from "../client/tasks/swipes.ts";
import type { SwipeHandlers } from "../client/tasks/swipes.ts";
import type { CreatedTask } from "@shared/types.ts";

const done: string[] = [];

const handlers: SwipeHandlers = {
  archive: () => done.push("archive"),
  delete: () => done.push("delete"),
  moveOn: () => done.push("moveOn"),
  pickDate: () => done.push("pickDate"),
  putInWeek: () => done.push("putInWeek"),
  toggleToday: () => done.push("toggleToday"),
};

function task(overrides: Partial<CreatedTask>): CreatedTask {
  return {
    id: 1,
    list: "personal",
    parentId: null,
    recurringTaskId: null,
    title: "Something",
    note: null,
    state: "to_do",
    stage: null,
    tags: [],
    who: null,
    dueDate: null,
    dueTime: null,
    sortOrder: 0,
    finishedAt: null,
    createdAt: "",
    updatedAt: "",
    commentCount: 0,
    schedule: null,
    subtasks: [],
    ...overrides,
  };
}

function namesOf(task: CreatedTask): string[] {
  return rightSwipes(task, handlers).map((swipe) => swipe.name);
}

const today = todayAsDateString();

describe("what pulling a row to the right offers", () => {
  it("gives an ordinary task three targets ending in today", () => {
    expect(namesOf(task({}))).toEqual(["Pick", "Week", "Today"]);
  });

  it("takes a task that is already today back off it", () => {
    expect(namesOf(task({ dueDate: today }))).toEqual([
      "Pick",
      "Week",
      "Not today",
    ]);
  });

  it("offers a repeating task only a skip", () => {
    expect(
      namesOf(task({ recurringTaskId: 4, dueDate: today })),
    ).toEqual(["Skip"]);
  });

  it("offers the skip however far off the repeat is", () => {
    expect(
      namesOf(task({ recurringTaskId: 4, dueDate: "2099-01-01" })),
    ).toEqual(["Skip"]);
  });

  it("archives a finished task", () => {
    expect(namesOf(task({ state: "complete" }))).toEqual(["Archive"]);
  });

  it("puts an archived task back", () => {
    expect(namesOf(task({ state: "archived" }))).toEqual([
      "Put it back",
    ]);
  });
});

describe("what pulling a row to the left offers", () => {
  it("archives an ordinary task", () => {
    expect(leftSwipe(task({}), handlers)?.name).toBe("Archive");
  });

  it("deletes a finished task", () => {
    expect(
      leftSwipe(task({ state: "complete" }), handlers)?.name,
    ).toBe("Delete");
  });

  it("deletes an archived task", () => {
    expect(
      leftSwipe(task({ state: "archived" }), handlers)?.name,
    ).toBe("Delete");
  });
});
