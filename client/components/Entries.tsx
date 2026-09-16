import { useState } from "react";

import { formatWhen } from "@shared/format.ts";
import { entryFrom, entryText, entryTitle, sectionTitleFrom, tagCounts } from "@shared/journal.ts";
import { stripMarkers, wordCount } from "@shared/markdown.ts";
import type { JournalEntry } from "@shared/model.ts";

import type { JournalName } from "../data/store.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { EditorScreen } from "./EditorScreen.tsx";
import { PlusGlyph } from "./Glyphs.tsx";
import { RoundButton } from "./RoundButton.tsx";
import { TextButton } from "./TextButton.tsx";

const headings: Record<JournalName, string> = { journal: "Journal", notebook: "Notebook" };

export function blankEntry({ tag }: { tag: string | null }): JournalEntry {
  const at = nowStamp();
  return { id: identifier(), at, sectionTitle: sectionTitleFrom(at), displayTitle: null, tags: tag ? [tag] : [], task: null, body: "" };
}

function Filters({ counts, total, active, onSelect }: { counts: { tag: string; count: number }[]; total: number; active: string | null; onSelect: (tag: string | null) => void }) {
  return (
    <div className="filters">
      <TextButton active={active === null} onSelect={() => onSelect(null)}>
        all <span className="filter-count">{total}</span>
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
  const tags = entry.tags.filter((tag) => tag !== filter);
  const words = wordCount(entry.body);
  return (
    <button className="entry" onClick={onOpen}>
      {entry.displayTitle && <div className="entry-title">{entryTitle(entry)}</div>}
      <div className="entry-head">
        <span>{formatWhen(entry.at)}</span>
        {tags.length > 0 && <span className="entry-tag">{tags.join(", ")}</span>}
        <span className="entry-words">
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
  const shown = entries.filter((entry) => filter === null || entry.tags.includes(filter)).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Filters counts={tagCounts(entries)} total={entries.length} active={filter} onSelect={setFilter} />
      <div className="list">
        {shown.map((entry) => (
          <EntryRow key={entry.id} entry={entry} filter={filter} onOpen={() => setEditing(entry)} />
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
          subheading={[formatWhen(editing.at), editing.tags.join(", ")].filter(Boolean).join(" · ")}
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
