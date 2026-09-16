import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { definitionFromParsed, dueToday, taskFromParsed } from "@shared/composer.ts";
import { capitalise, formatDuration } from "@shared/format.ts";
import { everyLabel, parseTask, serializeTask } from "@shared/grammar.ts";
import type { Comment, Definition, Task } from "@shared/model.ts";
import { byPosition, grouped, isBacklog, isOnToday, isThisWeek } from "@shared/tasks.ts";

import { Confirm } from "../components/Confirm.tsx";
import type { Choice } from "../components/Confirm.tsx";
import { EditorScreen } from "../components/EditorScreen.tsx";
import { CrossGlyph, PlayGlyph, PlusGlyph } from "../components/Glyphs.tsx";
import { Group } from "../components/Group.tsx";
import { Overlay } from "../components/Overlay.tsx";
import { RoundButton } from "../components/RoundButton.tsx";
import { Swipeable } from "../components/Swipeable.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { TextButton } from "../components/TextButton.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { longPress } from "../interaction/longPress.ts";
import { Runner } from "./Runner.tsx";

interface Draft {
  text: string;
  block: boolean;
  editing: Task | null;
}

interface Asking {
  question: string;
  choices: Choice[];
}

function Composer({ draft, onChange, onClose, onDelete }: { draft: Draft; onChange: (draft: Draft) => void; onClose: () => void; onDelete: () => void }) {
  const store = useStore();
  const field = useRef<HTMLTextAreaElement>(null);
  const parsed = parseTask({ text: draft.text, today: store.today });
  const definition = draft.editing?.definitionId ? (store.definitions.find((each) => each.id === draft.editing?.definitionId) ?? null) : null;

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "0";
    element.style.height = element.scrollHeight + "px";
  }, [draft.text, draft.block]);

  const commit = () => {
    if (!parsed) return;
    const now = nowStamp();
    const existing = draft.editing;
    if (parsed.every) {
      const nextDefinition = definitionFromParsed({ parsed, existing: definition, id: definition?.id ?? identifier(), today: store.today });
      if (existing) {
        store.putTask(taskFromParsed({ parsed, existing, id: existing.id, today: store.today, now, definition: nextDefinition }));
      } else if (dueToday({ definition: nextDefinition, today: store.today })) {
        store.putTask(taskFromParsed({ parsed, existing: null, id: identifier(), today: store.today, now, definition: nextDefinition }));
      }
      store.putDefinition(nextDefinition);
    } else {
      store.putTask(taskFromParsed({ parsed, existing, id: existing?.id ?? identifier(), today: store.today, now, definition: null }));
    }
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") onClose();
    if (event.key !== "Enter") return;
    if (event.shiftKey) {
      if (!draft.block) {
        event.preventDefault();
        onChange({ ...draft, text: draft.text + "\n", block: true });
      }
      return;
    }
    if (!draft.block) {
      event.preventDefault();
      commit();
    }
  };

  const onText = (text: string) => onChange({ ...draft, text, block: draft.block || text.includes("\n") });

  const preview = parsed ? taskFromParsed({ parsed, existing: draft.editing, id: "preview", today: store.today, now: nowStamp(), definition: null }) : null;
  const metaline = parsed ? [parsed.every ? everyLabel(parsed.every) : "", preview?.group ?? "", parsed.rest ? "rest " + formatDuration(parsed.rest) : ""].filter(Boolean).join(" · ") : "";

  return (
    <Overlay>
      <div className="scrim" onClick={onClose} />
      <div className="composer">
        {draft.block && (
          <div className="preview">
            {preview ? (
              <>
                <div className="dateline">{metaline}</div>
                <TaskRow task={preview} chip={null} select={null} press={null} onTitle={() => field.current?.focus()} onAddComment={() => null} onDeleteComment={() => null} fixedOpen />
              </>
            ) : (
              <div className="dateline">Type a task below to see it here.</div>
            )}
          </div>
        )}
        <div className={draft.block ? "composer-field block" : "composer-field"}>
          <textarea
            ref={field}
            rows={1}
            value={draft.text}
            placeholder={draft.block ? "Morning stretch /exercise #every mo,we,fr\n- neck rolls #timer 30s" : "Add a task"}
            spellCheck={false}
            autoCapitalize="sentences"
            enterKeyHint={draft.block ? "enter" : "done"}
            onChange={(event) => onText(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="actions">
            <div className="actions-left">
              {draft.editing && (
                <TextButton active={false} onSelect={onDelete}>
                  delete
                </TextButton>
              )}
              {!draft.block && (
                <TextButton active={false} onSelect={() => onChange({ ...draft, block: true })}>
                  more
                </TextButton>
              )}
            </div>
            <div className="actions-right">
              <TextButton active={false} onSelect={onClose}>
                cancel
              </TextButton>
              <TextButton active={parsed !== null} onSelect={commit}>
                {draft.editing ? "save" : "add"}
              </TextButton>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

export function Today() {
  const store = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [commenting, setCommenting] = useState<Task | null>(null);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [running, setRunning] = useState<{ taskIds: string[]; label: string } | null>(null);

  const placed = { today: store.today, entries: store.journal, comments: store.comments };
  const onToday = store.tasks.filter((task) => isOnToday({ task, ...placed }));
  const thisWeek = store.tasks
    .filter((task) => isThisWeek({ task, today: store.today }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || byPosition(a, b))
    .filter((task, index, all) => task.definitionId === null || all.findIndex((each) => each.definitionId === task.definitionId) === index);
  const backlog = store.tasks.filter((task) => isBacklog({ task, ...placed }));

  const edit = (task: Task) => {
    const definition = task.definitionId ? (store.definitions.find((each) => each.id === task.definitionId) ?? null) : null;
    setDraft({ text: serializeTask({ task, every: definition?.every ?? null, today: store.today }), block: true, editing: task });
  };

  const askDelete = (task: Task) => {
    const definition: Definition | null = task.definitionId ? (store.definitions.find((each) => each.id === task.definitionId) ?? null) : null;
    const finish = () => {
      setAsking(null);
      setDraft(null);
    };
    if (definition) {
      setAsking({
        question: `Delete ${task.name}?`,
        choices: [
          { label: "today only", onChoose: () => { store.deleteTask(task.id); finish(); } },
          { label: "every day", onChoose: () => { store.deleteTask(task.id); store.deleteDefinition(definition.id); finish(); } },
        ],
      });
    } else {
      setAsking({ question: `Delete ${task.name}?`, choices: [{ label: "delete", onChoose: () => { store.deleteTask(task.id); finish(); } }] });
    }
  };

  const askDeleteComment = (comment: Comment) =>
    setAsking({ question: "Delete this comment?", choices: [{ label: "delete", onChoose: () => { store.deleteComment(comment.id); setAsking(null); } }] });

  const bringForward = (task: Task) => store.putTask({ ...task, date: store.today });

  const todayGroups = grouped(onToday);
  const backlogGroups = grouped(backlog);
  const listOrder = [...todayGroups.flatMap((each) => each.tasks), ...thisWeek, ...backlogGroups.flatMap((each) => each.tasks)];

  const toggleSelected = (ids: string[]) =>
    setSelection((current) => {
      const next = new Set(current);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) if (allOn) next.delete(id);
      else next.add(id);
      return next;
    });

  const groupSelect = (tasks: Task[]) =>
    selection ? { on: tasks.length > 0 && tasks.every((task) => selection.has(task.id)), onToggle: () => toggleSelected(tasks.map((task) => task.id)) } : null;

  const play = () => {
    const chosen = listOrder.filter((task) => selection?.has(task.id));
    if (chosen.length === 0) return;
    const groups = new Set(chosen.map((task) => task.group));
    const label = chosen.length === 1 ? (chosen[0]?.name ?? "") : groups.size === 1 ? capitalise(chosen[0]?.group ?? "") : "Selection";
    setRunning({ taskIds: chosen.map((task) => task.id), label });
  };

  const row = ({ task, chip, onRight, onTitle }: { task: Task; chip: string | null; onRight: (() => void) | null; onTitle: () => void }) => (
    <Swipeable key={task.id} onRight={selection ? null : onRight} onLeft={selection ? null : () => askDelete(task)}>
      <TaskRow
        task={task}
        chip={chip}
        select={selection ? { on: selection.has(task.id), onToggle: () => toggleSelected([task.id]), onHandle: () => null } : null}
        press={selection ? null : longPress(() => setSelection(new Set([task.id])))}
        onTitle={onTitle}
        onAddComment={() => setCommenting(task)}
        onDeleteComment={askDeleteComment}
        fixedOpen={false}
      />
    </Swipeable>
  );

  const groupPress = (tasks: Task[]) => (selection ? null : longPress(() => setSelection(new Set(tasks.map((task) => task.id)))));

  return (
    <>
      <div className="list">
        {todayGroups.map(({ group, tasks }) => (
          <Group key={group} storageKey={"group:" + group} label={group} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)}>
            {tasks.map((task) => row({ task, chip: null, onRight: null, onTitle: () => edit(task) }))}
          </Group>
        ))}
        {thisWeek.length > 0 && (
          <Group storageKey="week" label="This week" count={thisWeek.length} defaultOpen={false} select={groupSelect(thisWeek)} press={groupPress(thisWeek)}>
            {thisWeek.map((task) => row({ task, chip: task.group, onRight: null, onTitle: () => bringForward(task) }))}
          </Group>
        )}
        {backlog.length > 0 && (
          <Group storageKey="backlog" label="Backlog" count={backlog.length} defaultOpen={false} select={groupSelect(backlog)} press={groupPress(backlog)}>
            {backlogGroups.map(({ group, tasks }) => (
              <Group key={group} storageKey={"backlog:" + group} label={group} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)}>
                {tasks.map((task) => row({ task, chip: null, onRight: () => bringForward(task), onTitle: () => edit(task) }))}
              </Group>
            ))}
          </Group>
        )}
      </div>
      {selection ? (
        <div className="floating select-bar">
          <RoundButton label="leave select mode" onSelect={() => setSelection(null)}>
            <CrossGlyph />
          </RoundButton>
          <RoundButton label="play" onSelect={play}>
            <PlayGlyph />
          </RoundButton>
        </div>
      ) : (
        <div className="floating">
          <RoundButton label="add" onSelect={() => setDraft({ text: "", block: false, editing: null })}>
            <PlusGlyph />
          </RoundButton>
        </div>
      )}
      {running && (
        <Runner
          taskIds={running.taskIds}
          label={running.label}
          onClose={() => {
            setRunning(null);
            setSelection(null);
          }}
        />
      )}
      {draft && <Composer draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onDelete={() => draft.editing && askDelete(draft.editing)} />}
      {commenting && (
        <EditorScreen
          heading="Comment"
          subheading={commenting.name}
          initial=""
          onCancel={() => setCommenting(null)}
          onSave={(body) => {
            store.putComment({ id: identifier(), definitionId: commenting.definitionId, taskName: commenting.name, body: body.trim(), author: "camen", writtenAt: nowStamp(), seenAt: nowStamp() });
            setCommenting(null);
          }}
        />
      )}
      {asking && <Confirm question={asking.question} choices={asking.choices} onCancel={() => setAsking(null)} />}
    </>
  );
}
