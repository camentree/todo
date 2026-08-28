import { createStore, useStore } from "../data/store.ts";

import type { AttributeField } from "@shared/attributes.ts";
import type {
  GroupByField,
  OrderDirection,
  OrderByField,
  ViewPreference,
} from "@shared/types.ts";

const GLOBAL_KEY = "todo.settings";
const SCREENS_KEY = "todo.screens";
const FOLDED_KEY = "todo.folded";
const SETTLE_MILLISECONDS = 500;

export const HISTORY_STOPS = [1, 3, 6, 12, 24, 60, null] as const;

export type HistoryMonths = (typeof HISTORY_STOPS)[number];

export interface Scope {
  field: AttributeField | null;
  value: string;
  through: string;
  today: boolean;
}

export type Theme = "system" | "light" | "dark";

export type WeekRuns = "calendar" | "rolling";

export interface GlobalSettings {
  theme: Theme;
  historyMonths: HistoryMonths;
  weekRuns: WeekRuns;
}

const FLAT_MANUAL: ViewPreference = {
  groupBy: "none",
  orderBy: "manual",
  orderDirection: "asc",
};

const BY_LIST: ViewPreference = {
  groupBy: "list",
  orderBy: "manual",
  orderDirection: "asc",
};

const BY_LIST_THEN_DUE: ViewPreference = {
  groupBy: "list",
  orderBy: "due_date",
  orderDirection: "asc",
};

const BY_FINISHED: ViewPreference = {
  groupBy: "none",
  orderBy: "finished_at",
  orderDirection: "desc",
};

const BY_RELEVANCE: ViewPreference = {
  groupBy: "none",
  orderBy: "relevance",
  orderDirection: "asc",
};

export const SEARCH_VIEW: ViewPreference = BY_RELEVANCE;
export const SEARCH_VIEW_KEY = "search";

export function defaultView(scope: Scope): ViewPreference {
  if (scope.today) return BY_LIST_THEN_DUE;
  if (scope.field === "state" && scope.value === "complete")
    return BY_FINISHED;
  if (scope.field === null) return BY_LIST;
  return FLAT_MANUAL;
}

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw
      ? { ...fallback, ...JSON.parse(renamedOrderBy(raw)) }
      : fallback;
  } catch {
    return fallback;
  }
}

function renamedOrderBy(raw: string): string {
  return raw.replaceAll('"resolved_at"', '"finished_at"');
}

const global = createStore<GlobalSettings>(
  stored(GLOBAL_KEY, {
    theme: "system" as Theme,
    historyMonths: 24 as HistoryMonths,
    weekRuns: "calendar" as WeekRuns,
  }),
);
const screens = createStore<Record<string, Partial<ViewPreference>>>(
  stored(SCREENS_KEY, {}),
);
const folded = createStore<Record<string, string[]>>(
  stored(FOLDED_KEY, {}),
);
const settledHistory = createStore<HistoryMonths>(
  global.read().historyMonths,
);
let settling: ReturnType<typeof setTimeout> | null = null;

export function changeGlobal(changes: Partial<GlobalSettings>): void {
  global.write({ ...global.read(), ...changes });
  window.localStorage.setItem(
    GLOBAL_KEY,
    JSON.stringify(global.read()),
  );

  if (changes.historyMonths === undefined) {
    return;
  }
  if (settling) {
    clearTimeout(settling);
  }
  settling = setTimeout(() => {
    settling = null;
    settledHistory.write(global.read().historyMonths);
  }, SETTLE_MILLISECONDS);
}

export function changeScreen(
  key: string,
  changes: Partial<ViewPreference>,
): void {
  screens.write({
    ...screens.read(),
    [key]: { ...screens.read()[key], ...changes },
  });
  window.localStorage.setItem(
    SCREENS_KEY,
    JSON.stringify(screens.read()),
  );
}

export function currentGlobal(): GlobalSettings {
  return global.read();
}

export function useGlobalSettings(): GlobalSettings {
  return useStore(global);
}

export function useSettledHistory(): HistoryMonths {
  return useStore(settledHistory);
}

export function useViewPreference(
  key: string,
  fallback: ViewPreference,
): [ViewPreference, (changes: Partial<ViewPreference>) => void] {
  const saved = useStore(screens)[key];
  return [
    {
      groupBy: (saved?.groupBy ?? fallback.groupBy) as GroupByField,
      orderBy: (saved?.orderBy ?? fallback.orderBy) as OrderByField,
      orderDirection: (saved?.orderDirection ??
        fallback.orderDirection) as OrderDirection,
    },
    (changes) => changeScreen(key, changes),
  ];
}

export function useFoldedGroups(
  key: string,
  foldedAtFirst: string[],
): [Set<string>, (groupKey: string) => void] {
  const held = useStore(folded)[key] ?? foldedAtFirst;

  return [
    new Set(held),
    (groupKey: string) => {
      const next = held.includes(groupKey)
        ? held.filter((each) => each !== groupKey)
        : [...held, groupKey];
      folded.write({ ...folded.read(), [key]: next });
      window.localStorage.setItem(
        FOLDED_KEY,
        JSON.stringify(folded.read()),
      );
    },
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
    return "All";
  }
  if (months < 12) {
    return `${months}m`;
  }
  return `${months / 12}y`;
}
