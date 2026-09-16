import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, keymap, placeholder } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

import { definitionFromParsed, dueToday, taskFromParsed } from "@shared/composer.ts";
import { formatDuration } from "@shared/format.ts";
import { everyLabel, parseTask, serializeTask, tokenSpans } from "@shared/grammar.ts";
import type { Comment, Definition, Task } from "@shared/model.ts";
import { changedOnly, partAsTask, placed, regrouped, taskAsParts, withPartsInserted, withoutPart } from "@shared/move.ts";
import type { Container, Target } from "@shared/move.ts";
import { byPosition, commentsFor, grouped, groupLabel, isBacklog, isOnToday, partToggled, toggled } from "@shared/tasks.ts";

import { Confirm } from "../components/Confirm.tsx";
import type { Choice } from "../components/Confirm.tsx";
import { EditorScreen } from "../components/EditorScreen.tsx";
import { CrossGlyph, GripGlyph, PlayGlyph, PlusGlyph, TickGlyph } from "../components/Glyphs.tsx";
import { Group } from "../components/Group.tsx";
import { Overlay } from "../components/Overlay.tsx";
import { RoundButton } from "../components/RoundButton.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import type { Select } from "../components/TaskRow.tsx";
import { TextButton } from "../components/TextButton.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { useFolds } from "../components/Foldable.tsx";
import { commentsKey, openKey } from "../components/TaskRow.tsx";
import { longPress } from "../interaction/longPress.ts";
import { ShortcutsSheet, useShortcuts } from "../interaction/shortcuts.tsx";
import type { ShortcutAction } from "../interaction/shortcuts.tsx";
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

const mode = new Compartment();

function modeExtensions(block: boolean): Extension {
  return [
    placeholder(block ? "Morning stretch /exercise #every mo,we,fr\n- neck rolls #timer 30s" : "add a task"),
    EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "sentences", enterkeyhint: block ? "enter" : "done" }),
  ];
}

function grammarHighlighting(today: string): Extension {
  const marks = (view: EditorView): DecorationSet =>
    Decoration.set(
      tokenSpans({ text: view.state.doc.toString(), today }).map((span) => Decoration.mark({ class: span.kind === "bullet" ? "cm-bullet" : "cm-attribute" }).range(span.from, span.to)),
      true,
    );
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = marks(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = marks(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function Composer({ draft, onChange, onCommit, onClose, onDelete }: { draft: Draft; onChange: (draft: Draft) => void; onCommit: (task: Task) => void; onClose: () => void; onDelete: () => void }) {
  const store = useStore();
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<EditorView | null>(null);
  const opened = useRef(draft.text);
  const [leaving, setLeaving] = useState(false);
  const parsed = parseTask({ text: draft.text, today: store.today });
  const definition = draft.editing?.definitionId ? (store.definitions.find((each) => each.id === draft.editing?.definitionId) ?? null) : null;

  const commit = () => {
    if (!parsed) return;
    const now = nowStamp();
    const existing = draft.editing;
    if (parsed.every) {
      const nextDefinition = definitionFromParsed({ parsed, existing: definition, id: definition?.id ?? identifier(), today: store.today });
      if (existing) {
        onCommit(taskFromParsed({ parsed, existing, id: existing.id, today: store.today, now, definition: nextDefinition }));
      } else if (dueToday({ definition: nextDefinition, today: store.today })) {
        onCommit(taskFromParsed({ parsed, existing: null, id: identifier(), today: store.today, now, definition: nextDefinition }));
      }
      store.putDefinition(nextDefinition);
    } else {
      onCommit(taskFromParsed({ parsed, existing, id: existing?.id ?? identifier(), today: store.today, now, definition: null }));
    }
    onClose();
  };

  const onText = (text: string) => onChange({ ...draft, text, block: draft.block || text.includes("\n") });

  const latest = useRef({ block: draft.block, commit, onText });
  latest.current = { block: draft.block, commit, onText };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const view = new EditorView({
      parent: element,
      state: EditorState.create({
        doc: draft.text,
        extensions: [
          keymap.of([
            {
              key: "Enter",
              run: () => {
                if (latest.current.block) return false;
                latest.current.commit();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          grammarHighlighting(store.today),
          mode.of(modeExtensions(draft.block)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onText(update.state.doc.toString());
          }),
        ],
      }),
    });
    field.current = view;
    view.focus();
    view.dispatch({ selection: { anchor: view.state.doc.line(1).to } });
    return () => view.destroy();
  }, []);

  useEffect(() => {
    field.current?.dispatch({ effects: mode.reconfigure(modeExtensions(draft.block)) });
  }, [draft.block]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && !(event.key === "Enter" && event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") commit();
      else if (leaving) setLeaving(false);
      else if (parsed && draft.text !== opened.current) setLeaving(true);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [draft.text, leaving]);

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
                <TaskRow
                  task={preview}
                  comments={[]}
                  chip={null}
                  select={null}
                  onHold={null}
                  focused={null}
                  onTick={() => null}
                  onTitle={() => field.current?.focus()}
                  onToday={null}
                  onDelete={null}
                  onDeletePart={null}
                  onAddComment={() => null}
                  onDeleteComment={() => null}
                  fixedOpen
                  unfoldParts={false}
                />
              </>
            ) : (
              <div className="dateline">type a task below to see it here</div>
            )}
          </div>
        )}
        <div className="composer-field">
          <div className="editor" ref={host} />
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
      {leaving && (
        <Confirm
          question="save this task?"
          choices={[
            { label: "discard", onChoose: onClose },
            { label: "save", onChoose: commit },
          ]}
          onCancel={() => setLeaving(false)}
        />
      )}
    </Overlay>
  );
}

export function Tasks() {
  const store = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [helping, setHelping] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const folds = useFolds();
  const [commenting, setCommenting] = useState<Task | null>(null);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [running, setRunning] = useState<{ taskIds: string[]; label: string } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [openedByDrag, setOpenedByDrag] = useState<Set<string>>(new Set());
  const [landed, setLanded] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const blur = () => setFocused(null);
    window.addEventListener("pointerdown", blur);
    return () => window.removeEventListener("pointerdown", blur);
  }, []);

  useEffect(() => {
    if (!landed) return;
    const settled = window.setTimeout(() => {
      listRef.current?.querySelector(`[data-task="${landed}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setLanded(null);
    }, 500);
    return () => window.clearTimeout(settled);
  }, [landed]);

  const placing = { today: store.today, entries: store.journal, comments: store.comments };
  const onToday = store.tasks.filter((task) => isOnToday({ task, ...placing }));
  const backlog = store.tasks
    .filter((task) => isBacklog({ task, ...placing }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || byPosition(a, b))
    .filter((task, index, all) => task.definitionId === null || all.findIndex((each) => each.definitionId === task.definitionId) === index);

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
        question: `delete ${task.name}?`,
        choices: [
          { label: "today only", onChoose: () => { store.deleteTask(task.id); finish(); } },
          { label: "every day", onChoose: () => { store.deleteTask(task.id); store.deleteDefinition(definition.id); finish(); } },
        ],
      });
    } else {
      setAsking({ question: `delete ${task.name}?`, choices: [{ label: "delete", onChoose: () => { store.deleteTask(task.id); finish(); } }] });
    }
  };

  const askDeleteComment = (comment: Comment) =>
    setAsking({ question: "delete this comment?", choices: [{ label: "delete", onChoose: () => { store.deleteComment(comment.id); setAsking(null); } }] });

  const askDeletePart = ({ task, index }: { task: Task; index: number }) =>
    setAsking({ question: `delete ${task.parts[index]?.name ?? ""}?`, choices: [{ label: "delete", onChoose: () => { store.putTask(withoutPart({ host: task, index })); setAsking(null); } }] });

  const bringForward = (task: Task) => store.putTask({ ...task, date: store.today });

  const reveal = (task: Task) => {
    store.putTask(task);
    const section = task.date !== null && task.date <= store.today ? "today" : "backlog";
    folds.set({ key: section, open: true });
    folds.set({ key: section + ":" + task.group, open: true });
    folds.set({ key: openKey(task.id), open: true });
    setLanded(task.id);
  };

  const todayGroups = grouped(onToday);
  const backlogGroups = grouped(backlog);
  const listOrder = [...todayGroups.flatMap((each) => each.tasks), ...backlogGroups.flatMap((each) => each.tasks)];

  const rowAt = (id: string): { host: Task; index: number | null } | null => {
    const whole = store.tasks.find((each) => each.id === id);
    if (whole) return { host: whole, index: null };
    const [hostId = "", indexText = ""] = id.split(":");
    const host = store.tasks.find((each) => each.id === hostId);
    return host && indexText !== "" ? { host, index: Number(indexText) } : null;
  };

  const toggleSelected = (ids: string[]) =>
    setSelection((current) => {
      const next = new Set(current);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) if (allOn) next.delete(id);
      else next.add(id);
      return next.size === 0 ? null : next;
    });

  const groupSelect = (tasks: Task[]) =>
    selection ? { on: tasks.length > 0 && tasks.every((task) => selection.has(task.id)), onToggle: () => toggleSelected(tasks.map((task) => task.id)) } : null;

  const play = () => {
    const chosen = listOrder.filter((task) => selection?.has(task.id) || task.parts.some((_, index) => selection?.has(task.id + ":" + index)));
    if (chosen.length === 0) return;
    const groups = new Set(chosen.map((task) => task.group));
    const label = chosen.length === 1 ? (chosen[0]?.name ?? "") : groups.size === 1 ? (chosen[0]?.group ?? "") : "selection";
    setRunning({ taskIds: chosen.map((task) => task.id), label });
  };

  const rowsOf = ({ container, group }: { container: Container; group: string }): Task[] => {
    const groups = container === "today" ? todayGroups : backlogGroups;
    return groups.find((each) => each.group === group)?.tasks ?? [];
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
    const group = holder?.dataset.group ?? "";
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
      target: { kind: "top", container, group, index: position + (after ? 1 : 0) },
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
      for (const definition of regrouped({ moving, definitions: store.definitions, group: target.group })) store.putDefinition(definition);
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
      if (!current) return;
      applyDrop(current);
      if (current.fromPart && current.target) toggleSelected([current.fromPart.taskId + ":" + current.fromPart.index]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const select: Select | null = selection
    ? {
        selected: (id) => selection.has(id),
        onToggle: (id) => toggleSelected([id]),
        onHandle: ({ event, id }) => {
          const dragged = rowAt(id);
          if (!dragged) return;
          const chosen = selection.has(id) ? selection : new Set(selection).add(id);
          setSelection(chosen);
          if (dragged.index !== null) {
            beginDrag({ event, ids: [], fromPart: { taskId: dragged.host.id, index: dragged.index }, title: dragged.host.parts[dragged.index]?.name ?? "" });
            return;
          }
          const bundle = listOrder.filter((each) => chosen.has(each.id)).map((each) => each.id);
          beginDrag({ event, ids: bundle, fromPart: null, title: bundle.length > 1 ? `${bundle.length} tasks` : dragged.host.name });
        },
      }
    : null;

  const holdToSelect = (id: string) => setSelection((current) => new Set(current).add(id));

  const row = ({ task, chip, onToday, onTick }: { task: Task; chip: string | null; onToday: (() => void) | null; onTick: () => void }) => (
    <div key={task.id} className={drag?.ids.includes(task.id) ? "lifting" : undefined} data-task={task.id}>
        <TaskRow
          task={task}
          comments={commentsFor({ task, comments: store.comments })}
          chip={chip}
          select={select}
          onHold={holdToSelect}
          focused={focused}
          onTick={onTick}
          onTitle={() => edit(task)}
          onToday={onToday}
          onDelete={() => askDelete(task)}
          onDeletePart={(index) => askDeletePart({ task, index })}
          onAddComment={() => setCommenting(task)}
          onDeleteComment={askDeleteComment}
          fixedOpen={false}
          unfoldParts={openedByDrag.has(task.id)}
        />
    </div>
  );

  const tick = (task: Task) => store.putTask(toggled({ task, entries: store.journal, now: nowStamp() }));

  const groupPress = (tasks: Task[]) => longPress(() => setSelection((current) => new Set([...(current ?? []), ...tasks.map((task) => task.id)])));

  const focusOrder = (): string[] =>
    [...(listRef.current?.querySelectorAll<HTMLElement>("[data-focus]") ?? [])].filter((element) => !element.closest(".roll:not(.open)")).map((element) => element.dataset.focus ?? "");

  const moveFocus = (step: number) => {
    const order = focusOrder();
    const position = focused ? order.indexOf(focused) : -1;
    const next = order[Math.max(0, Math.min(order.length - 1, position + step))] ?? null;
    setFocused(next);
    listRef.current?.querySelector<HTMLElement>(`[data-focus="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const shortcut = (action: ShortcutAction) => {
    const target = focused && !focused.startsWith("group:") ? rowAt(focused) : null;
    if (action === "help") return setHelping(true);
    if (action === "add") return setDraft({ text: "", block: false, editing: null });
    if (action === "down") return moveFocus(1);
    if (action === "up") return moveFocus(-1);
    if (action === "close") {
      if (asking) return setAsking(null);
      if (helping) return setHelping(false);
      if (draft) return setDraft(null);
      if (commenting) return setCommenting(null);
      if (running) return setRunning(null);
      if (selection) return setSelection(null);
      if (target && folds.isOpen({ key: openKey(target.host.id), fallback: false })) return folds.set({ key: openKey(target.host.id), open: false });
      setFocused(null);
      return (document.activeElement as HTMLElement | null)?.blur();
    }
    if (focused?.startsWith("group:")) {
      const key = focused.slice(6);
      if (action === "fold") folds.set({ key, open: !folds.isOpen({ key, fallback: key !== "backlog" }) });
      return;
    }
    if (!target) return;
    const { host, index } = target;
    if (action === "fold") {
      const key = openKey(focused ?? "");
      return folds.set({ key, open: !folds.isOpen({ key, fallback: false }) });
    }
    if (action === "select") return selection ? toggleSelected([host.id]) : setSelection(new Set([host.id]));
    if (action === "complete") return index === null ? tick(host) : store.putTask(partToggled({ task: host, index, now: nowStamp() }));
    if (action === "edit") return edit(host);
    if (action === "delete") return index === null ? askDelete(host) : askDeletePart({ task: host, index });
    if (action === "today") {
      if (host.definitionId) return;
      return store.putTask({ ...host, date: host.date === null ? store.today : null });
    }
    if (action === "thread" && commentsFor({ task: host, comments: store.comments }).length > 0) {
      const on = !folds.isOpen({ key: commentsKey(host.id), fallback: false });
      folds.set({ key: commentsKey(host.id), open: on });
      folds.set({ key: openKey(host.id), open: on });
    }
  };

  useShortcuts(shortcut);

  return (
    <>
      <div className="list" ref={listRef}>
        <div className="section">
          <Group storageKey="today" label="Today" count={onToday.length} defaultOpen select={groupSelect(onToday)} press={groupPress(onToday)} focused={focused === "group:today"}>
            {todayGroups.map(({ group, tasks }) => (
              <div key={group} data-container="today" data-group={group}>
                <Group storageKey={"today:" + group} label={groupLabel(group)} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)} focused={focused === "group:today:" + group}>
                  {tasks.map((task) => row({ task, chip: null, onToday: null, onTick: () => tick(task) }))}
                </Group>
              </div>
            ))}
          </Group>
        </div>
        <div className="section">
          <Group storageKey="backlog" label="Backlog" count={backlog.length} defaultOpen={false} select={groupSelect(backlog)} press={groupPress(backlog)} focused={focused === "group:backlog"}>
            {backlogGroups.map(({ group, tasks }) => (
              <div key={group} data-container="backlog" data-group={group}>
                <Group storageKey={"backlog:" + group} label={groupLabel(group)} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)} focused={focused === "group:backlog:" + group}>
                  {tasks.map((task) => row({ task, chip: null, onToday: () => bringForward(task), onTick: () => tick(task) }))}
                </Group>
              </div>
            ))}
          </Group>
        </div>
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
      {draft && <Composer draft={draft} onChange={setDraft} onCommit={reveal} onClose={() => setDraft(null)} onDelete={() => draft.editing && askDelete(draft.editing)} />}
      {commenting && (
        <EditorScreen
          heading="comment"
          subheading={commenting.name}
          initial=""
          onCancel={() => setCommenting(null)}
          onSave={(body) => {
            store.putComment({ id: identifier(), definitionId: commenting.definitionId, taskName: commenting.name, body: body.trim(), author: "user", writtenAt: nowStamp(), seenAt: nowStamp() });
            setCommenting(null);
          }}
        />
      )}
      {asking && <Confirm question={asking.question} choices={asking.choices} onCancel={() => setAsking(null)} />}
      {helping && <ShortcutsSheet onClose={() => setHelping(false)} />}
    </>
  );
}
