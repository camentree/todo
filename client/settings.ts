import { useSyncExternalStore } from "react";

import type { Attribute } from "@shared/attributes.ts";
import type {
  GroupByField,
  Layout,
  OrderDirection,
  OrderByField,
  ViewPreference,
} from "@shared/types.ts";

const GLOBAL_KEY = "todo.settings";
const SCREENS_KEY = "todo.screens";
const SETTLE_MILLISECONDS = 500;

export const HISTORY_STOPS = [1, 3, 6, 12, 24, 60, null] as const;

export type HistoryMonths = (typeof HISTORY_STOPS)[number];
export interface Scope {
  field: Attribute | null;
  value: string;
  today: boolean;
}

export type Theme = "system" | "light" | "dark";

export interface GlobalSettings {
  theme: Theme;
  historyMonths: HistoryMonths;
}

const FLAT_MANUAL: ViewPreference = {
  groupBy: "none",
  orderBy: "manual",
  orderDirection: "asc",
  layout: "stacked",
};

const BY_LIST: ViewPreference = {
  groupBy: "list",
  orderBy: "manual",
  orderDirection: "asc",
  layout: "stacked",
};

const BY_DUE: ViewPreference = {
  groupBy: "none",
  orderBy: "due_date",
  orderDirection: "desc",
  layout: "stacked",
};

const BY_FINISHED: ViewPreference = {
  groupBy: "none",
  orderBy: "resolved_at",
  orderDirection: "desc",
  layout: "stacked",
};

const BY_RELEVANCE: ViewPreference = {
  groupBy: "none",
  orderBy: "relevance",
  orderDirection: "asc",
  layout: "stacked",
};

export const SEARCH_VIEW: ViewPreference = BY_RELEVANCE;
export const SEARCH_VIEW_KEY = "search";

export function defaultView(scope: Scope): ViewPreference {
  if (scope.today) return BY_DUE;
  if (scope.field === "state" && scope.value === "complete")
    return BY_FINISHED;
  if (scope.field === null) return BY_LIST;
  return FLAT_MANUAL;
}

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

const listeners = new Set<() => void>();

let global: GlobalSettings = stored(GLOBAL_KEY, {
  theme: "system" as Theme,
  historyMonths: 24 as HistoryMonths,
});
let screens: Record<string, Partial<ViewPreference>> = stored(
  SCREENS_KEY,
  {},
);
let settledHistory: HistoryMonths = global.historyMonths;
let settling: ReturnType<typeof setTimeout> | null = null;

function announce(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function changeGlobal(changes: Partial<GlobalSettings>): void {
  global = { ...global, ...changes };
  window.localStorage.setItem(GLOBAL_KEY, JSON.stringify(global));
  announce();

  if (changes.historyMonths === undefined) {
    return;
  }
  if (settling) {
    clearTimeout(settling);
  }
  settling = setTimeout(() => {
    settling = null;
    settledHistory = global.historyMonths;
    announce();
  }, SETTLE_MILLISECONDS);
}

export function changeScreen(
  key: string,
  changes: Partial<ViewPreference>,
): void {
  screens = {
    ...screens,
    [key]: { ...screens[key], ...changes },
  };
  window.localStorage.setItem(SCREENS_KEY, JSON.stringify(screens));
  announce();
}

export function currentGlobal(): GlobalSettings {
  return global;
}

export function useGlobalSettings(): GlobalSettings {
  return useSyncExternalStore(subscribe, () => global);
}

export function useSettledHistory(): HistoryMonths {
  return useSyncExternalStore(subscribe, () => settledHistory);
}

export function useViewPreference(
  key: string,
  fallback: ViewPreference,
): [ViewPreference, (changes: Partial<ViewPreference>) => void] {
  const saved = useSyncExternalStore(subscribe, () => screens[key]);
  return [
    {
      groupBy: (saved?.groupBy ?? fallback.groupBy) as GroupByField,
      orderBy: (saved?.orderBy ?? fallback.orderBy) as OrderByField,
      orderDirection: (saved?.orderDirection ??
        fallback.orderDirection) as OrderDirection,
      layout: (saved?.layout ?? fallback.layout) as Layout,
    },
    (changes) => changeScreen(key, changes),
  ];
}

export function historyStartsOn(
  months: HistoryMonths,
): string | null {
  if (months === null) {
    return null;
  }
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return start.toISOString().slice(0, 10);
}

export function historyLabel(months: HistoryMonths): string {
  if (months === null) {
    return "Everything";
  }
  if (months === 1) {
    return "1 month";
  }
  if (months < 12) {
    return `${months} months`;
  }
  const years = months / 12;
  return years === 1 ? "1 year" : `${years} years`;
}
