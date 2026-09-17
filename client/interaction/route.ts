import { useSyncExternalStore } from "react";

import type { Tab } from "../components/TopBar.tsx";

export interface Route {
  tab: Tab;
  id: string | null;
}

const segments: Record<Tab, string> = { tasks: "tasks", journal: "journals", notebook: "notebooks" };
const tabs = Object.keys(segments) as Tab[];
const listeners = new Set<() => void>();

function routeOf(pathname: string): Route {
  const [segment = "", id = ""] = pathname.split("/").filter(Boolean);
  return { tab: tabs.find((tab) => segments[tab] === segment) ?? "tasks", id: id === "" ? null : decodeURIComponent(id) };
}

function pathOf({ tab, id }: Route): string {
  return "/" + segments[tab] + (id === null ? "" : "/" + encodeURIComponent(id));
}

let current = routeOf(window.location.pathname);

window.history.replaceState(null, "", pathOf(current));

function announce(): void {
  for (const listener of listeners) listener();
}

window.addEventListener("popstate", () => {
  current = routeOf(window.location.pathname);
  announce();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRoute(): { route: Route; go: (route: Route) => void; close: () => void } {
  const route = useSyncExternalStore(subscribe, () => current);
  return {
    route,
    go: (next) => {
      const path = pathOf(next);
      if (path === window.location.pathname) return;
      window.history.pushState({ pushed: true }, "", path);
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
