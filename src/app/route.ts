import { useSyncExternalStore } from "react";

export type Tab = "tasks" | "journal" | "notebook";

export interface Route {
  tab: Tab;
  id: string | null;
  run?: string[];
  edit?: boolean;
}

const segments: Record<Tab, string> = { tasks: "tasks", journal: "journals", notebook: "notebooks" };
const tabs = Object.keys(segments) as Tab[];
const listeners = new Set<() => void>();

function routeOf({ pathname, search }: { pathname: string; search: string }): Route {
  const [segment = "", id = ""] = pathname.split("/").filter(Boolean);
  const query = new URLSearchParams(search);
  const run = query.get("run");
  return { tab: tabs.find((tab) => segments[tab] === segment) ?? "tasks", id: id === "" ? null : decodeURIComponent(id), run: run ? run.split(",") : [], edit: run === null && query.has("edit") };
}

function pathOf({ tab, id, run = [], edit = false }: Route): string {
  const query = run.length > 0 ? "?run=" + run.join(",") : edit ? "?edit" : "";
  return "/" + segments[tab] + (id === null ? "" : "/" + encodeURIComponent(id)) + query;
}

let current = routeOf(window.location);

window.history.replaceState(null, "", pathOf(current));

function announce(): void {
  for (const listener of listeners) listener();
}

window.addEventListener("popstate", () => {
  current = routeOf(window.location);
  announce();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRoute(): { route: Route; go: (route: Route) => void; replace: (route: Route) => void; close: () => void } {
  const route = useSyncExternalStore(subscribe, () => current);
  return {
    route,
    go: (next) => {
      const path = pathOf(next);
      if (path === window.location.pathname + window.location.search) return;
      window.history.pushState({ pushed: true }, "", path);
      current = next;
      announce();
    },
    replace: (next) => {
      window.history.replaceState(window.history.state, "", pathOf(next));
      current = next;
      announce();
    },
    close: () => {
      if (window.history.state?.pushed) {
        window.history.back();
        return;
      }
      const list = { tab: current.tab, id: null };
      window.history.replaceState(null, "", pathOf(list));
      current = list;
      announce();
    },
  };
}
