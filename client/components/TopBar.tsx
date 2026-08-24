import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";

import {
  BellIcon,
  Chevron,
  SearchIcon,
  SlidersIcon,
} from "./icons.tsx";
import { ChangesMenu, ScopeMenu, ViewMenu } from "./menus.tsx";
import { api } from "../api.ts";
import { useFailures } from "../failures.ts";
import type { ViewPreference } from "@shared/types.ts";

type OpenMenu = "none" | "scope" | "view" | "bell";

export function TopBar({
  title,
  view,
  onViewChange,
  searching,
  onOpenSearch,
}: {
  title: string;
  view?: ViewPreference;
  onViewChange?: (changes: Partial<ViewPreference>) => void;
  searching: boolean;
  onOpenSearch?: () => void;
}) {
  const [menu, setMenu] = useState<OpenMenu>("none");
  const failed = useFailures();

  const { data: unseen = [] } = useQuery({
    queryKey: ["events", "unseen"],
    queryFn: api.unseenEvents,
    refetchInterval: 300_000,
  });

  useEffect(() => {
    if (menu === "none") {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setMenu("none");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu]);

  return (
    <>
      <div className="topbar">
        <button
          type="button"
          className="topbar-filter"
          onClick={() => setMenu(menu === "scope" ? "none" : "scope")}
        >
          <span className="topbar-name">{title}</span>
          <Chevron open={menu === "scope"} />
        </button>

        <div className="topbar-date">
          {format(new Date(), "d MMM")}
        </div>

        <div className="topbar-actions">
          {onOpenSearch && !searching && (
            <button
              type="button"
              className="icon-button"
              aria-label="Search"
              onClick={onOpenSearch}
            >
              <SearchIcon />
            </button>
          )}

          {view && onViewChange && (
            <button
              type="button"
              className="icon-button"
              aria-label="Arrange"
              data-active={menu === "view"}
              onClick={() =>
                setMenu(menu === "view" ? "none" : "view")
              }
            >
              <SlidersIcon />
            </button>
          )}

          <button
            type="button"
            className="icon-button"
            aria-label="Notifications"
            data-active={menu === "bell"}
            onClick={() => setMenu(menu === "bell" ? "none" : "bell")}
          >
            <BellIcon />
            {(unseen.length > 0 || failed.length > 0) && (
              <span className="dot" data-failed={failed.length > 0} />
            )}
          </button>
        </div>

        {menu === "scope" && (
          <ScopeMenu onClose={() => setMenu("none")} />
        )}
        {menu === "view" && view && onViewChange && (
          <ViewMenu view={view} onViewChange={onViewChange} />
        )}
        {menu === "bell" && (
          <ChangesMenu onClose={() => setMenu("none")} />
        )}
      </div>

      {menu !== "none" && (
        <div
          className="scrim quiet"
          onClick={() => setMenu("none")}
        />
      )}
    </>
  );
}
