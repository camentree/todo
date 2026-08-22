import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { api } from "../api.ts";
import { TopBar } from "../components/Chrome.tsx";
import {
  AddButton,
  focusLastCaptureRow,
} from "../components/NewTask.tsx";
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
  const archived =
    scope.field === "archived" && scope.value === "true";
  const finished =
    scope.field === "state" && scope.value === "complete";

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
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

  useShortcuts((event) => {
    if (event.key === "Escape" && searchText !== null) {
      event.preventDefault();
      setSearchText(null);
      return;
    }
    if (event.key === "c" && !archived && !finished) {
      event.preventDefault();
      focusLastCaptureRow();
    }
    if (event.key === "f") {
      event.preventDefault();
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

  const capturePrefix =
    searchText !== null || archived || finished
      ? null
      : scope.field && scope.field !== view.breakUpBy
        ? captureToken({ field: scope.field, value: scope.value })
        : "";

  const message = messageFor({
    searchText: searchText,
    isPending: isPending,
    tasks: tasks,
    results: results,
    scope: scope,
  });
  const boardHidden =
    searchText === null ? isPending : results.length === 0;

  return (
    <>
      <TopBar
        title={titleFor(scope)}
        view={view}
        onViewChange={changeView}
        onOpenSearch={() => setSearchText("")}
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

      {message && <p className="empty">{message}</p>}

      {!boardHidden && (
        <TaskBoard
          key={pathname}
          groups={groups}
          density={view.density}
          layout={view.layout}
          capturePrefix={capturePrefix}
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

      {!archived && !finished && searchText === null && (
        <AddButton onClick={focusLastCaptureRow} />
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

function messageFor({
  searchText,
  isPending,
  tasks,
  results,
  scope,
}: {
  searchText: string | null;
  isPending: boolean;
  tasks: Task[];
  results: Task[];
  scope: Scope;
}): string | null {
  if (searchText === null) {
    return !isPending && tasks.length === 0 ? emptyFor(scope) : null;
  }
  return searchText.trim().length > 0 && results.length === 0
    ? "No matches."
    : null;
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

function captureToken({
  field,
  value,
}: {
  field: Attribute;
  value: string;
}): string {
  if (field === "list") {
    return `/${value}`;
  }
  if (field === "tag") {
    return `#${value}`;
  }
  if (field === "who") {
    return `@${value}`;
  }
  if (field === "stage") {
    return `!${value}`;
  }
  if (field === "due_date") {
    return value;
  }
  return "";
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
