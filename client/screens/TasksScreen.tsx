import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../data/api.ts";
import { inLayout, usePending } from "../data/pending.ts";
import { Search } from "../components/Search.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Help } from "../components/Help.tsx";
import { Board } from "../components/Board.tsx";
import { AddButton } from "../components/Row.tsx";
import type { Attribute } from "../tasks/attributes.ts";
import { Info } from "../components/Info.tsx";
import {
  asTitle,
  attributeText,
  todayAsDateString,
} from "../tasks/format.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useTaskActions } from "../hooks/useTaskActions.ts";
import { useTasks } from "../hooks/useTasks.ts";
import {
  defaultView,
  SEARCH_VIEW,
  SEARCH_VIEW_KEY,
  useViewPreference,
} from "../data/settings.ts";
import type { Scope } from "../data/settings.ts";
import { asAttributeField } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import { searchTasks } from "@shared/search.ts";
import type { CreatedTask } from "@shared/types.ts";
export function TasksScreen() {
  const parameters = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openTaskId = parameters.taskId
    ? Number(parameters.taskId)
    : null;
  const segments = location.pathname.split("/").filter(Boolean);
  const screen =
    openTaskId === null ? segments : segments.slice(0, -1);
  const pathname = `/${screen.join("/")}`;
  const [field, value] = screen;

  const scope: Scope =
    pathname === "/today"
      ? {
          field: "due_date",
          value: todayAsDateString(),
          today: true,
        }
      : {
          field: asAttributeField(field),
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

  const { tasks: confirmed, isPending } = useTasks();
  const pending = usePending();
  const everything = useMemo(
    () => inLayout(confirmed, pending),
    [confirmed, pending],
  );

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

  useKeyboardShortcuts((event) => {
    if (event.key === "F" && searchText !== null) {
      event.preventDefault();
      setSearchText(null);
      return;
    }
    if (event.key === "n" && !archived && !finished) {
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
    archived || finished
      ? null
      : searchText !== null
        ? {}
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
        finished={finished}
        onOpenSearch={() => setSearchText("")}
      />

      {searchText !== null && (
        <Search
          text={searchText}
          onChange={setSearchText}
          onClose={() => setSearchText(null)}
        />
      )}

      <Board
        key={pathname}
        tasks={searchText === null ? tasks : results}
        view={view}
        lists={lists}
        hiddenAttributes={searchText === null ? scopedTo(scope) : []}
        showFinished={archived || finished || searchText !== null}
        pending={searchText === null && isPending}
        emptyMessage={emptyMessageFor({
          searchText: searchText,
          scope: scope,
        })}
        captureSeed={captureSeed}
        capturing={capturing}
        onCapturingChange={setCapturing}
        actions={{
          ...actions,
          open: (task) =>
            navigate(`/${[...screen, task.id].join("/")}`),
        }}
        onMove={actions.move}
      />

      {!archived && !finished && (
        <AddButton onClick={() => setCapturing(true)} />
      )}

      {openTaskId !== null && (
        <Info
          taskId={openTaskId}
          onClose={() => navigate(pathname)}
        />
      )}

      {helping && <Help onClose={() => setHelping(false)} />}
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
      task.state !== "archived" &&
      task.state !== "missed" &&
      dueOnOrBefore(task.dueDate, todayAsDateString())
    );
  }
  if (scope.field === "archived") {
    return (task.state === "archived") === (scope.value === "true");
  }
  if (task.state === "archived") {
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
  if (!isTerminal(task.state)) {
    return true;
  }
  return (
    task.finishedAt !== null &&
    task.finishedAt.slice(0, 10) === todayAsDateString()
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

function scopedTo(scope: Scope): Attribute[] {
  return scope.field
    ? [
        {
          field: scope.field,
          value: scope.value,
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
