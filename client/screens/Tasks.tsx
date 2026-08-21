import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api.ts";
import { TopBar } from "../components/Chrome.tsx";
import { AddButton, NewTaskRow } from "../components/NewTask.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import type { MetaOmission } from "../components/TaskBoard.tsx";
import { TaskSheet } from "../components/TaskSheet.tsx";
import { buildGroups } from "../grouping.ts";
import { useTaskActions } from "../useTaskActions.ts";
import { defaultView, useViewPreference } from "../viewPreference.ts";

export type Scope =
  | "today"
  | "todo"
  | "archive"
  | "list"
  | "tag"
  | "who";

export function Tasks({ scope }: { scope: Scope }) {
  const { name } = useParams();
  const filter = name === undefined ? "" : decodeURIComponent(name);
  const list = scope === "list" ? filter : undefined;
  const key = filter ? `${scope}:${filter}` : scope;

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, changeView] = useViewPreference(
    key,
    defaultView(scope),
  );
  const actions = useTaskActions(changeView);

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const { data: tasks = [], isPending } = useQuery({
    queryKey: ["tasks", scope, filter],
    queryFn: () => {
      if (scope === "today") return api.today();
      if (scope === "archive") return api.archive();
      if (scope === "tag") return api.tasks({ tags: filter });
      if (scope === "who") return api.tasks({ who: filter });
      return api.tasks(list ? { list: list } : {});
    },
  });

  const groups = buildGroups({
    tasks: tasks,
    view: view,
    lists: lists,
    settling: actions.settling,
    scoped: scopedTo({ scope: scope, filter: filter }),
  });

  return (
    <>
      <TopBar
        title={titleFor({ scope: scope, filter: filter })}
        view={view}
        onViewChange={changeView}
      />

      {isPending ? null : tasks.length === 0 && !adding ? (
        <p className="empty">{emptyFor(scope)}</p>
      ) : (
        <TaskBoard
          groups={groups}
          density={view.density}
          layout={view.layout}
          actions={{
            toggle: actions.toggleTask,
            open: (task) => setOpenTaskId(task.id),
            rename: actions.rename,
            swipeLeft: actions.swipeLeft,
            swipeRight: actions.swipeRight,
          }}
          onMove={actions.move}
        />
      )}

      {adding && (
        <NewTaskRow
          list={list}
          density={view.density}
          onClose={() => setAdding(false)}
        />
      )}

      {scope !== "archive" && !adding && (
        <AddButton onClick={() => setAdding(true)} />
      )}

      {openTaskId !== null && (
        <TaskSheet
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}

function titleFor({
  scope,
  filter,
}: {
  scope: Scope;
  filter: string;
}): string {
  if (scope === "today") return "Today";
  if (scope === "archive") return "Archive";
  if (scope === "list") return filter;
  if (scope === "tag") return `#${filter}`;
  if (scope === "who") return `@${filter}`;
  return "To Do";
}

function scopedTo({
  scope,
  filter,
}: {
  scope: Scope;
  filter: string;
}): MetaOmission | null {
  if (scope === "list" || scope === "tag" || scope === "who") {
    return { field: scope, label: filter };
  }
  return null;
}

function emptyFor(scope: Scope): string {
  if (scope === "today") return "Nothing today.";
  if (scope === "archive") return "Nothing archived.";
  return "Nothing here.";
}
