import { useState } from "react";

import { formatEntryWhen } from "@shared/format.ts";
import { entryFrom, entryTags, entryText, entryTitle, tagCounts } from "@shared/journal.ts";
import { stripMarkers, wordCount } from "@shared/markdown.ts";
import type { JournalEntry } from "@shared/model.ts";

import type { JournalName } from "../data/store.tsx";
import { nowStamp, useStore } from "../data/store.tsx";
import { EditorScreen } from "./EditorScreen.tsx";
import { PlusGlyph } from "./Glyphs.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

const headings: Record<JournalName, string> = { journal: "Journal", notebook: "Notebook" };

export function blankEntry({ tag }: { tag: string | null }): JournalEntry {
  const at = nowStamp();
  return { sectionTitle: at, at, body: "", metadata: tag ? { tag } : {} };
}

function Filters({ counts, active, onSelect }: { counts: { tag: string; count: number }[]; active: string | null; onSelect: (tag: string | null) => void }) {
  return (
    <div className="filters">
      <TextButton active={active === null} onSelect={() => onSelect(null)}>
        all
      </TextButton>
      {counts.map(({ tag, count }) => (
        <TextButton key={tag} active={active === tag} onSelect={() => onSelect(active === tag ? null : tag)}>
          {tag} <span className="filter-count">{count}</span>
        </TextButton>
      ))}
    </div>
  );
}

function EntryRow({ entry, filter, onOpen }: { entry: JournalEntry; filter: string | null; onOpen: () => void }) {
  const tags = entryTags(entry).filter((tag) => tag !== filter);
  const words = wordCount(entry.body);
  return (
    <button className="entry" onClick={onOpen}>
      <div className="entry-title">{entryTitle(entry)}</div>
      <div className="entry-head">
        <span>{formatEntryWhen(entry.at)}</span>
        {tags.length > 0 && <span>{tags.join(", ")}</span>}
        <span>
          {words} {words === 1 ? "word" : "words"}
        </span>
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
  const shown = entries.filter((entry) => filter === null || entryTags(entry).includes(filter)).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Filters counts={tagCounts(entries)} active={filter} onSelect={setFilter} />
      <div className="list">
        {shown.map((entry) => (
          <EntryRow key={entry.at} entry={entry} filter={filter} onOpen={() => setEditing(entry)} />
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
          subheading={[formatEntryWhen(editing.at), entryTags(editing).join(", ")].filter(Boolean).join(" · ")}
          initial={entryText(editing)}
          onCancel={() => setEditing(null)}
          onDelete={() => {
            store.deleteEntry({ name, at: editing.at });
            setEditing(null);
          }}
          onSave={(text) => {
            store.putEntry({ name, entry: entryFrom({ entry: editing, text }) });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
