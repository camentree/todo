import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { api } from "../api.ts";
import { TopBar } from "../components/Chrome.tsx";
import { AddButton, NewTaskRow } from "../components/NewTask.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import type { MetaOmission } from "../components/TaskBoard.tsx";
import { TaskSheet } from "../components/TaskSheet.tsx";
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

  useShortcuts((event) => {
    if (event.key === "c" && !archived && !finished) {
      event.preventDefault();
      setAdding(true);
    }
    if (event.key === "f") {
      const field = document.querySelector<HTMLInputElement>(
        "[data-search-field]",
      );
      if (field) {
        event.preventDefault();
        field.focus();
      }
    }
  });

  const groups = buildGroups({
    tasks: tasks,
    view: view,
    lists: lists,
    settling: actions.settling,
    scoped: scopedTo(scope),
  });

  return (
    <>
      <TopBar
        title={titleFor(scope)}
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

      {!archived && !finished && !adding && (
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
