import { useEffect, useState } from "react";
import type { PointerEvent } from "react";

import { capitalise, formatDuration } from "@shared/format.ts";
import { everyLabel } from "@shared/grammar.ts";
import { daysUntilDue } from "@shared/schedule.ts";
import { childrenOf, metaText, toggled } from "@shared/tasks.ts";
import type { Definition, DerivedTask, Task } from "@shared/types.ts";
import { groupOrder } from "@shared/types.ts";

import { Check, Chevron, Play } from "../components/Glyphs.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { readCollapsed, write } from "../data/settings.ts";
import { useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";

const weekKey = "__week";

function reordered({ tasks, id, overId }: { tasks: Task[]; id: string; overId: string }): Task[] {
  const over = tasks.find((task) => task.id === overId);
  const me = tasks.find((task) => task.id === id);
  if (!over || !me) return tasks;
  const overTop = over.parent ? tasks.find((task) => task.id === over.parent) : over;
  if (!overTop || overTop.id === id || overTop.group !== me.group) return tasks;
  const block = [me, ...childrenOf({ tasks, id })];
  const rest = tasks.filter((task) => task.id !== id && task.parent !== id);
  let at = rest.findIndex((task) => task.id === overTop.id);
  const fromIndex = tasks.findIndex((task) => task.id === id);
  const toIndex = tasks.findIndex((task) => task.id === overTop.id);
  if (fromIndex < toIndex) at += 1 + childrenOf({ tasks, id: overTop.id }).length;
  rest.splice(at, 0, ...block);
  return rest;
}

function definitionMeta(definition: Definition): string {
  const kind =
    definition.kind === "timer"
      ? formatDuration(definition.target)
      : definition.kind === "count"
        ? definition.children.length
          ? definition.children.length + " parts"
          : definition.tapIncrement
            ? "count"
            : definition.target + " ×"
        : definition.kind === "amount" || definition.kind === "weight"
          ? definition.target + " " + definition.unit
          : definition.kind === "text"
            ? "text"
            : "";
  return [kind, everyLabel(definition.every), definition.group].filter(Boolean).join(" · ");
}

export function TodayScreen({
  onOpenTask,
  onEditTask,
  onRunGroup,
  onEditDefinition,
}: {
  onOpenTask: (task: DerivedTask) => void;
  onEditTask: (id: string) => void;
  onRunGroup: (run: { group: string; tops: DerivedTask[] }) => void;
  onEditDefinition: (definition: Definition) => void;
}) {
  const store = useStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const saved = readCollapsed(store.date);
    if (saved) return saved;
    const initial: Record<string, boolean> = { [weekKey]: true };
    for (const group of new Set(store.tasks.map((task) => task.group))) {
      const tops = store.tasks.filter((task) => !task.parent && task.group === group);
      if (tops.length && tops.every((task) => task.done)) initial[group] = true;
    }
    return initial;
  });
  const [arranging, setArranging] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => write({ key: "collapsed:" + store.date, value: collapsed }), [collapsed, store.date]);

  const allGroups = [...new Set([...groupOrder, ...store.tasks.map((task) => task.group), ...store.definitions.map((definition) => definition.group)])];
  const groups = allGroups.filter((group) => store.tasks.some((task) => task.group === group));
  const week = store.definitions
    .filter((definition) => !store.tasks.some((task) => task.definitionId === definition.id))
    .map((definition) => ({ definition, days: daysUntilDue({ definition, date: store.date }) }))
    .filter((each): each is { definition: Definition; days: number } => each.days !== null)
    .sort((a, b) => allGroups.indexOf(a.definition.group) - allGroups.indexOf(b.definition.group) || a.days - b.days);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const dragMove = (event: PointerEvent) => {
    if (!dragging) return;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-task]");
    const overId = row?.getAttribute("data-task");
    if (!overId || overId === dragging) return;
    store.setTasks((tasks) => reordered({ tasks, id: dragging, overId }));
  };

  const toggleGroup = (key: string) => setCollapsed((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="screen">
      <div className="screen-title">{dateLabel}</div>
      <div className="scroll" onPointerMove={dragMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
        {groups.map((group) => {
          const tops = store.tasks.filter((task) => task.group === group && !task.parent);
          const allDone = tops.length > 0 && tops.every((task) => task.done);
          const isArranging = arranging === group;
          const open = isArranging || !collapsed[group];
          const press = longPress(() => {
            setArranging(group);
            setCollapsed((current) => ({ ...current, [group]: false }));
          });
          return (
            <div className="group" key={group}>
              <div className="group-header">
                <button className={allDone ? "group-label all-done" : "group-label"} onClick={() => !isArranging && toggleGroup(group)} {...press}>
                  <span>{capitalise(group)}</span>
                  {!open && <span className="group-count numbers">{tops.length}</span>}
                  <Chevron open={open} />
                </button>
                {isArranging ? (
                  <button
                    className="arrange-done"
                    onClick={() => {
                      setArranging(null);
                      setDragging(null);
                    }}
                  >
                    done
                  </button>
                ) : (
                  <button className="box-button" aria-label={allDone ? "group summary" : "run group"} onClick={() => onRunGroup({ group, tops })}>
                    <span className="box">{allDone ? <Check /> : <Play />}</span>
                  </button>
                )}
              </div>
              {open &&
                tops.flatMap((top) =>
                  [top, ...(childrenOf({ tasks: store.tasks, id: top.id }) as DerivedTask[])].map((task) => (
                    <TaskRow
                      key={task.id}
                      id={task.id}
                      name={task.name}
                      meta={metaText(task)}
                      done={task.done}
                      child={task.parent !== null}
                      arranging={isArranging}
                      dragging={dragging === task.id}
                      press={longPress(() => onEditTask(task.id))}
                      onOpen={() => !isArranging && onOpenTask(task)}
                      onToggle={() => !isArranging && store.setTasks(() => toggled({ tasks: store.tasks, task }))}
                      onDragStart={
                        task.parent
                          ? null
                          : (event) => {
                              event.stopPropagation();
                              setDragging(task.id);
                            }
                      }
                    />
                  )),
                )}
            </div>
          );
        })}
        {week.length > 0 && (
          <div className="group">
            <div className="group-header">
              <button className="group-label" onClick={() => toggleGroup(weekKey)}>
                <span>This week</span>
                {collapsed[weekKey] && <span className="group-count numbers">{week.length}</span>}
                <Chevron open={!collapsed[weekKey]} />
              </button>
            </div>
            {!collapsed[weekKey] &&
              week.map(({ definition }) => (
                <div className="row" key={definition.id}>
                  <button className="row-name" onClick={() => onEditDefinition(definition)}>
                    <span>{definition.name}</span>
                    <span className="row-meta numbers">{definitionMeta(definition)}</span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
