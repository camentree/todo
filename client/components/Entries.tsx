import { useState } from "react";

import { formatWhen } from "@shared/format.ts";
import { tagsInUse } from "@shared/journal.ts";
import { stripMarkers } from "@shared/markdown.ts";
import type { JournalEntry } from "@shared/model.ts";

import type { JournalName } from "../data/store.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { EditorScreen } from "./EditorScreen.tsx";
import { PlusGlyph } from "./Glyphs.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

const headings: Record<JournalName, string> = { journal: "Entry", notebook: "Note" };

export function splitTags(text: string): { tags: string[]; body: string } {
  const [first = "", ...rest] = text.split("\n");
  const words = first.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || !words.every((word) => /^#\S+$/.test(word))) return { tags: [], body: text };
  return { tags: words.map((word) => word.slice(1).toLowerCase()), body: rest.join("\n").replace(/^\n+/, "") };
}

export function withTagLine(entry: JournalEntry): string {
  return entry.tags.length ? entry.tags.map((tag) => "#" + tag).join(" ") + "\n\n" + entry.body : entry.body;
}

function Filters({ tags, active, onSelect }: { tags: string[]; active: string | null; onSelect: (tag: string | null) => void }) {
  return (
    <div className="filters">
      <TextButton active={active === null} onSelect={() => onSelect(null)}>
        all
      </TextButton>
      {tags.map((tag) => (
        <TextButton key={tag} active={active === tag} onSelect={() => onSelect(active === tag ? null : tag)}>
          {tag}
        </TextButton>
      ))}
    </div>
  );
}

function EntryRow({ entry, today, onOpen }: { entry: JournalEntry; today: string; onOpen: () => void }) {
  const meta = [entry.tags.join(", "), entry.task ?? ""].filter(Boolean).join(" · ");
  return (
    <button className="entry" onClick={onOpen}>
      <div className="entry-head">
        <span>{formatWhen({ at: entry.at, today })}</span>
        {meta && <span className="entry-tag">{meta}</span>}
      </div>
      <div className="entry-body">{entry.body.split("\n").filter((line) => line.trim()).map(stripMarkers).join("\n")}</div>
    </button>
  );
}

export function Entries({ name }: { name: JournalName }) {
  const store = useStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<JournalEntry | "new" | null>(null);
  const entries = store[name];
  const shown = entries.filter((entry) => filter === null || entry.tags.includes(filter)).sort((a, b) => b.at.localeCompare(a.at));

  const save = (text: string) => {
    const { tags, body } = splitTags(text);
    const previous = editing === "new" || editing === null ? null : editing;
    store.putEntry({
      name,
      entry: {
        id: previous?.id ?? identifier(),
        at: previous?.at ?? nowStamp().slice(0, 16),
        tags: tags.length || previous === null ? (tags.length ? tags : filter ? [filter] : []) : previous.tags,
        task: previous?.task ?? null,
        body: body.trim(),
      },
    });
    setEditing(null);
  };

  return (
    <>
      <Filters tags={tagsInUse(entries)} active={filter} onSelect={setFilter} />
      <div className="list">
        {shown.map((entry) => (
          <EntryRow key={entry.id} entry={entry} today={store.today} onOpen={() => setEditing(entry)} />
        ))}
      </div>
      <div className="floating">
        <RoundButton label="add" onSelect={() => setEditing("new")}>
          <PlusGlyph />
        </RoundButton>
      </div>
      {editing && (
        <EditorScreen
          heading={headings[name]}
          subheading={editing === "new" ? (filter ? filter : "") : [formatWhen({ at: editing.at, today: store.today }), editing.tags.join(", "), editing.task ?? ""].filter(Boolean).join(" · ")}
          initial={editing === "new" ? "" : withTagLine(editing)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
