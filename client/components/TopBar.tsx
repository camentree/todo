import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  screen,
  screenName,
  view,
  onViewChange,
  searchText,
  onSearchChange,
  finished,
}: {
  screen: string;
  screenName: string | null;
  view: ViewPreference;
  onViewChange: (changes: Partial<ViewPreference>) => void;
  searchText: string | null;
  onSearchChange: (text: string | null) => void;
  finished: boolean;
}) {
  const [menu, setMenu] = useState<OpenMenu>("none");
  const navigate = useNavigate();
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
        {searchText === null && screenName === null && (
          <div className="switcher">
            <Choice
              label="Screen"
              value={screen}
              options={SCREENS}
              onChange={navigate}
            />
          </div>
        )}

        {searchText === null && screenName !== null && (
          <div className="bar-pill">
            <span className="bar-pill-name">{screenName}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Leave this screen"
              onClick={() => navigate(-1)}
            >
              <Sprite name="cross" />
            </button>
          </div>
        )}

        {searchText !== null && (
          <div className="bar-pill">
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
                autoFocus: searchText === "",
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

        {searchText === null && screenName === null && (
          <span className="topbar-spacer" />
        )}

        {searchText === null && (
          <MenuButton
            icon="search"
            label="Search"
            onToggle={() => onSearchChange("")}
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
