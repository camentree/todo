import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api.ts";
import { TopBar } from "../components/Chrome.tsx";
import { AddButton, NewTaskRow } from "../components/NewTask.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import { TaskSheet } from "../components/TaskSheet.tsx";
import { buildGroups } from "../grouping.ts";
import { useTaskActions } from "../useTaskActions.ts";
import { defaultView, useViewPreference } from "../viewPreference.ts";
import { searchTasks } from "@shared/search.ts";

export type Scope = "today" | "todo" | "archive" | "list";

export function Tasks({ scope }: { scope: Scope }) {
  const { name } = useParams();
  const list =
    scope === "list" ? decodeURIComponent(name ?? "") : undefined;
  const key = scope === "list" ? `list:${list}` : scope;

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [searchText, setSearchText] = useState<string | null>(null);
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
    queryKey: ["tasks", scope, list],
    queryFn: () => {
      if (scope === "today") return api.today();
      if (scope === "archive") return api.archive();
      return api.tasks(list ? { list: list } : {});
    },
  });

  const { data: searchable = [] } = useQuery({
    queryKey: ["tasks", "searchable"],
    queryFn: () => api.tasks({ includeArchived: "true" }),
    enabled: searchText !== null,
  });

  const results = useMemo(
    () =>
      searchTasks({
        tasks: searchable,
        input: searchText ?? "",
        today: new Date(),
      }),
    [searchable, searchText],
  );

  const showing = searchText === null ? tasks : results;
  const nothing =
    searchText === null
      ? isPending
        ? null
        : emptyFor(scope)
      : searchText.trim().length === 0
        ? null
        : "No matches.";

  const groups = buildGroups({
    tasks: showing,
    view: view,
    lists: lists,
    settling: actions.settling,
  });

  return (
    <>
      <TopBar
        title={titleFor({ scope: scope, list: list })}
        view={view}
        onViewChange={changeView}
        onOpenSearch={() => {
          setAdding(false);
          setSearchText("");
        }}
        search={
          searchText === null
            ? undefined
            : {
                text: searchText,
                onChange: setSearchText,
                onClose: () => setSearchText(null),
              }
        }
      />

      {showing.length === 0 && !adding ? (
        nothing && <p className="empty">{nothing}</p>
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

      {scope !== "archive" && !adding && searchText === null && (
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
  list,
}: {
  scope: Scope;
  list: string | undefined;
}): string {
  if (scope === "today") return "Today";
  if (scope === "archive") return "Archive";
  if (scope === "list") return list ?? "";
  return "To Do";
}

function emptyFor(scope: Scope): string {
  if (scope === "today") return "Nothing today.";
  if (scope === "archive") return "Nothing archived.";
  return "Nothing here.";
}
