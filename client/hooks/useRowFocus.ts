import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { easeToTop } from "./useEaseIntoView.ts";
import type { CreatedTask } from "@shared/types.ts";

export function useRowFocus({
  shown,
  boardRef,
}: {
  shown: CreatedTask[];
  boardRef: RefObject<HTMLDivElement | null>;
}): {
  focusedId: number | null;
  focusAt: (index: number) => void;
  focusStep: (step: number) => void;
  focusOn: (taskId: number | null) => void;
  hoverOn: (taskId: number | null) => void;
  land: (taskId: number) => void;
} {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [landingId, setLandingId] = useState<number | null>(null);
  const lastFocusedId = useRef<number | null>(null);
  const followingPointer = useRef(true);
  const pointerX = useRef<number | null>(null);
  const pointerY = useRef<number | null>(null);

  const focusedIndex = shown.findIndex(
    (task) => task.id === focusedId,
  );

  useEffect(() => {
    if (landingId === null) {
      return;
    }
    if (!shown.some((task) => task.id === landingId)) {
      return;
    }
    setFocusedId(landingId);
    setLandingId(null);
    requestAnimationFrame(() => {
      const landed = boardRef.current?.querySelector(
        `[data-task="${landingId}"]`,
      );
      if (landed) {
        easeToTop(landed);
      }
    });
  }, [landingId, shown, boardRef]);

  useEffect(() => {
    function pressed(): void {
      followingPointer.current = false;
    }
    function moved(event: PointerEvent): void {
      if (
        event.clientX === pointerX.current &&
        event.clientY === pointerY.current
      ) {
        return;
      }
      pointerX.current = event.clientX;
      pointerY.current = event.clientY;
      followingPointer.current = true;
    }
    window.addEventListener("keydown", pressed);
    window.addEventListener("pointermove", moved);
    return () => {
      window.removeEventListener("keydown", pressed);
      window.removeEventListener("pointermove", moved);
    };
  }, []);

  function focusOn(taskId: number | null): void {
    if (taskId !== null) {
      lastFocusedId.current = taskId;
    }
    setFocusedId(taskId);
  }

  function hoverOn(taskId: number | null): void {
    if (!followingPointer.current) {
      return;
    }
    focusOn(taskId);
  }

  function focusAt(index: number): void {
    const task =
      shown[Math.min(Math.max(index, 0), shown.length - 1)];
    if (!task) {
      return;
    }
    focusOn(task.id);
    boardRef.current
      ?.querySelector(`[data-task="${task.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function focusStep(step: number): void {
    if (focusedId !== null) {
      focusAt(focusedIndex + step);
      return;
    }
    const resuming = shown.findIndex(
      (task) => task.id === lastFocusedId.current,
    );
    focusAt(resuming === -1 ? 0 : resuming + step);
  }

  return {
    focusedId: focusedId,
    focusAt: focusAt,
    focusStep: focusStep,
    focusOn: focusOn,
    hoverOn: hoverOn,
    land: setLandingId,
  };
}
