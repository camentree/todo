import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../api.ts";
import { SearchField } from "../components/SearchField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Shortcuts } from "../components/Shortcuts.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import { AddButton } from "../components/TaskRow.tsx";
import type { AttributeOmission } from "../components/TaskBoard.tsx";
import { TaskInfo } from "../components/TaskInfo.tsx";
import {
  asTitle,
  attributeText,
  todayAsDateString,
} from "../format.ts";
import { useShortcuts } from "../useShortcuts.ts";
import { useTaskActions } from "../useTaskActions.ts";
import {
  defaultView,
  historyStartsOn,
  SEARCH_VIEW,
  SEARCH_VIEW_KEY,
  useSettledHistory,
  useViewPreference,
} from "../settings.ts";
import { asAttribute } from "@shared/attributes.ts";
import type { Attribute } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import { searchTasks } from "@shared/search.ts";
import type { CreatedTask } from "@shared/types.ts";

export interface Scope {
  field: Attribute | null;
  value: string;
  today: boolean;
}

export function Tasks() {
  const parameters = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openTaskId = parameters.taskId
    ? Number(parameters.taskId)
    : null;
  const behind =
    (location.state as { from?: string } | null)?.from ?? "/";
  const pathname = openTaskId === null ? location.pathname : behind;
  const [, field, value] = pathname.split("/");

  const scope: Scope =
    pathname === "/today"
      ? {
          field: "due_date",
          value: todayAsDateString(),
          today: true,
        }
      : {
          field: asAttribute(field),
          value: value
            ? canonicalName(decodeURIComponent(value))
            : "",
          today: false,
        };
  const archived =
    scope.field === "archived" && scope.value === "true";
  const finished =
    scope.field === "state" && scope.value === "complete";

  const [searchText, setSearchText] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [helping, setHelping] = useState(false);
  const [view, changeView] = useViewPreference(
    searchText === null ? viewKeyFor(scope) : SEARCH_VIEW_KEY,
    searchText === null ? defaultView(scope) : SEARCH_VIEW,
  );
  const actions = useTaskActions(changeView);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setCapturing(false);
    setSearchText(null);
  }, [pathname]);

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const since = historyStartsOn(useSettledHistory());

  const { data: everything = [], isPending } = useQuery({
    queryKey: ["tasks", since],
    queryFn: () => api.tasks(since),
  });

  const tasks = useMemo(
    () => everything.filter((task) => within(task, scope)),
    [everything, scope.field, scope.value, scope.today],
  );

  const results = useMemo(
    () =>
      searchTasks({
        tasks: everything,
        input: searchText ?? "",
        today: new Date(),
      }),
    [everything, searchText],
  );

  useShortcuts((event) => {
    if (event.key === "F" && searchText !== null) {
      event.preventDefault();
      setSearchText(null);
      return;
    }
    if (event.key === "c" && !archived && !finished) {
      event.preventDefault();
      setCapturing(true);
    }
    if (event.key === "f") {
      event.preventDefault();
      if (searchText === null) {
        setSearchText("");
        return;
      }
      document
        .querySelector<HTMLInputElement>("[data-search-field]")
        ?.focus();
    }
    if (event.key === "?") {
      event.preventDefault();
      setHelping(true);
    }
  });

  const captureSeed =
    searchText !== null || archived || finished
      ? null
      : scope.field && scope.field !== view.groupBy
        ? seedFor(scope)
        : {};

  return (
    <>
      <TopBar
        title={searchText === null ? titleFor(scope) : "Search"}
        view={view}
        onViewChange={changeView}
        searching={searchText !== null}
        onOpenSearch={() => setSearchText("")}
      />

      {searchText !== null && (
        <SearchField
          text={searchText}
          onChange={setSearchText}
          onClose={() => setSearchText(null)}
        />
      )}

      <TaskBoard
        key={pathname}
        tasks={searchText === null ? tasks : results}
        justToggled={actions.justToggled}
        view={view}
        lists={lists}
        omitAttributes={searchText === null ? scopedTo(scope) : []}
        showFinished={finished || searchText !== null}
        pending={searchText === null && isPending}
        emptyMessage={emptyMessageFor({
          searchText: searchText,
          scope: scope,
        })}
        captureSeed={captureSeed}
        capturing={capturing}
        onCapturingChange={setCapturing}
        actions={{
          toggle: actions.toggleTask,
          open: (task) =>
            navigate(`/task/${task.id}`, {
              state: { from: location.pathname },
            }),
          rename: actions.rename,
          create: actions.create,
          remove: actions.remove,
          swipeLeft: actions.swipeLeft,
          swipeRight: actions.swipeRight,
          undo: actions.undo,
          redo: actions.redo,
        }}
        onMove={actions.move}
      />

      {!archived && !finished && searchText === null && (
        <AddButton onClick={() => setCapturing(true)} />
      )}

      {openTaskId !== null && (
        <TaskInfo
          taskId={openTaskId}
          onClose={() => navigate(behind)}
        />
      )}

      {helping && <Shortcuts onClose={() => setHelping(false)} />}
    </>
  );
}

function emptyMessageFor({
  searchText,
  scope,
}: {
  searchText: string | null;
  scope: Scope;
}): string {
  if (searchText === null) {
    return emptyFor(scope);
  }
  return searchText.trim().length > 0 ? "No matches." : "";
}

function within(task: CreatedTask, scope: Scope): boolean {
  if (scope.today) {
    return (
      task.archivedAt === null &&
      task.state !== "missed" &&
      dueOnOrBefore(task.dueDate, todayAsDateString())
    );
  }
  if (scope.field === "archived") {
    return (task.archivedAt !== null) === (scope.value === "true");
  }
  if (task.archivedAt !== null) {
    return false;
  }
  if (scope.field === null) {
    return notLongResolved(task);
  }
  if (scope.field === "state") {
    return task.state === scope.value;
  }
  return notLongResolved(task) && matches(task, scope);
}

function matches(task: CreatedTask, scope: Scope): boolean {
  if (scope.field === "list") {
    return canonicalName(task.list) === scope.value;
  }
  if (scope.field === "tag") {
    return task.tags.some(
      (tag) => canonicalName(tag) === scope.value,
    );
  }
  if (scope.field === "who") {
    return (
      task.who !== null && canonicalName(task.who) === scope.value
    );
  }
  if (scope.field === "stage") {
    return task.stage === scope.value;
  }
  if (scope.field === "due_date") {
    return task.dueDate === scope.value;
  }
  if (scope.field === "due_time") {
    return task.dueTime === scope.value;
  }
  if (scope.field === "recurring") {
    return (
      (task.recurringTaskId !== null) === (scope.value === "true")
    );
  }
  return true;
}

function notLongResolved(task: CreatedTask): boolean {
  if (task.state !== "complete" && task.state !== "skipped") {
    return true;
  }
  return (
    task.resolvedAt !== null &&
    task.resolvedAt.slice(0, 10) === todayAsDateString()
  );
}

function dueOnOrBefore(
  dueDate: string | null,
  today: string,
): boolean {
  return dueDate !== null && dueDate <= today;
}

function viewKeyFor(scope: Scope): string {
  if (scope.today) {
    return "today";
  }
  if (scope.field === "due_date") {
    return "due_date";
  }
  return scope.field ? `${scope.field}:${scope.value}` : "all";
}

function titleFor(scope: Scope): string {
  if (scope.today) {
    return "Today";
  }
  if (!scope.field) {
    return "To Do";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Done";
  }
  if (scope.field === "due_date") {
    return scope.value;
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

function scopedTo(scope: Scope): AttributeOmission[] {
  return scope.field
    ? [
        {
          field: scope.field,
          label: attributeText(scope.field, scope.value),
        },
      ]
    : [];
}

function seedFor(scope: Scope): Partial<CreatedTask> {
  if (scope.field === "list") {
    return { list: scope.value };
  }
  if (scope.field === "tag") {
    return { tags: [scope.value] };
  }
  if (scope.field === "who") {
    return { who: scope.value };
  }
  if (scope.field === "stage") {
    return { stage: asStage(scope.value) };
  }
  if (scope.field === "due_date") {
    return { dueDate: scope.value };
  }
  return {};
}

function emptyFor(scope: Scope): string {
  if (scope.today) {
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
