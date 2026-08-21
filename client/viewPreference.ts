import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";

import type { Scope } from "./screens/Tasks.tsx";
import type {
  BreakUpField,
  Density,
  Layout,
  SortDirection,
  SortField,
  ViewPreference,
} from "@shared/types.ts";

const DEFAULTS: Record<Scope, ViewPreference> = {
  today: {
    breakUpBy: "none",
    sortBy: "due_date",
    sortDirection: "desc",
    density: "airy",
    layout: "stacked",
  },
  todo: {
    breakUpBy: "list",
    sortBy: "manual",
    sortDirection: "asc",
    density: "compact",
    layout: "stacked",
  },
  list: {
    breakUpBy: "none",
    sortBy: "manual",
    sortDirection: "asc",
    density: "compact",
    layout: "stacked",
  },
  done: {
    breakUpBy: "none",
    sortBy: "resolved_at",
    sortDirection: "desc",
    density: "compact",
    layout: "stacked",
  },
  archive: {
    breakUpBy: "none",
    sortBy: "manual",
    sortDirection: "asc",
    density: "compact",
    layout: "stacked",
  },
};

export function useViewPreference(
  scope: Scope,
): [ViewPreference, (changes: Partial<ViewPreference>) => void] {
  const { pathname } = useLocation();
  const storageKey = `view:${pathname}`;

  const [preference, setPreference] = useState<ViewPreference>(() =>
    read({ storageKey: storageKey, scope: scope }),
  );
  const [shown, setShown] = useState<string>(pathname);

  if (shown !== pathname) {
    setShown(pathname);
    setPreference(read({ storageKey: storageKey, scope: scope }));
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

function read({
  storageKey,
  scope,
}: {
  storageKey: string;
  scope: Scope;
}): ViewPreference {
  const fallback = DEFAULTS[scope];
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
