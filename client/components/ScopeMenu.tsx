import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../data/api.ts";
import { asTitle } from "../tasks/format.ts";
import { Label } from "./ui/Label.tsx";
import { Menu } from "./ui/Menu.tsx";
import { canonicalName } from "@shared/names.ts";

export function ScopeMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  function go(path: string): void {
    navigate(path);
    onClose();
  }

  return (
    <Menu anchor="title" onClose={onClose}>
      <MenuLink
        label="Today"
        here={location.pathname === "/today"}
        onGo={() => go("/today")}
      />
      <MenuLink
        label="To Do"
        here={location.pathname === "/"}
        onGo={() => go("/")}
      />
      <MenuLink
        label="Done"
        here={location.pathname === "/state/complete"}
        onGo={() => go("/state/complete")}
      />
      <MenuLink
        label="Archive"
        here={location.pathname === "/archived/true"}
        onGo={() => go("/archived/true")}
      />

      {lists.length > 0 && (
        <>
          <Label>Filters</Label>
          {lists.map((list) => (
            <MenuLink
              key={list}
              label={asTitle(list)}
              small
              here={
                canonicalName(
                  decodeURIComponent(location.pathname),
                ) === `/list/${list}`
              }
              onGo={() => go(`/list/${encodeURIComponent(list)}`)}
            />
          ))}
        </>
      )}
    </Menu>
  );
}

function MenuLink({
  label,
  here,
  small = false,
  onGo,
}: {
  label: string;
  here: boolean;
  small?: boolean;
  onGo: () => void;
}) {
  return (
    <button
      type="button"
      className="menu-link"
      data-small={small}
      onClick={onGo}
    >
      <span>{label}</span>
      {here && (
        <span className="here-dot" aria-label="You are here" />
      )}
    </button>
  );
}
