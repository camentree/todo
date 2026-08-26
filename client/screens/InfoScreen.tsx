import { Navigate, useParams } from "react-router-dom";

import { useTask } from "../hooks/useTasks.ts";
import type { CreatedTask } from "@shared/types.ts";

export function InfoScreen() {
  const parameters = useParams();
  const taskId = Number(parameters.taskId);

  const { task, isPending } = useTask(taskId);

  if (isPending) {
    return null;
  }

  return (
    <Navigate
      to={`${task ? findScreen(task) : ""}/${taskId}`}
      replace
    />
  );
}

function findScreen(task: CreatedTask): string {
  if (task.archivedAt !== null) {
    return "/archived/true";
  }
  if (task.state === "complete") {
    return "/state/complete";
  }
  return "";
}
