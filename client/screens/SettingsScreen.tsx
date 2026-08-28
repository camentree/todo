import { useNavigate } from "react-router-dom";

import { Choice } from "../components/ui/Choice.tsx";
import { Label } from "../components/ui/Label.tsx";
import {
  changeGlobal,
  historyLabel,
  HISTORY_STOPS,
  useGlobalSettings,
} from "../data/settings.ts";
import type { Theme, WeekRuns } from "../data/settings.ts";
import { useTheme } from "../data/theme.ts";

const LOOKS: { value: Theme; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const WEEKS: { value: WeekRuns; label: string }[] = [
  { value: "calendar", label: "Monday to Sunday" },
  { value: "rolling", label: "Next seven days" },
];

export function SettingsScreen() {
  const navigate = useNavigate();
  const [theme, onThemeChange] = useTheme();
  const { historyMonths, weekRuns } = useGlobalSettings();

  return (
    <>
      <div className="topbar">
        <button
          type="button"
          className="topbar-back"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          ‹
        </button>
        <h1 className="topbar-heading">Settings</h1>
      </div>

      <div className="settings">
        <section>
          <Label>How far back</Label>
          <Choice
            label="How far back"
            value={historyLabel(historyMonths)}
            options={HISTORY_STOPS.map((months) => ({
              value: historyLabel(months),
              label: historyLabel(months),
            }))}
            onChange={(chosen) =>
              changeGlobal({
                historyMonths:
                  HISTORY_STOPS.find(
                    (months) => historyLabel(months) === chosen,
                  ) ?? null,
              })
            }
          />
        </section>

        <section>
          <Label>How it looks</Label>
          <div className="looks">
            {LOOKS.map((look) => (
              <button
                type="button"
                key={look.value}
                className="look"
                data-on={theme === look.value}
                onClick={() => onThemeChange(look.value)}
              >
                <span className="look-art" data-look={look.value}>
                  <i />
                  <i />
                </span>
                <span className="look-name">{look.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label>A week runs</Label>
          <Choice
            label="A week runs"
            value={weekRuns}
            options={WEEKS}
            onChange={(chosen) => changeGlobal({ weekRuns: chosen })}
          />
        </section>
      </div>
    </>
  );
}
