export const TASK_STAGES = [
  "to_do",
  "in_progress",
  "in_review",
  "blocked",
  "complete",
] as const;

export type TaskStage = (typeof TASK_STAGES)[number];

const STAGE_LABELS: Record<TaskStage, string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  complete: "Complete",
};

export function stageLabel(stage: TaskStage): string {
  return STAGE_LABELS[stage];
}

export function asStage(value: unknown): TaskStage | null {
  return TASK_STAGES.find((stage) => stage === value) ?? null;
}
