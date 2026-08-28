import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Changes } from "./Changes.tsx";
import { ScreenMenu } from "./ScreenMenu.tsx";
import { Title } from "./Title.tsx";
import { Choice } from "./ui/Choice.tsx";
import { MenuButton } from "./ui/MenuButton.tsx";
import { Sprite } from "./ui/Sprite.tsx";
import { api } from "../data/api.ts";
import { useFailures } from "../data/failures.ts";
import type { ViewPreference } from "@shared/types.ts";

type OpenMenu = "none" | "screen" | "bell";

const SCREENS = [
  { value: "/today", label: "Today" },
  { value: "/week", label: "Week" },
  { value: "/", label: "To Do" },
];

export function TopBar({
  view,
  onViewChange,
  searchText,
  onSearchChange,
  finished,
}: {
  view: ViewPreference;
  onViewChange: (changes: Partial<ViewPreference>) => void;
  searchText: string | null;
  onSearchChange: (text: string | null) => void;
  finished: boolean;
}) {
  const [menu, setMenu] = useState<OpenMenu>("none");
  const navigate = useNavigate();
  const location = useLocation();
  const failed = useFailures();
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: changes = [] } = useQuery({
    queryKey: ["events", "recent"],
    queryFn: api.recentEvents,
    refetchInterval: 300_000,
  });
  const unseen = changes.filter((change) => change.seenAt === null);

  return (
    <>
      <div className="topbar">
        {searchText === null ? (
          <div className="switcher">
            <Choice
              label="Screen"
              value={location.pathname}
              options={SCREENS}
              onChange={navigate}
            />
          </div>
        ) : (
          <div className="searching">
            <Sprite name="search" />
            <Title
              value={searchText}
              onChange={onSearchChange}
              inputRef={searchRef}
              onDone={() => searchRef.current?.blur()}
              onCancel={(event) => {
                event.stopPropagation();
                searchRef.current?.blur();
              }}
              input={{
                placeholder: "Search",
                "aria-label": "Search",
                enterKeyHint: "search",
                autoComplete: "off",
                autoCapitalize: "none",
                autoCorrect: "off",
                spellCheck: false,
                autoFocus: true,
                "data-search-field": true,
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Close search"
              onClick={() => onSearchChange(null)}
            >
              <Sprite name="cross" />
            </button>
          </div>
        )}

        <button
          type="button"
          className="topbar-caret"
          aria-label="Screens and arranging"
          onClick={() =>
            setMenu(menu === "screen" ? "none" : "screen")
          }
        >
          <Sprite name="chevron" open={menu === "screen"} />
        </button>

        {searchText === null && (
          <>
            <span className="topbar-spacer" />
            <MenuButton
              icon="search"
              label="Search"
              onToggle={() => onSearchChange("")}
            />
          </>
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
          onToggle={() => setMenu(menu === "bell" ? "none" : "bell")}
        />

        {menu === "screen" && (
          <ScreenMenu
            view={view}
            onViewChange={onViewChange}
            searching={searchText !== null}
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
