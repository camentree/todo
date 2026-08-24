import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";

import { api } from "../api.ts";
import type { CreatedTask } from "@shared/types.ts";

export function TaskLink() {
  const parameters = useParams();
  const taskId = Number(parameters.taskId);

  const { data: task, isPending } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.task(taskId),
    retry: false,
  });

  if (isPending) {
    return null;
  }

  return (
    <Navigate
      to={`${task ? screenHolding(task) : ""}/${taskId}`}
      replace
    />
  );
}

function screenHolding(task: CreatedTask): string {
  if (task.archivedAt !== null) {
    return "/archived/true";
  }
  if (task.state === "complete") {
    return "/state/complete";
  }
  return "";
}
