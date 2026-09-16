import { longDate } from "@shared/format.ts";

import { TextButton } from "./TextButton.tsx";

export type Tab = "today" | "journal" | "notes";

export function TopBar({ tab, today, onTab }: { tab: Tab; today: string; onTab: (tab: Tab) => void }) {
  return (
    <div className="topbar">
      <div className="tabs">
        <TextButton active={tab === "today"} onSelect={() => onTab("today")}>
          Today
        </TextButton>
        <TextButton active={tab === "journal"} onSelect={() => onTab("journal")}>
          Journal
        </TextButton>
        <TextButton active={tab === "notes"} onSelect={() => onTab("notes")}>
          Notes
        </TextButton>
      </div>
      {tab === "today" && <div className="dateline">{longDate(today)}</div>}
    </div>
  );
}
