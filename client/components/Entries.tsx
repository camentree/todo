import { useState } from "react";

import { formatWhen } from "@shared/format.ts";
import { entryFrom, entryText, tagsInUse } from "@shared/journal.ts";
import { stripMarkers } from "@shared/markdown.ts";
import type { JournalEntry } from "@shared/model.ts";

import type { JournalName } from "../data/store.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { EditorScreen } from "./EditorScreen.tsx";
import { PlusGlyph } from "./Glyphs.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

const headings: Record<JournalName, string> = { journal: "Journal", notebook: "Notebook" };

export function blankEntry({ tag }: { tag: string | null }): JournalEntry {
  const at = nowStamp().slice(0, 16);
  return { id: identifier(), at, title: at.replace("T", " - "), tags: tag ? [tag] : [], task: null, body: "" };
}

function when({ entry, today }: { entry: JournalEntry; today: string }): string {
  return formatWhen({ at: entry.at, today });
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
        <span>{when({ entry, today })}</span>
        {meta && <span className="entry-tag">{meta}</span>}
      </div>
      <div className="entry-body">
        {entry.body
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("```"))
          .map((line, index) => (
            <div key={index}>{stripMarkers(line)}</div>
          ))}
      </div>
    </button>
  );
}

export function Entries({ name }: { name: JournalName }) {
  const store = useStore();
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const entries = store[name];
  const shown = entries.filter((entry) => filter === null || entry.tags.includes(filter)).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Filters tags={tagsInUse(entries)} active={filter} onSelect={setFilter} />
      <div className="list">
        {shown.map((entry) => (
          <EntryRow key={entry.id} entry={entry} today={store.today} onOpen={() => setEditing(entry)} />
        ))}
      </div>
      <div className="floating">
        <RoundButton label="add" onSelect={() => setEditing(blankEntry({ tag: filter }))}>
          <PlusGlyph />
        </RoundButton>
      </div>
      {editing && (
        <EditorScreen
          heading={headings[name]}
          subheading={[when({ entry: editing, today: store.today }), editing.tags.join(", "), editing.task ?? ""].filter(Boolean).join(" · ")}
          markdown
          initial={entryText(editing)}
          onCancel={() => setEditing(null)}
          onSave={(text) => {
            store.putEntry({ name, entry: entryFrom({ entry: editing, text }) });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
