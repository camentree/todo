import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../data/api.ts";
import { inLayout, usePending } from "../data/pending.ts";
import { TopBar } from "../components/TopBar.tsx";
import { Help } from "../components/Help.tsx";
import { Board } from "../components/Board.tsx";
import { FloatingButton } from "../components/FloatingButton.tsx";
import type { Attribute } from "../tasks/attributes.ts";
import { Sheet } from "../components/Sheet.tsx";
import type { SheetTab } from "../components/Sheet.tsx";
import {
  asTitle,
  attributeText,
  todayAsDateString,
  weekEndsOn,
} from "../tasks/format.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { useTaskActions } from "../hooks/useTaskActions.ts";
import { useUndoPrompt } from "../hooks/useUndoPrompt.ts";
import { useTasks } from "../hooks/useTasks.ts";
import {
  defaultView,
  SEARCH_VIEW,
  SEARCH_VIEW_KEY,
  useGlobalSettings,
  useViewPreference,
} from "../data/settings.ts";
import type { Scope, WeekRuns } from "../data/settings.ts";
import { asAttributeField } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import { isTerminal } from "@shared/states.ts";
import { searchTasks } from "@shared/search.ts";
import type { CreatedTask, Task } from "@shared/types.ts";
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

  const { weekRuns } = useGlobalSettings();
  const scope: Scope = spanScope(pathname, weekRuns) ?? {
    field: asAttributeField(field),
    value: value ? canonicalName(decodeURIComponent(value)) : "",
    span: null,
  };
  const archived =
    scope.field === "archived" && scope.value === "true";
  const finished =
    scope.field === "state" && scope.value === "complete";

  const [searchText, setSearchText] = useState<string | null>(null);
  const [composing, setComposing] = useState<Partial<Task> | null>(
    null,
  );
  const [openOn, setOpenOn] = useState<SheetTab>("subtasks");
  const [helping, setHelping] = useState(false);
  const [view, changeView] = useViewPreference(
    searchText === null ? viewKeyFor(scope) : SEARCH_VIEW_KEY,
    searchText === null ? defaultView(scope) : SEARCH_VIEW,
  );
  const actions = useTaskActions(changeView);
  const canCompose = !archived && !finished;
  const screenSeed =
    searchText === null && scope.field && scope.field !== view.groupBy
      ? seedFor(scope)
      : {};

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setComposing(null);
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
    [everything, scope.field, scope.value, scope.span],
  );

  const undoPrompt = useUndoPrompt({
    screen: pathname,
    tasks: tasks,
  });

  function noticing(
    act: (task: CreatedTask) => void,
  ): (task: CreatedTask) => void {
    return (task) => {
      undoPrompt.noticed();
      act(task);
    };
  }

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
      setComposing(screenSeed);
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

  return (
    <>
      <TopBar
        screen={pathname}
        screenName={titleFor(scope)}
        view={view}
        onViewChange={changeView}
        searchText={searchText}
        onSearchChange={setSearchText}
        finished={finished}
      />

      <Board
        key={pathname}
        screen={
          searchText === null ? viewKeyFor(scope) : SEARCH_VIEW_KEY
        }
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
        canCompose={canCompose}
        onCompose={(seed) => setComposing({ ...screenSeed, ...seed })}
        actions={{
          ...actions,
          open: (task) =>
            navigate(`/${[...screen, task.id].join("/")}`),
          search: setSearchText,
          toggle: noticing(actions.toggle),
          remove: noticing(actions.remove),
          archive: noticing(actions.archive),
          delete: noticing(actions.delete),
          moveOn: noticing(actions.moveOn),
          toggleToday: noticing(actions.toggleToday),
          putInWeek: noticing((task) =>
            actions.rename(task, { dueDate: weekEndsOn(weekRuns) }),
          ),
          pickDate: (task) => {
            setOpenOn("timing");
            navigate(`/${[...screen, task.id].join("/")}`);
          },
        }}
        onMove={actions.move}
        onNest={(taskId, parentId, orderedIds) => {
          const moving = findAnywhere(everything, taskId);
          if (moving) {
            actions.reparent(moving, parentId, orderedIds);
          }
        }}
      />

      {openTaskId === null &&
        composing === null &&
        (undoPrompt.offering ? (
          <FloatingButton
            icon="undo"
            label="Undo"
            onClick={() => {
              undoPrompt.taken();
              void actions.undo();
            }}
          />
        ) : (
          canCompose && (
            <FloatingButton
              icon="plus"
              label="Add a task"
              onClick={() => setComposing(screenSeed)}
            />
          )
        ))}

      {(openTaskId !== null || composing !== null) && (
        <Sheet
          key={openTaskId ?? "new"}
          taskId={openTaskId}
          seed={composing ?? {}}
          openOn={openOn}
          onClose={() => {
            setComposing(null);
            setOpenOn("subtasks");
            if (openTaskId !== null) {
              navigate(pathname);
            }
          }}
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

function spanScope(
  pathname: string,
  weekRuns: WeekRuns,
): Scope | null {
  if (pathname === "/today") {
    return {
      field: "due_date",
      value: todayAsDateString(),
      span: "today",
    };
  }
  if (pathname === "/week") {
    return {
      field: "due_date",
      value: weekEndsOn(weekRuns),
      span: "week",
    };
  }
  return null;
}

function within(task: CreatedTask, scope: Scope): boolean {
  if (scope.span !== null) {
    return (
      task.state !== "archived" &&
      task.state !== "missed" &&
      dueOnOrBefore(task.dueDate, scope.value)
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
  if (scope.span !== null) {
    return scope.span;
  }
  if (scope.field === "due_date") {
    return "due_date";
  }
  return scope.field ? `${scope.field}:${scope.value}` : "all";
}

function titleFor(scope: Scope): string | null {
  if (scope.span !== null || !scope.field) {
    return null;
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Done";
  }
  if (scope.field === "archived") {
    return "Archive";
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
  if (scope.span === "week" || !scope.field) {
    return [];
  }
  return [
    {
      field: scope.field,
      value: scope.value,
      label: attributeText(scope.field, scope.value),
    },
  ];
}

function seedFor(scope: Scope): Partial<CreatedTask> {
  if (scope.span === "week") {
    return {};
  }
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
  if (scope.span === "today") {
    return "Nothing today.";
  }
  if (scope.span === "week") {
    return "Nothing this week.";
  }
  if (scope.field === "archived" && scope.value === "true") {
    return "Nothing archived.";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Nothing finished yet.";
  }
  return "Nothing here.";
}

function findAnywhere(
  tasks: CreatedTask[],
  taskId: number,
): CreatedTask | undefined {
  for (const task of tasks) {
    if (task.id === taskId) {
      return task;
    }
    const nested = findAnywhere(task.subtasks ?? [], taskId);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}
