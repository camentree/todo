import { describe, expect, test } from "vitest";

import { inLayout } from "../client/data/pending.ts";
import type { CreatedTask } from "@shared/types.ts";

function task(overrides: Partial<CreatedTask>): CreatedTask {
  return {
    id: 1,
    list: "habits",
    parentId: null,
    recurringTaskId: null,
    title: "a task",
    note: null,
    state: "to_do",
    stage: null,
    tags: [],
    who: null,
    dueDate: null,
    dueTime: null,
    sortOrder: 0,
    resolvedAt: null,
    archivedAt: null,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-01T09:00:00Z",
    schedule: null,
    commentCount: 0,
    ...overrides,
  };
}

function pending(...tasks: CreatedTask[]) {
  return new Map(tasks.map((held) => [held.id, held]));
}

describe("what layout sees while a change is waiting to be sent", () => {
  test("a ticked task still counts as unfinished, so it holds its place", () => {
    const [shown] = inLayout(
      [task({ id: 1, state: "to_do" })],
      pending(task({ id: 1, state: "complete" })),
    );

    expect(shown?.state).toBe("to_do");
  });

  test("the moment it was finished is held back with the state", () => {
    const [shown] = inLayout(
      [task({ id: 1, resolvedAt: null })],
      pending(task({ id: 1, resolvedAt: "2026-08-25T10:00:00Z" })),
    );

    expect(shown?.resolvedAt).toBeNull();
  });

  test("a new sort order is taken, so a dropped row stays where it landed", () => {
    const [shown] = inLayout(
      [task({ id: 1, sortOrder: 0 })],
      pending(task({ id: 1, sortOrder: 7 })),
    );

    expect(shown?.sortOrder).toBe(7);
  });

  test("a renamed title is taken", () => {
    const [shown] = inLayout(
      [task({ id: 1, title: "old" })],
      pending(task({ id: 1, title: "new" })),
    );

    expect(shown?.title).toBe("new");
  });

  test("a task with nothing waiting is left as it is", () => {
    const [shown] = inLayout(
      [task({ id: 1, title: "untouched" })],
      pending(task({ id: 2, title: "someone else" })),
    );

    expect(shown?.title).toBe("untouched");
  });

  test("a waiting subtask is found and merged", () => {
    const [shown] = inLayout(
      [
        task({
          id: 1,
          subtasks: [task({ id: 2, title: "old", parentId: 1 })],
        }),
      ],
      pending(task({ id: 2, title: "new", parentId: 1 })),
    );

    expect(shown?.subtasks?.[0]?.title).toBe("new");
  });

  test("a ticked subtask holds its place too", () => {
    const [shown] = inLayout(
      [
        task({
          id: 1,
          subtasks: [task({ id: 2, state: "to_do", parentId: 1 })],
        }),
      ],
      pending(task({ id: 2, state: "complete", parentId: 1 })),
    );

    expect(shown?.subtasks?.[0]?.state).toBe("to_do");
  });

  test("nothing waiting hands back the very same list", () => {
    const tasks = [task({ id: 1 })];

    expect(inLayout(tasks, new Map())).toBe(tasks);
  });
});
