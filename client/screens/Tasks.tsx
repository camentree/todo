import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { api } from "../api.ts";
import { TopBar } from "../components/Chrome.tsx";
import { AddButton, NewTaskRow } from "../components/NewTask.tsx";
import { Shortcuts } from "../components/Shortcuts.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import type { MetaOmission } from "../components/TaskBoard.tsx";
import { TaskInfo } from "../components/TaskInfo.tsx";
import {
  asTitle,
  attributeText,
  dueDateFromLabel,
} from "../format.ts";
import { buildGroups } from "../grouping.ts";
import { useShortcuts } from "../useShortcuts.ts";
import { useTaskActions } from "../useTaskActions.ts";
import { defaultView, useViewPreference } from "../viewPreference.ts";
import { asAttribute } from "@shared/attributes.ts";
import type { Attribute } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { searchTasks } from "@shared/search.ts";
import type { Task } from "@shared/types.ts";

export interface Scope {
  field: Attribute | null;
  value: string;
}

export function Tasks() {
  const parameters = useParams();
  const { pathname } = useLocation();
  const scope: Scope = {
    field: asAttribute(parameters.field),
    value: parameters.value
      ? canonicalName(decodeURIComponent(parameters.value))
      : "",
  };
  const list = scope.field === "list" ? scope.value : undefined;
  const archived =
    scope.field === "archived" && scope.value === "true";
  const finished =
    scope.field === "state" && scope.value === "complete";

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [searchText, setSearchText] = useState<string | null>(null);
  const [helping, setHelping] = useState(false);
  const [view, changeView] = useViewPreference(
    scope.field ? `${scope.field}:${scope.value}` : "all",
    defaultView(scope),
  );
  const actions = useTaskActions(changeView);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const { data: tasks = [], isPending } = useQuery({
    queryKey: ["tasks", scope.field, scope.value],
    queryFn: () => fetchTasks(scope),
  });

  const { data: searchable = [] } = useQuery({
    queryKey: ["tasks", "everything"],
    queryFn: () => api.tasks({ everything: "true" }),
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

  useShortcuts((event) => {
    if (event.key === "Escape" && searchText !== null) {
      event.preventDefault();
      setSearchText(null);
      return;
    }
    if (event.key === "c" && !archived && !finished) {
      event.preventDefault();
      setAdding(true);
    }
    if (event.key === "f") {
      event.preventDefault();
      setAdding(false);
      setSearchText("");
    }
    if (event.key === "?") {
      event.preventDefault();
      setHelping(true);
    }
  });

  const groups =
    searchText === null
      ? buildGroups({
          tasks: tasks,
          view: view,
          lists: lists,
          settling: actions.settling,
          scoped: scopedTo(scope),
        })
      : [
          {
            key: "results",
            label: "",
            omitFromMeta: [],
            tasks: results,
          },
        ];

  return (
    <>
      <TopBar
        title={titleFor(scope)}
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
          key={pathname}
          groups={groups}
          density={view.density}
          layout={view.layout}
          actions={{
            toggle: actions.toggleTask,
            open: (task) => setOpenTaskId(task.id),
            rename: actions.rename,
            remove: actions.remove,
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

      {!archived && !finished && !adding && searchText === null && (
        <AddButton onClick={() => setAdding(true)} />
      )}

      {openTaskId !== null && (
        <TaskInfo
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {helping && <Shortcuts onClose={() => setHelping(false)} />}
    </>
  );
}

function fetchTasks(scope: Scope): Promise<Task[]> {
  if (!scope.field) {
    return api.tasks({});
  }
  const value =
    scope.field === "due_date"
      ? (dueDateFromLabel(scope.value) ?? scope.value)
      : scope.value;
  return api.tasks({ attribute: scope.field, value: value });
}

function titleFor(scope: Scope): string {
  if (!scope.field) {
    return "To Do";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Done";
  }
  const text = attributeText(scope.field, scope.value);
  if (scope.field === "tag") {
    return `#${text}`;
  }
  if (scope.field === "who") {
    return `@${text}`;
  }
  return asTitle(text);
}

function scopedTo(scope: Scope): MetaOmission | null {
  return scope.field
    ? {
        field: scope.field,
        label: attributeText(scope.field, scope.value),
      }
    : null;
}

function emptyFor(scope: Scope): string {
  if (scope.field === "due_date" && scope.value === "today") {
    return "Nothing today.";
  }
  if (scope.field === "archived" && scope.value === "true") {
    return "Nothing archived.";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Nothing finished yet.";
  }
  return "Nothing here.";
}
