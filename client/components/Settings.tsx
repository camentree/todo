import {
  changeGlobal,
  historyLabel,
  HISTORY_STOPS,
  useGlobalSettings,
} from "../data/settings.ts";
import type { HistoryMonths, Theme } from "../data/settings.ts";
import { useTheme } from "../data/theme.ts";
import { Field } from "./ui/Field.tsx";
import { Menu } from "./ui/Menu.tsx";
import { Select } from "./ui/Select.tsx";
import { Toggle } from "./ui/Toggle.tsx";
import type {
  GroupByField,
  OrderByField,
  ViewPreference,
} from "@shared/types.ts";

const GROUP_OPTIONS: { field: GroupByField; label: string }[] = [
  { field: "none", label: "Nothing" },
  { field: "list", label: "List" },
  { field: "stage", label: "Stage" },
  { field: "tag", label: "Tag" },
  { field: "due_date", label: "Due" },
  { field: "who", label: "Who" },
];

const SORT_OPTIONS: {
  field: OrderByField;
  label: string;
  directional: boolean;
}[] = [
  { field: "manual", label: "Manual", directional: false },
  { field: "relevance", label: "Best match", directional: false },
  { field: "due_date", label: "Due date", directional: true },
  { field: "title", label: "Title", directional: true },
  { field: "created_at", label: "Added", directional: true },
  { field: "finished_at", label: "Finished", directional: true },
];

function historyAt(index: number): HistoryMonths {
  const chosen = HISTORY_STOPS[index];
  return chosen === undefined ? 24 : chosen;
}

export function Settings({
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
  const [theme, onThemeChange] = useTheme();
  const { historyMonths } = useGlobalSettings();

  const offered = SORT_OPTIONS.filter((option) => {
    if (option.field === view.orderBy) {
      return true;
    }
    if (option.field === "relevance") {
      return searching;
    }
    if (option.field === "finished_at") {
      return finished;
    }
    return true;
  });

  const ordering = SORT_OPTIONS.find(
    (option) => option.field === view.orderBy,
  );

  return (
    <Menu anchor="right" onClose={onClose}>
      <div className="menu-form">
        <Field label="Group by" row>
          <Select
            value={view.groupBy}
            options={GROUP_OPTIONS.map((option) => ({
              value: option.field,
              label: option.label,
            }))}
            onChange={(groupBy) => onViewChange({ groupBy: groupBy })}
          />
        </Field>

        <Field label="Order by" row>
          <Select
            value={view.orderBy}
            options={offered.map((option) => ({
              value: option.field,
              label: option.label,
            }))}
            onChange={(orderBy) => onViewChange({ orderBy: orderBy })}
          />
        </Field>

        <div
          className="collapsible menu-reveal"
          data-open={ordering?.directional ?? false}
        >
          <div>
            <MenuSwitch
              label="Ascending"
              on={view.orderDirection === "asc"}
              onChange={(on) =>
                onViewChange({ orderDirection: on ? "asc" : "desc" })
              }
            />
          </div>
        </div>

        <div
          className="collapsible menu-reveal"
          data-wide-only={true}
          data-open={view.groupBy !== "none"}
        >
          <div>
            <MenuSwitch
              label="Columns"
              on={view.layout === "columns"}
              onChange={(on) =>
                onViewChange({ layout: on ? "columns" : "stacked" })
              }
            />
          </div>
        </div>

        <Field
          label={
            <>
              History{" "}
              <span className="menu-note">
                {historyLabel(historyMonths)}
              </span>
            </>
          }
        >
          <input
            type="range"
            min={0}
            max={HISTORY_STOPS.length - 1}
            step={1}
            value={HISTORY_STOPS.indexOf(historyMonths)}
            onChange={(event) =>
              changeGlobal({
                historyMonths: historyAt(Number(event.target.value)),
              })
            }
          />
        </Field>

        <MenuSwitch
          label="Custom appearance"
          on={theme !== "system"}
          onChange={(on) =>
            onThemeChange(on ? preferredTheme() : "system")
          }
        />

        {theme !== "system" && (
          <MenuSwitch
            label="Dark mode"
            on={theme === "dark"}
            onChange={(on) => onThemeChange(on ? "dark" : "light")}
          />
        )}
      </div>
    </Menu>
  );
}

function preferredTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function MenuSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Field label={label} row>
      <Toggle label={label} on={on} onChange={onChange} />
    </Field>
  );
}
