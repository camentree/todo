import { useEffect, useRef, useState } from "react";

import type { CreatedTask } from "@shared/types.ts";

const OWNED_BY_YOU_FOR = 4_000;
const OFFERED_FOR = 5_000;

export function useUndoPrompt({
  screen,
  tasks,
}: {
  screen: string;
  tasks: CreatedTask[];
}): {
  offering: boolean;
  noticed: () => void;
  taken: () => void;
} {
  const [offering, setOffering] = useState(false);
  const onScreen = useRef<Set<number>>(new Set());
  const shownFor = useRef(screen);
  const actedAt = useRef(0);

  useEffect(() => {
    const now = new Set(tasks.map((task) => task.id));
    const arrived = shownFor.current !== screen;
    const left =
      !arrived &&
      [...onScreen.current].some((taskId) => !now.has(taskId));
    onScreen.current = now;
    shownFor.current = screen;

    if (arrived) {
      setOffering(false);
      return;
    }

    if (!left || Date.now() - actedAt.current > OWNED_BY_YOU_FOR) {
      return;
    }
    setOffering(true);
    const timer = setTimeout(() => setOffering(false), OFFERED_FOR);
    return () => clearTimeout(timer);
  }, [tasks, screen]);

  return {
    offering: offering,
    noticed: () => {
      actedAt.current = Date.now();
    },
    taken: () => setOffering(false),
  };
}
