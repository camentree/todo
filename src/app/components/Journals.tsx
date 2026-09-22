import { useState } from "react";

import { formatWhen } from "@shared/format.ts";
import { Confirm } from "@shared/components/Confirm.tsx";
import { PlusGlyph } from "@shared/ui/Glyphs.tsx";
import { MarkdownPreview } from "@shared/ui/MarkdownPreview.tsx";
import { RoundButton } from "@shared/ui/RoundButton.tsx";
import { Swipeable } from "@shared/ui/Swipeable.tsx";
import { TextButton } from "@shared/ui/TextButton.tsx";

import type { JournalName } from "../data/store.tsx";
import { nowStamp, useStore } from "../data/store.tsx";
import type { JournalEntry } from "../models/journal.ts";
import { entryFrom, entryTags, entryText, readableTitle, tagCounts, wordCount } from "../models/journal.ts";
import { useRoute } from "../route.ts";
import { JournalEditor } from "../screens/JournalEditor.tsx";

const headings: Record<JournalName, string> = { journal: "Journal", notebook: "Notebook" };

export function blankEntry({ tag }: { tag: string | null }): JournalEntry {
  const at = nowStamp();
  return { sectionTitle: at, at, body: "", metadata: tag ? { tags: [tag] } : {} };
}

function Filters({ counts, active, total, onSelect }: { counts: { tag: string; count: number }[]; active: string | null; total: number; onSelect: (tag: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0 pt-[0.3rem] pb-[0.2rem]">
      <TextButton className={"min-h-touch py-2 text-meta " + (active === null ? "text-text" : "text-faint hover:text-dim")} onSelect={() => onSelect(null)}>
        all ({total})
      </TextButton>
      {counts.map(({ tag, count }) => (
        <TextButton key={tag} className={"min-h-touch py-2 text-meta " + (active === tag ? "text-text" : "text-faint hover:text-dim")} onSelect={() => onSelect(active === tag ? null : tag)}>
          {tag} ({count})
        </TextButton>
      ))}
    </div>
  );
}

function EntryRow({ entry, filter, onOpen, onDelete }: { entry: JournalEntry; filter: string | null; onOpen: () => void; onDelete: () => void }) {
  const tags = entryTags(entry).filter((tag) => tag !== filter);
  const words = wordCount(entry.body);
  return (
    <Swipeable className="mt-[var(--entry-gap)] first:mt-0 wide:-mx-[0.65rem]" right={null} left={{ word: "delete", onSwipe: onDelete }}>
      <button className="entry flex w-full flex-col rounded-lg px-1 py-[0.7rem] transition-[background] duration-[450ms] ease-[ease] hover:bg-raised wide:px-[0.9rem]" onClick={onOpen}>
        <div className="text-title leading-[1.35] text-text">{readableTitle(entry)}</div>
        <div className="mt-[0.15rem] flex gap-[0.4rem] text-meta text-text [&>span+span]:before:pr-[0.4rem] [&>span+span]:before:text-faint [&>span+span]:before:content-['·']">
          <span>{formatWhen(entry.at)}</span>
          {tags.length > 0 && <span>{tags.join(", ")}</span>}
          <span className="text-dim">
            {words} {words === 1 ? "word" : "words"}
          </span>
        </div>
        <div className="mt-[0.45rem] line-clamp-3 text-body leading-[1.45] text-dim [&_code]:font-mono [&_code]:text-[0.9em]">
          <MarkdownPreview text={entry.body} />
        </div>
      </button>
    </Swipeable>
  );
}

export function Journals({ name }: { name: JournalName }) {
  const store = useStore();
  const { route, go, close } = useRoute();
  const [filter, setFilter] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const entries = store[name];
  const shown = entries.filter((entry) => filter === null || entryTags(entry).includes(filter)).sort((a, b) => b.at.localeCompare(a.at));
  const editing = route.id === null ? null : (entries.find((entry) => entry.at === route.id) ?? (drafted?.at === route.id ? drafted : null));

  const write = (entry: JournalEntry) => {
    setDrafted(entry);
    go({ tab: route.tab, id: entry.at });
  };

  return (
    <>
      <Filters counts={tagCounts(entries)} active={filter} total={entries.length} onSelect={setFilter} />
      <div className="list mt-[0.6rem] flex flex-col">
        {shown.map((entry) => (
          <EntryRow key={entry.at} entry={entry} filter={filter} onOpen={() => go({ tab: route.tab, id: entry.at })} onDelete={() => setDeleting(entry)} />
        ))}
      </div>
      {deleting && (
        <Confirm
          question={`delete "${readableTitle(deleting)}"?`}
          choices={[
            {
              label: "delete",
              onChoose: () => {
                store.deleteEntry({ name, at: deleting.at });
                setDeleting(null);
              },
            },
          ]}
          onCancel={() => setDeleting(null)}
        />
      )}
      <div className="fixed right-[max(var(--gutter),calc(50%-var(--column)/2+var(--gutter)))] bottom-bottom z-[5] flex items-center gap-[0.6rem]">
        <RoundButton label="add" onSelect={() => write(blankEntry({ tag: filter }))}>
          <PlusGlyph />
        </RoundButton>
      </div>
      {editing && (
        <JournalEditor
          heading={headings[name]}
          subheading={formatWhen(editing.at)}
          initial={entryText(editing)}
          onCancel={close}
          onSave={(text) => {
            store.putEntry({ name, entry: entryFrom({ entry: editing, text }) });
            close();
          }}
        />
      )}
    </>
  );
}
