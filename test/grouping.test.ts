import { describe, expect, test } from "vitest";

import { buildGroups, sortTasks } from "../client/tasks/grouping.ts";
import type { TaskGroup } from "../client/tasks/grouping.ts";
import type { AttributeField } from "@shared/attributes.ts";
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
    finishedAt: null,
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
    orderBy: "finished_at",
    orderDirection: "desc",
    layout: "stacked",
    ...overrides,
  };
}

describe("sorting by when a task was finished", () => {
  const earlier = task({
    id: 1,
    finishedAt: "2026-08-18T11:00:00Z",
  });
  const later = task({ id: 2, finishedAt: "2026-08-20T08:00:00Z" });

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
      finishedAt: null,
    });

    expect(
      sortTasks({
        tasks: [unfinished, later, earlier],
        view: view({ orderDirection: "asc" }),
      }).map((sorted) => sorted.id),
    ).toEqual([3, 1, 2]);
  });
});

describe("sorting by tag", () => {
  const alphabetical = view({
    orderBy: "tag",
    orderDirection: "asc",
  });

  test("the first tag is the one that counts", () => {
    const wrenchThenApple = task({
      id: 1,
      state: "to_do",
      tags: ["wrench", "apple"],
    });
    const banana = task({ id: 2, state: "to_do", tags: ["banana"] });

    expect(
      sortTasks({
        tasks: [wrenchThenApple, banana],
        view: alphabetical,
      }).map((sorted) => sorted.id),
    ).toEqual([2, 1]);
  });

  test("case does not change where a tag lands", () => {
    const shouty = task({ id: 1, state: "to_do", tags: ["Apple"] });
    const quiet = task({ id: 2, state: "to_do", tags: ["banana"] });

    expect(
      sortTasks({
        tasks: [quiet, shouty],
        view: alphabetical,
      }).map((sorted) => sorted.id),
    ).toEqual([1, 2]);
  });

  test("an untagged task sinks below the tagged ones", () => {
    const untagged = task({ id: 1, state: "to_do", tags: [] });
    const tagged = task({ id: 2, state: "to_do", tags: ["zebra"] });

    expect(
      sortTasks({
        tasks: [untagged, tagged],
        view: alphabetical,
      }).map((sorted) => sorted.id),
    ).toEqual([2, 1]);
  });
});

describe("a ticked task once the ledger catches up", () => {
  const ticked = task({ id: 1, state: "complete" });
  const waiting = task({ id: 2, state: "to_do" });

  test("drops into the completed group", () => {
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
      { key: "completed", ids: [1] },
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

  function guessedValues(
    group: TaskGroup | undefined,
    field: AttributeField,
  ): (string | null)[] {
    return (group?.guessedAttributes ?? [])
      .filter((attribute) => attribute.field === field)
      .map((attribute) => attribute.value);
  }

  test("a list every task shares is guessed", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, list: "programming", tags: ["parallax"] }),
      task({ id: 2, list: "programming", tags: ["parallax"] }),
    ]);

    expect(guessedValues(group, "list")).toEqual(["programming"]);
  });

  test("one task disagreeing drops the guess", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, list: "programming", tags: ["parallax"] }),
      task({ id: 2, list: "home", tags: ["parallax"] }),
    ]);

    expect(guessedValues(group, "list")).toEqual([]);
  });

  test("the tag the group is built on is not guessed back", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "urgent"] }),
      task({ id: 2, tags: ["parallax", "urgent"] }),
    ]);

    expect(guessedValues(group, "tag")).toEqual(["urgent"]);
  });

  test("a tag only some tasks carry is not guessed", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "urgent"] }),
      task({ id: 2, tags: ["parallax"] }),
    ]);

    expect(guessedValues(group, "tag")).toEqual([]);
  });

  test("case does not stop two tags counting as one", () => {
    const [group] = groupsOfTagged([
      task({ id: 1, tags: ["parallax", "Urgent"] }),
      task({ id: 2, tags: ["parallax", "urgent"] }),
    ]);

    expect(guessedValues(group, "tag")).toEqual(["Urgent"]);
  });
});
