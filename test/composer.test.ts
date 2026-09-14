import { commitEntry } from "@shared/composer.ts";
import { serializeEntry } from "@shared/grammar.ts";
import { derive } from "@shared/tasks.ts";

const date = "2026-09-13";

describe("commitEntry", () => {
  it("adds a one-off for today without a definition", () => {
    const result = commitEntry({ text: "Call mum", tasks: [], definitions: [], editTaskId: null, editDefinitionId: null, date });
    expect(result?.tasks).toHaveLength(1);
    expect(result?.tasks[0]).toMatchObject({ name: "Call mum", group: "personal", definitionId: null });
    expect(result?.definitions).toEqual([]);
  });

  it("makes a boolean called Journal complete itself from journal entries", () => {
    const result = commitEntry({ text: "Journal /habits #every 1d", tasks: [], definitions: [], editTaskId: null, editDefinitionId: null, date })!;
    expect(result.tasks[0]?.auto).toBe("journal");
  });

  it("keeps existing tasks when adding another", () => {
    const first = commitEntry({ text: "Call mum", tasks: [], definitions: [], editTaskId: null, editDefinitionId: null, date })!;
    const second = commitEntry({ text: "Read /habits", tasks: first.tasks, definitions: [], editTaskId: null, editDefinitionId: null, date })!;
    expect(second.tasks.map((task) => task.name)).toEqual(["Call mum", "Read"]);
  });

  it("creates a definition and today's instance from #every", () => {
    const result = commitEntry({
      text: "Hangboard #every 2d /exercise #rest 60s\n\n- Hang #timer 30s\n- Hang #timer 30s",
      tasks: [],
      definitions: [],
      editTaskId: null,
      editDefinitionId: null,
      date,
    });
    expect(result?.definitions).toHaveLength(1);
    expect(result?.definitions[0]).toMatchObject({ name: "Hangboard", every: "2d", rest: 60, anchor: date, children: [{ name: "Hang" }, { name: "Hang" }] });
    expect(result?.tasks.map((task) => task.parent)).toEqual([null, result?.rootId, result?.rootId]);
    expect(result?.tasks[0]?.definitionId).toBe(result?.definitions[0]?.id);
    expect(result?.tasks[1]?.rest).toBe(60);
  });

  it("keeps ids and progress when editing, unless = overrides", () => {
    const first = commitEntry({ text: "Pull-ups #count 5 /exercise", tasks: [], definitions: [], editTaskId: null, editDefinitionId: null, date })!;
    const progressed = first.tasks.map((task) => ({ ...task, current: 2 }));
    const edited = commitEntry({ text: "Pull-ups #count 8 /exercise", tasks: progressed, definitions: [], editTaskId: first.rootId, editDefinitionId: null, date })!;
    expect(edited.tasks[0]).toMatchObject({ id: first.rootId, target: 8, current: 2 });
    const overridden = commitEntry({ text: "Pull-ups #count 8 /exercise = 7", tasks: progressed, definitions: [], editTaskId: first.rootId, editDefinitionId: null, date })!;
    expect(overridden.tasks[0]?.current).toBe(7);
  });

  it("round-trips through serializeEntry", () => {
    const text = "Hangboard #every 2d /exercise #rest 1m\n\nHalf crimp.\n\n- Hang #timer 30s\n- Hang #timer 30s";
    const result = commitEntry({ text, tasks: [], definitions: [], editTaskId: null, editDefinitionId: null, date })!;
    const derived = derive({ tasks: result.tasks, entries: [], date });
    const root = derived[0]!;
    const serialized = serializeEntry({
      root,
      children: derived.filter((task) => task.parent === root.id),
      group: root.group,
      every: result.definitions[0]?.every ?? null,
      rest: root.rest,
    });
    expect(serialized).toBe(text);
  });
});
