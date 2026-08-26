import { useQuery } from "@tanstack/react-query";
import { MenuButton } from "./ui/MenuButton.tsx";
import { Sprite } from "./ui/Sprite.tsx";
import { format } from "date-fns";
import { useState } from "react";

import { Changes } from "./Changes.tsx";
import { ScopeMenu } from "./ScopeMenu.tsx";
import { Settings } from "./Settings.tsx";
import { api } from "../data/api.ts";
import { useFailures } from "../data/failures.ts";
import type { ViewPreference } from "@shared/types.ts";

type OpenMenu = "none" | "scope" | "view" | "bell";

export function TopBar({
  title,
  view,
  onViewChange,
  searching,
  finished,
  onOpenSearch,
}: {
  title: string;
  view?: ViewPreference;
  onViewChange?: (changes: Partial<ViewPreference>) => void;
  searching: boolean;
  finished: boolean;
  onOpenSearch?: () => void;
}) {
  const [menu, setMenu] = useState<OpenMenu>("none");
  const failed = useFailures();

  const { data: unseen = [] } = useQuery({
    queryKey: ["events", "unseen"],
    queryFn: api.unseenEvents,
    refetchInterval: 300_000,
  });

  return (
    <>
      <div className="topbar">
        <button
          type="button"
          className="topbar-filter"
          onClick={() => setMenu(menu === "scope" ? "none" : "scope")}
        >
          <span className="topbar-name">{title}</span>
          <Sprite name="chevron" open={menu === "scope"} />
        </button>

        <div className="topbar-date">
          {format(new Date(), "d MMM")}
        </div>

        <div className="topbar-actions">
          {onOpenSearch && !searching && (
            <MenuButton
              icon="search"
              label="Search"
              onToggle={onOpenSearch}
            />
          )}

          {view && onViewChange && (
            <MenuButton
              icon="sliders"
              label="Arrange"
              active={menu === "view"}
              onToggle={() =>
                setMenu(menu === "view" ? "none" : "view")
              }
            />
          )}

          <MenuButton
            icon="bell"
            label="Notifications"
            active={menu === "bell"}
            badge={
              (unseen.length > 0 || failed.length > 0) && (
                <span className="dot" data-failed={failed.length > 0} />
              )
            }
            onToggle={() =>
              setMenu(menu === "bell" ? "none" : "bell")
            }
          />
        </div>

        {menu === "scope" && (
          <ScopeMenu onClose={() => setMenu("none")} />
        )}
        {menu === "view" && view && onViewChange && (
          <Settings
            view={view}
            onViewChange={onViewChange}
            searching={searching}
            finished={finished}
            onClose={() => setMenu("none")}
          />
        )}
        {menu === "bell" && (
          <Changes onClose={() => setMenu("none")} />
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
