import { longDate } from "@shared/format.ts";

import { TextButton } from "./TextButton.tsx";

export type Tab = "tasks" | "journal" | "notebook";

export function TopBar({ tab, today, onTab }: { tab: Tab; today: string; onTab: (tab: Tab) => void }) {
  return (
    <div className="topbar">
      <div className="tabs">
        <TextButton active={tab === "tasks"} onSelect={() => onTab("tasks")}>
          Tasks
        </TextButton>
        <TextButton active={tab === "journal"} onSelect={() => onTab("journal")}>
          Journal
        </TextButton>
        <TextButton active={tab === "notebook"} onSelect={() => onTab("notebook")}>
          Notebook
        </TextButton>
      </div>
      <div className="dateline">{longDate(today)}</div>
    </div>
  );
}
