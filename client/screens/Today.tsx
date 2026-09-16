import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { definitionFromParsed, dueToday, taskFromParsed } from "@shared/composer.ts";
import { capitalise, formatDuration } from "@shared/format.ts";
import { everyLabel, parseTask, serializeTask } from "@shared/grammar.ts";
import type { Comment, Definition, Task } from "@shared/model.ts";
import { changedOnly, partAsTask, placed, taskAsParts, withPartsInserted, withoutPart } from "@shared/move.ts";
import type { Container, Target } from "@shared/move.ts";
import { byPosition, grouped, isBacklog, isOnToday, isThisWeek } from "@shared/tasks.ts";

import { Confirm } from "../components/Confirm.tsx";
import type { Choice } from "../components/Confirm.tsx";
import { EditorScreen } from "../components/EditorScreen.tsx";
import { CrossGlyph, GripGlyph, PlayGlyph, PlusGlyph, TickGlyph } from "../components/Glyphs.tsx";
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

interface Drag {
  ids: string[];
  fromPart: { taskId: string; index: number } | null;
  title: string;
  startX: number;
  x: number;
  y: number;
  target: Target | null;
  line: { top: number; left: number; width: number } | null;
  hover: { taskId: string; since: number } | null;
}

const nestDistance = 40;
const unfoldDelay = 480;
const scrollEdge = 120;
const scrollStep = 10;

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
                <TaskRow task={preview} chip={null} select={null} press={null} onTitle={() => field.current?.focus()} onAddComment={() => null} onDeleteComment={() => null} fixedOpen unfoldParts={false} />
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
  const [drag, setDrag] = useState<Drag | null>(null);
  const [openedByDrag, setOpenedByDrag] = useState<Set<string>>(new Set());
  const dragRef = useRef<Drag | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const placing = { today: store.today, entries: store.journal, comments: store.comments };
  const onToday = store.tasks.filter((task) => isOnToday({ task, ...placing }));
  const thisWeek = store.tasks
    .filter((task) => isThisWeek({ task, today: store.today }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || byPosition(a, b))
    .filter((task, index, all) => task.definitionId === null || all.findIndex((each) => each.definitionId === task.definitionId) === index);
  const backlog = store.tasks.filter((task) => isBacklog({ task, ...placing }));

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

  const rowsOf = ({ container, group }: { container: Container; group: string | null }): Task[] => {
    if (container === "today") return todayGroups.find((each) => each.group === group)?.tasks ?? [];
    if (container === "week") return thisWeek;
    return backlogGroups.find((each) => each.group === group)?.tasks ?? [];
  };

  const resolveTarget = ({ current, x, y }: { current: Drag; x: number; y: number }): { target: Target | null; line: Drag["line"]; hovered: string | null } => {
    const column = listRef.current?.getBoundingClientRect();
    if (!column) return { target: null, line: null, hovered: null };
    const element = document.elementFromPoint(Math.max(column.left + 8, Math.min(column.right - 8, x)), y);
    const taskElement = element?.closest<HTMLElement>("[data-task]");
    const partElement =
      element?.closest<HTMLElement>("[data-part]") ??
      [...(taskElement?.querySelectorAll<HTMLElement>("[data-part]") ?? [])].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      }) ??
      null;
    const nesting = x - current.startX > nestDistance;
    const leaving = current.fromPart !== null && x - current.startX < -nestDistance;
    if (partElement && taskElement && !leaving) {
      const [taskId = "", indexText = "0"] = (partElement.dataset.part ?? "").split(":");
      const rect = partElement.getBoundingClientRect();
      const after = y > rect.top + rect.height / 2;
      return {
        target: { kind: "part", taskId, index: Number(indexText) + (after ? 1 : 0) },
        line: { top: after ? rect.bottom : rect.top, left: rect.left, width: column.right - rect.left },
        hovered: taskId,
      };
    }
    if (!taskElement) return { target: null, line: null, hovered: null };
    const taskId = taskElement.dataset.task ?? "";
    if (current.ids.includes(taskId)) return { target: null, line: null, hovered: null };
    const holder = taskElement.closest<HTMLElement>("[data-container]");
    const container = (holder?.dataset.container ?? "today") as Container;
    const group = holder?.dataset.group || null;
    const main = taskElement.querySelector(".main")?.getBoundingClientRect() ?? taskElement.getBoundingClientRect();
    const rect = taskElement.getBoundingClientRect();
    if (nesting && !leaving) {
      const indent = main.left + 2.05 * 16 + (selection ? 2.05 * 16 : 0);
      return { target: { kind: "part", taskId, index: 0 }, line: { top: main.bottom + 4, left: indent, width: column.right - indent }, hovered: taskId };
    }
    const after = y > rect.top + rect.height / 2;
    const rows = rowsOf({ container, group });
    const position = rows.findIndex((each) => each.id === taskId);
    return {
      target: { kind: "top", container, group: group ?? rows.find((each) => each.id === taskId)?.group ?? "personal", index: position + (after ? 1 : 0) },
      line: { top: after ? rect.bottom : rect.top, left: column.left, width: column.width },
      hovered: taskId,
    };
  };

  const applyDrop = (current: Drag) => {
    const target = current.target;
    if (!target) return;
    const now = nowStamp();
    const source = current.fromPart ? (store.tasks.find((each) => each.id === current.fromPart?.taskId) ?? null) : null;
    const sourcePart = source && current.fromPart ? source.parts[current.fromPart.index] : undefined;
    const moving: Task[] = source && sourcePart && current.fromPart
      ? [partAsTask({ part: sourcePart, host: source, id: identifier(), created: now })]
      : listOrder.filter((task) => current.ids.includes(task.id));
    if (moving.length === 0) return;
    if (target.kind === "top") {
      const rows = rowsOf({ container: target.container, group: target.group });
      const after = placed({ rows, moving, target, today: store.today });
      for (const task of changedOnly({ before: rows, after })) store.putTask(task);
      if (source && current.fromPart) store.putTask(withoutPart({ host: source, index: current.fromPart.index }));
      return;
    }
    const host = store.tasks.find((each) => each.id === target.taskId);
    if (!host) return;
    const parts = moving.flatMap(taskAsParts);
    if (source && current.fromPart && source.id === host.id) {
      const index = target.index > current.fromPart.index ? target.index - 1 : target.index;
      store.putTask(withPartsInserted({ host: withoutPart({ host, index: current.fromPart.index }), parts, index }));
      return;
    }
    store.putTask(withPartsInserted({ host, parts, index: target.index }));
    if (source && current.fromPart) store.putTask(withoutPart({ host: source, index: current.fromPart.index }));
    else for (const task of moving) store.deleteTask(task.id);
  };

  const beginDrag = ({ event, ids, fromPart, title }: { event: ReactPointerEvent<HTMLButtonElement>; ids: string[]; fromPart: Drag["fromPart"]; title: string }) => {
    event.preventDefault();
    event.stopPropagation();
    const start: Drag = { ids, fromPart, title, startX: event.clientX, x: event.clientX, y: event.clientY, target: null, line: null, hover: null };
    dragRef.current = start;
    setDrag(start);
    const track = ({ x, y }: { x: number; y: number }) => {
      const current = dragRef.current;
      if (!current) return;
      const { target, line, hovered } = resolveTarget({ current, x, y });
      const hover = hovered ? (current.hover?.taskId === hovered ? current.hover : { taskId: hovered, since: Date.now() }) : null;
      if (hover && Date.now() - hover.since > unfoldDelay) setOpenedByDrag((opened) => (opened.has(hover.taskId) ? opened : new Set(opened).add(hover.taskId)));
      dragRef.current = { ...current, x, y, target, line, hover };
      setDrag(dragRef.current);
    };
    const move = (moved: PointerEvent) => track({ x: moved.clientX, y: moved.clientY });
    const creep = window.setInterval(() => {
      const current = dragRef.current;
      if (!current) return;
      const viewport = window.visualViewport;
      const below = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - current.y;
      if (current.y < scrollEdge && window.scrollY > 0) {
        window.scrollBy(0, -scrollStep);
        track({ x: current.x, y: current.y });
      } else if (below < scrollEdge) {
        window.scrollBy(0, scrollStep);
        track({ x: current.x, y: current.y });
      }
    }, 16);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.clearInterval(creep);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setOpenedByDrag(new Set());
      if (current) applyDrop(current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const row = ({ task, chip, onRight, onTitle }: { task: Task; chip: string | null; onRight: (() => void) | null; onTitle: () => void }) => (
    <Swipeable key={task.id} onRight={selection ? null : onRight} onLeft={selection ? null : () => askDelete(task)}>
      <div className={drag?.ids.includes(task.id) ? "lifting" : undefined}>
        <TaskRow
          task={task}
          chip={chip}
          select={
            selection
              ? {
                  on: selection.has(task.id),
                  onToggle: () => toggleSelected([task.id]),
                  onHandle: (event) => {
                    const bundle = selection.has(task.id) && selection.size > 1 ? listOrder.filter((each) => selection.has(each.id)).map((each) => each.id) : [task.id];
                    beginDrag({ event, ids: bundle, fromPart: null, title: bundle.length > 1 ? `${bundle.length} tasks` : task.name });
                  },
                  onPartHandle: (event, index) => beginDrag({ event, ids: [], fromPart: { taskId: task.id, index }, title: task.parts[index]?.name ?? "" }),
                }
              : null
          }
          press={selection ? null : longPress(() => setSelection(new Set([task.id])))}
          onTitle={onTitle}
          onAddComment={() => setCommenting(task)}
          onDeleteComment={askDeleteComment}
          fixedOpen={false}
          unfoldParts={openedByDrag.has(task.id)}
        />
      </div>
    </Swipeable>
  );

  const groupPress = (tasks: Task[]) => (selection ? null : longPress(() => setSelection(new Set(tasks.map((task) => task.id)))));

  return (
    <>
      <div className="list" ref={listRef}>
        {todayGroups.map(({ group, tasks }) => (
          <div key={group} data-container="today" data-group={group}>
            <Group storageKey={"group:" + group} label={group} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)}>
              {tasks.map((task) => row({ task, chip: null, onRight: null, onTitle: () => edit(task) }))}
            </Group>
          </div>
        ))}
        {thisWeek.length > 0 && (
          <div data-container="week" data-group="">
            <Group storageKey="week" label="This week" count={thisWeek.length} defaultOpen={false} select={groupSelect(thisWeek)} press={groupPress(thisWeek)}>
              {thisWeek.map((task) => row({ task, chip: task.group, onRight: null, onTitle: () => bringForward(task) }))}
            </Group>
          </div>
        )}
        {backlog.length > 0 && (
          <Group storageKey="backlog" label="Backlog" count={backlog.length} defaultOpen={false} select={groupSelect(backlog)} press={groupPress(backlog)}>
            {backlogGroups.map(({ group, tasks }) => (
              <div key={group} data-container="backlog" data-group={group}>
                <Group storageKey={"backlog:" + group} label={group} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)}>
                  {tasks.map((task) => row({ task, chip: null, onRight: () => bringForward(task), onTitle: () => edit(task) }))}
                </Group>
              </div>
            ))}
          </Group>
        )}
      </div>
      {drag && drag.line && <div className="drop-line" style={{ top: drag.line.top, left: drag.line.left, width: drag.line.width }} />}
      {drag && (
        <div className="drag-ghost" style={{ top: drag.y - 24, left: listRef.current?.getBoundingClientRect().left ?? 0, width: listRef.current?.getBoundingClientRect().width ?? 0 }}>
          <span className="handle">
            <GripGlyph />
          </span>
          <span className="square on">
            <span>
              <TickGlyph size={12} />
            </span>
          </span>
          <span className="text">{drag.title}</span>
        </div>
      )}
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
