import { Plus } from "./Glyphs.tsx";

export function TabBar({
  active,
  onToday,
  onJournal,
  onAdd,
}: {
  active: "today" | "journal";
  onToday: () => void;
  onJournal: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="tabs">
      <button className={active === "today" ? "tab active" : "tab"} onClick={onToday}>
        Today
      </button>
      <button className={active === "journal" ? "tab active" : "tab"} onClick={onJournal}>
        Journal
      </button>
      <button className="add-button" aria-label={active === "journal" ? "write" : "add task"} onClick={onAdd}>
        <span>
          <Plus />
        </span>
      </button>
    </div>
  );
}
