import { useLocation, useNavigate } from "react-router-dom";

import { Choice } from "./ui/Choice.tsx";
import { Label } from "./ui/Label.tsx";
import { Menu } from "./ui/Menu.tsx";
import type {
  GroupByField,
  OrderByField,
  ViewPreference,
} from "@shared/types.ts";

const GROUP_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: "none", label: "Nothing" },
  { value: "list", label: "List" },
  { value: "stage", label: "Stage" },
  { value: "tag", label: "Tag" },
  { value: "due_date", label: "Due" },
  { value: "who", label: "Who" },
];

const ORDER_OPTIONS: {
  value: OrderByField;
  label: string;
  always: boolean;
}[] = [
  { value: "manual", label: "Manual", always: true },
  { value: "relevance", label: "Best match", always: false },
  { value: "due_date", label: "Due date", always: true },
  { value: "title", label: "Title", always: true },
  { value: "tag", label: "Tag", always: true },
  { value: "created_at", label: "Added", always: true },
  { value: "finished_at", label: "Finished", always: false },
];

export function ScreenMenu({
  view,
  onViewChange,
  searching,
  finished,
  onClose,
}: {
  view: ViewPreference;
  onViewChange: (changes: Partial<ViewPreference>) => void;
  searching: boolean;
  finished: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const offered = ORDER_OPTIONS.filter(
    (option) =>
      option.always ||
      option.value === view.orderBy ||
      (option.value === "relevance" && searching) ||
      (option.value === "finished_at" && finished),
  );

  function go(path: string): void {
    navigate(path);
    onClose();
  }

  return (
    <Menu anchor="title" onClose={onClose}>
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
      <MenuLink
        label="Settings"
        here={location.pathname === "/settings"}
        onGo={() => go("/settings")}
      />

      <div className="menu-rule" />

      <div className="menu-columns">
        <div>
          <Label>Group by</Label>
          <Choice
            label="Group by"
            value={view.groupBy}
            options={GROUP_OPTIONS}
            onChange={(groupBy) => onViewChange({ groupBy: groupBy })}
          />
        </div>
        <div>
          <Label>Order by</Label>
          <Choice
            label="Order by"
            value={view.orderBy}
            options={offered}
            onChange={(orderBy) => onViewChange({ orderBy: orderBy })}
          />
        </div>
      </div>
    </Menu>
  );
}

function MenuLink({
  label,
  here,
  onGo,
}: {
  label: string;
  here: boolean;
  onGo: () => void;
}) {
  return (
    <button type="button" className="menu-link" onClick={onGo}>
      <span>{label}</span>
      {here && (
        <span className="here-dot" aria-label="You are here" />
      )}
    </button>
  );
}
