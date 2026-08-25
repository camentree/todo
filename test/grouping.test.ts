import { describe, expect, test } from "vitest";

import { buildGroups, sortTasks } from "../client/grouping.ts";
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
    ...overrides,
  };
}

function view(overrides: Partial<ViewPreference>): ViewPreference {
  return {
    groupBy: "none",
    orderBy: "resolved_at",
    orderDirection: "desc",
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
        view: view({ orderDirection: "desc" }),
      }).map((sorted) => sorted.id),
    ).toEqual([2, 1]);
  });

  test("oldest first when ascending", () => {
    expect(
      sortTasks({
        tasks: [later, earlier],
        view: view({ orderDirection: "asc" }),
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
        view: view({ orderDirection: "asc" }),
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

describe("what a group guesses its tasks have in common", () => {
  function groupsOfTagged(tasks: CreatedTask[]) {
    return buildGroups({
      tasks: tasks,
      view: view({ groupBy: "tag", orderBy: "manual" }),
      lists: ["programming", "home"],
      showFinished: true,
    });
  }

  test("a list every task shares is guessed", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, list: "programming", tags: ["parallax"] }),
      task({ id: 2, list: "programming", tags: ["parallax"] }),
    ]);

    expect(group?.guessedAttributes.list).toBe("programming");
  });

  test("one task disagreeing drops the guess", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, list: "programming", tags: ["parallax"] }),
      task({ id: 2, list: "home", tags: ["parallax"] }),
    ]);

    expect(group?.guessedAttributes.list).toBeUndefined();
  });

  test("the tag the group is built on is not guessed back", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "urgent"] }),
      task({ id: 2, tags: ["parallax", "urgent"] }),
    ]);

    expect(group?.guessedAttributes.tags).toEqual(["urgent"]);
  });

  test("a tag only some tasks carry is not guessed", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "urgent"] }),
      task({ id: 2, tags: ["parallax"] }),
    ]);

    expect(group?.guessedAttributes.tags).toBeUndefined();
  });

  test("case does not stop two tags counting as one", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "Urgent"] }),
      task({ id: 2, tags: ["parallax", "urgent"] }),
    ]);

    expect(group?.guessedAttributes.tags).toEqual(["Urgent"]);
  });
});
