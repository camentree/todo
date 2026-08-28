import { isDueToday, todayAsDateString } from "./format.ts";
import type { SwipeAction } from "../components/ui/Swipeable.tsx";
import { isTerminal } from "@shared/states.ts";
import type { CreatedTask } from "@shared/types.ts";

export interface SwipeHandlers {
  archive: (task: CreatedTask) => void;
  delete: (task: CreatedTask) => void;
  moveOn: (task: CreatedTask) => void;
  pickDate: (task: CreatedTask) => void;
  putInWeek: (task: CreatedTask) => void;
  toggleToday: (task: CreatedTask) => void;
}

export function leftSwipe(
  task: CreatedTask,
  handlers: SwipeHandlers,
): SwipeAction | undefined {
  if (task.state === "archived" || isTerminal(task.state)) {
    return {
      name: "Delete",
      action: () => handlers.delete(task),
    };
  }
  return { name: "Archive", action: () => handlers.archive(task) };
}

export function rightSwipes(
  task: CreatedTask,
  handlers: SwipeHandlers,
): SwipeAction[] {
  if (task.state === "archived") {
    return [
      { name: "Put it back", action: () => handlers.moveOn(task) },
    ];
  }
  if (isTerminal(task.state)) {
    return [
      { name: "Archive", action: () => handlers.archive(task) },
    ];
  }
  if (task.recurringTaskId) {
    return canSkip(task)
      ? [{ name: "Skip", action: () => handlers.moveOn(task) }]
      : [];
  }
  return [
    {
      name: "Pick",
      icon: "clock",
      action: () => handlers.pickDate(task),
    },
    {
      name: "Week",
      icon: "calendar",
      action: () => handlers.putInWeek(task),
    },
    isDueToday(task.dueDate)
      ? {
          name: "Not today",
          icon: "sunStruck",
          action: () => handlers.toggleToday(task),
        }
      : {
          name: "Today",
          icon: "sun",
          action: () => handlers.toggleToday(task),
        },
  ];
}

function canSkip(task: CreatedTask): boolean {
  return task.dueDate !== null && task.dueDate <= todayAsDateString();
}
