import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { Attribute } from "../tasks/attributes.ts";
import type { TaskGroup } from "../tasks/grouping.ts";
import type { CreatedTask } from "@shared/types.ts";

const HOLD_TO_EXPAND_MILLISECONDS = 600;

interface Move {
  taskId: number;
  fromKey: string;
  toKey: string;
  parentId: number | null;
  index: number;
}

export function useMoveTask({
  groups,
  boardRef,
  onMove,
  onNest,
  onExpand,
}: {
  groups: TaskGroup[];
  boardRef: RefObject<HTMLDivElement | null>;
  onMove: (
    taskId: number,
    destinationAttributes: Attribute[],
    orderedIds: number[],
  ) => void;
  onNest: (
    taskId: number,
    parentId: number,
    orderedIds: number[],
  ) => void;
  onExpand: (taskId: number) => void;
}): {
  move: Move | null;
  startMove: (start: {
    taskId: number;
    fromKey: string;
    pointerX: number;
    pointerY: number;
  }) => void;
} {
  const [move, setMove] = useState<Move | null>(null);
  const moveRef = useRef<Move | null>(null);
  const finishLatest = useRef<() => void>(() => {});
  const dwelling = useRef<{
    taskId: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  function droppableRows(pointerX: number): HTMLElement[] {
    return [
      ...(boardRef.current?.querySelectorAll<HTMLElement>(
        "[data-row]",
      ) ?? []),
    ].filter((row) => {
      const box = headerOf(row).getBoundingClientRect();
      return (
        onScreen(row) && pointerX >= box.left && pointerX <= box.right
      );
    });
  }

  function headerOf(row: HTMLElement): HTMLElement {
    return row.querySelector<HTMLElement>(".task") ?? row;
  }

  function onScreen(row: HTMLElement): boolean {
    return (
      headerOf(row).getBoundingClientRect().height > 0 &&
      row.closest('.collapsible[data-open="false"]') === null
    );
  }

  function placeNear(
    row: HTMLElement,
    after: boolean,
    taskId: number,
    fromKey: string,
  ): Move {
    const parent = row.dataset.parent;
    return {
      taskId: taskId,
      fromKey: fromKey,
      toKey: row.dataset.group ?? fromKey,
      parentId: parent === undefined ? null : Number(parent),
      index: Number(row.dataset.index ?? 0) + (after ? 1 : 0),
    };
  }

  function placeAt(
    pointerX: number,
    pointerY: number,
    taskId: number,
    fromKey: string,
  ): Move {
    const rows = droppableRows(pointerX);

    for (const row of rows) {
      const box = headerOf(row).getBoundingClientRect();
      if (pointerY < box.top + box.height / 2) {
        return placeNear(row, false, taskId, fromKey);
      }
    }

    const last = rows.at(-1);
    if (last) {
      return placeNear(last, true, taskId, fromKey);
    }

    return {
      taskId: taskId,
      fromKey: fromKey,
      toKey: emptyGroupUnder(pointerX) ?? fromKey,
      parentId: null,
      index: 0,
    };
  }

  function emptyGroupUnder(pointerX: number): string | null {
    const columns = [
      ...(boardRef.current?.querySelectorAll<HTMLElement>(
        "[data-group-key]",
      ) ?? []),
    ];

    for (const column of columns) {
      const box = column.getBoundingClientRect();
      if (pointerX >= box.left && pointerX <= box.right) {
        return column.dataset.groupKey ?? null;
      }
    }

    return null;
  }

  function everyTask(): CreatedTask[] {
    const walk = (list: CreatedTask[]): CreatedTask[] =>
      list.flatMap((task) => [task, ...walk(task.subtasks ?? [])]);
    return walk(groups.flatMap((group) => group.tasks));
  }

  function stopDwelling(): void {
    if (dwelling.current) {
      clearTimeout(dwelling.current.timer);
      dwelling.current = null;
    }
  }

  function considerExpanding(
    pointerX: number,
    pointerY: number,
  ): void {
    const under = droppableRows(pointerX).find((row) => {
      const box = headerOf(row).getBoundingClientRect();
      return pointerY >= box.top && pointerY <= box.bottom;
    });
    const alreadyOpen =
      under
        ?.querySelector("[data-subtasks]")
        ?.closest<HTMLElement>(".collapsible")?.dataset.open ===
      "true";
    const shutId =
      under &&
      under.dataset.parent === undefined &&
      under.dataset.task !== undefined &&
      !alreadyOpen
        ? Number(under.dataset.task)
        : null;
    if (shutId === null) {
      stopDwelling();
      return;
    }
    if (dwelling.current?.taskId === shutId) {
      return;
    }
    stopDwelling();
    dwelling.current = {
      taskId: shutId,
      timer: setTimeout(() => {
        dwelling.current = null;
        onExpand(shutId);
      }, HOLD_TO_EXPAND_MILLISECONDS),
    };
  }

  function siblingsAfterDrop(dropped: Move): number[] {
    const parent =
      dropped.parentId === null
        ? null
        : everyTask().find((task) => task.id === dropped.parentId);
    const siblings =
      dropped.parentId === null
        ? (groups.find((group) => group.key === dropped.toKey)
            ?.tasks ?? [])
        : (parent?.subtasks ?? []);

    const ids = siblings
      .map((task) => task.id)
      .filter((id) => id !== dropped.taskId);
    ids.splice(
      Math.min(dropped.index, ids.length),
      0,
      dropped.taskId,
    );
    return ids;
  }

  function finishMove(): void {
    const dropped = moveRef.current;
    moveRef.current = null;
    stopDwelling();
    setMove(null);
    if (!dropped) {
      return;
    }

    const ids = siblingsAfterDrop(dropped);

    if (dropped.parentId !== null) {
      onNest(dropped.taskId, dropped.parentId, ids);
      return;
    }

    const target = groups.find(
      (group) => group.key === dropped.toKey,
    );
    const source = groups.find(
      (group) => group.key === dropped.fromKey,
    );
    if (!target || !source) {
      return;
    }

    const moving = everyTask().find(
      (task) => task.id === dropped.taskId,
    );
    const conferred: Attribute[] =
      target.key === source.key ? [] : target.groupedBy;
    const destinationAttributes: Attribute[] =
      conferred.some((attribute) => attribute.field === "tag") &&
      moving
        ? [
            ...conferred,
            ...moving.tags.map((tag) => ({
              field: "tag" as const,
              value: tag,
              label: tag,
            })),
          ]
        : conferred;

    const cameFromASubtask = moving?.parentId != null;
    const unchanged =
      !cameFromASubtask &&
      target.key === source.key &&
      target.tasks.every((task, index) => task.id === ids[index]);

    if (!unchanged) {
      onMove(dropped.taskId, destinationAttributes, ids);
    }
  }

  useEffect(() => {
    finishLatest.current = finishMove;
  });

  function startMove({
    taskId,
    fromKey,
    pointerX,
    pointerY,
  }: {
    taskId: number;
    fromKey: string;
    pointerX: number;
    pointerY: number;
  }): void {
    function track(atX: number, atY: number): void {
      considerExpanding(atX, atY);
      const next = placeAt(atX, atY, taskId, fromKey);
      moveRef.current = next;
      setMove(next);
    }

    function onDragMove(event: PointerEvent): void {
      event.preventDefault();
      track(event.clientX, event.clientY);
    }

    function onDragEnd(): void {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("pointercancel", onDragEnd);
      finishLatest.current();
    }

    track(pointerX, pointerY);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  return { move: move, startMove: startMove };
}
