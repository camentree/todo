import { useCallback, useState } from "react";

import type { Scope } from "./screens/Tasks.tsx";
import type {
  BreakUpField,
  Density,
  Layout,
  SortDirection,
  SortField,
  ViewPreference,
} from "@shared/types.ts";

const FLAT_MANUAL: ViewPreference = {
  breakUpBy: "none",
  sortBy: "manual",
  sortDirection: "asc",
  density: "compact",
  layout: "stacked",
};

const BY_LIST: ViewPreference = {
  breakUpBy: "list",
  sortBy: "manual",
  sortDirection: "asc",
  density: "compact",
  layout: "stacked",
};

const BY_DUE: ViewPreference = {
  breakUpBy: "none",
  sortBy: "due_date",
  sortDirection: "desc",
  density: "airy",
  layout: "stacked",
};

const BY_FINISHED: ViewPreference = {
  breakUpBy: "none",
  sortBy: "resolved_at",
  sortDirection: "desc",
  density: "compact",
  layout: "stacked",
};

export function defaultView(scope: Scope): ViewPreference {
  if (scope.field === "due_date" && scope.value === "today")
    return BY_DUE;
  if (scope.field === "state" && scope.value === "complete")
    return BY_FINISHED;
  if (scope.field === null) return BY_LIST;
  return FLAT_MANUAL;
}

export function useViewPreference(
  key: string,
  fallback: ViewPreference,
): [ViewPreference, (changes: Partial<ViewPreference>) => void] {
  const storageKey = `view:${key}`;

  const [preference, setPreference] = useState<ViewPreference>(() =>
    read(storageKey, fallback),
  );
  const [shown, setShown] = useState<string>(storageKey);

  if (shown !== storageKey) {
    setShown(storageKey);
    setPreference(read(storageKey, fallback));
  }

  const change = useCallback(
    (changes: Partial<ViewPreference>) => {
      setPreference((current) => {
        const next = { ...current, ...changes };
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  return [preference, change];
}

function read(
  storageKey: string,
  fallback: ViewPreference,
): ViewPreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored) as Partial<ViewPreference>;
    return {
      breakUpBy: (parsed.breakUpBy ??
        fallback.breakUpBy) as BreakUpField,
      sortBy: (parsed.sortBy ?? fallback.sortBy) as SortField,
      sortDirection: (parsed.sortDirection ??
        fallback.sortDirection) as SortDirection,
      density: (parsed.density ?? fallback.density) as Density,
      layout: (parsed.layout ?? fallback.layout) as Layout,
    };
  } catch {
    return fallback;
  }
}
