import { describe, expect, test } from "vitest";

import { buildGroups, sortTasks } from "./grouping.ts";
import type { CreatedTask, ViewPreference } from "@shared/types.ts";

function task(overrides: Partial<CreatedTask>): CreatedTask {
  return {
    id: 1,
    list: "home",
    parentId: null,
    recurringTaskId: null,
    title: "a task",
    note: null,
    state: "complete",
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
    unseenCommentCount: 0,
    lastCommentFromOthers: false,
    ...overrides,
  };
}

function view(overrides: Partial<ViewPreference>): ViewPreference {
  return {
    breakUpBy: "none",
    sortBy: "resolved_at",
    sortDirection: "desc",
    layout: "stacked",
    ...overrides,
  };
}

describe("sorting by when a task was finished", () => {
  const earlier = task({
    id: 1,
    resolvedAt: "2026-08-18T11:00:00Z",
  });
  const later = task({ id: 2, resolvedAt: "2026-08-20T08:00:00Z" });

  test("newest first when descending", () => {
    expect(
      sortTasks({
        tasks: [earlier, later],
        view: view({ sortDirection: "desc" }),
      }).map((sorted) => sorted.id),
    ).toEqual([2, 1]);
  });

  test("oldest first when ascending", () => {
    expect(
      sortTasks({
        tasks: [later, earlier],
        view: view({ sortDirection: "asc" }),
      }).map((sorted) => sorted.id),
    ).toEqual([1, 2]);
  });

  test("an unfinished task stays above the finished ones", () => {
    const unfinished = task({
      id: 3,
      state: "to_do",
      resolvedAt: null,
    });

    expect(
      sortTasks({
        tasks: [unfinished, later, earlier],
        view: view({ sortDirection: "asc" }),
      }).map((sorted) => sorted.id),
    ).toEqual([3, 1, 2]);
  });
});

describe("a ticked task once the ledger catches up", () => {
  const ticked = task({ id: 1, state: "complete" });
  const waiting = task({ id: 2, state: "to_do" });

  test("drops into the hidden group", () => {
    expect(
      buildGroups({
        tasks: [ticked, waiting],
        view: view({}),
        lists: ["home"],
      }).map((group) => ({
        key: group.key,
        ids: group.tasks.map((found) => found.id),
      })),
    ).toEqual([
      { key: "all", ids: [2] },
      { key: "hidden", ids: [1] },
    ]);
  });
});
