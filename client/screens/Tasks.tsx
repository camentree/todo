import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, keymap, placeholder } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

import { dueToday, scheduleFromParsed, taskFromParsed } from "@shared/composer.ts";
import { formatDuration } from "@shared/format.ts";
import { everyToken, parseTask, serializeTask, tokenSpans } from "@shared/grammar.ts";
import type { Comment, Schedule, Task } from "@shared/model.ts";
import { changedOnly, placed, regrouped, subtaskAsTask, taskAsSubtasks, withSubtasksInserted, withoutSubtask } from "@shared/move.ts";
import type { Container, Target } from "@shared/move.ts";
import { byPosition, grouped, groupLabel, isBacklog, isOnToday, isSkipped, skipToggled, subtaskToggled, toggled } from "@shared/tasks.ts";

import { Confirm } from "../components/Confirm.tsx";
import type { Choice } from "../components/Confirm.tsx";
import { CrossGlyph, GripGlyph, PlayGlyph, PlusGlyph, TickGlyph } from "../components/Glyphs.tsx";
import { Group } from "../components/Group.tsx";
import { Overlay } from "../components/Overlay.tsx";
import { RoundButton } from "../components/RoundButton.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import type { Select } from "../components/TaskRow.tsx";
import type { Swipe } from "../components/Swipeable.tsx";
import { TextButton } from "../components/TextButton.tsx";
import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { useFolds } from "../components/Foldable.tsx";
import { closeTask, showing, subtasksKey, toggleComments, toggleSubtasks } from "../components/TaskRow.tsx";
import { longPress } from "../interaction/longPress.ts";
import { useRoute } from "../interaction/route.ts";
import { ShortcutsSheet, useShortcuts } from "../interaction/shortcuts.tsx";
import type { ShortcutAction } from "../interaction/shortcuts.tsx";
import { Runner } from "./Runner.tsx";

interface Draft {
  text: string;
  editing: Task | null;
}

interface Asking {
  question: string;
  choices: Choice[];
}

interface Drag {
  ids: string[];
  fromSubtask: { taskId: string; index: number } | null;
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
const savedDuration = 3000;
const scrollEdge = 120;
const scrollStep = 10;

const sheetSlides = () => window.matchMedia("(min-width: 700px)").matches;


function grammarHighlighting({ today, subtasks }: { today: string; subtasks: boolean }): Extension {
  const marks = (view: EditorView): DecorationSet =>
    Decoration.set(
      tokenSpans({ text: view.state.doc.toString(), today, subtasks }).map((span) => Decoration.mark({ class: span.kind === "bullet" ? "cm-bullet" : "cm-attribute" }).range(span.from, span.to)),
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
  const [closing, setClosing] = useState(false);
  const close = () => (sheetSlides() ? setClosing(true) : onClose());
  const subtasks = !draft.editing || draft.editing.parentId === null;
  const parsed = parseTask({ text: draft.text, today: store.today, subtasks });
  const schedule = draft.editing?.scheduleId ? (store.schedules.find((each) => each.id === draft.editing?.scheduleId) ?? null) : null;

  const commit = () => {
    if (!parsed) return;
    const now = nowStamp();
    const existing = draft.editing;
    if (parsed.every) {
      const nextSchedule = scheduleFromParsed({ parsed, existing: schedule, id: schedule?.id ?? identifier(), today: store.today, now });
      if (existing) {
        onCommit(taskFromParsed({ parsed, existing, id: existing.id, today: store.today, now, schedule: nextSchedule, newId: identifier }));
      } else if (dueToday({ schedule: nextSchedule, today: store.today })) {
        onCommit(taskFromParsed({ parsed, existing: null, id: identifier(), today: store.today, now, schedule: nextSchedule, newId: identifier }));
      }
      store.putSchedule(nextSchedule);
    } else {
      onCommit(taskFromParsed({ parsed, existing, id: existing?.id ?? identifier(), today: store.today, now, schedule: null, newId: identifier }));
    }
    close();
  };

  const onText = (text: string) => onChange({ ...draft, text });

  const latest = useRef({ commit, onText });
  latest.current = { commit, onText };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const view = new EditorView({
      parent: element,
      state: EditorState.create({
        doc: draft.text,
        extensions: [
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          grammarHighlighting({ today: store.today, subtasks }),
          placeholder("Morning stretch /exercise #every mo,we,fr\n- neck rolls #timer 30s"),
          EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "sentences", enterkeyhint: "enter" }),
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && !(event.key === "Enter" && event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter") commit();
      else if (leaving) setLeaving(false);
      else if (parsed && draft.text !== opened.current) setLeaving(true);
      else close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [draft.text, leaving]);

  const preview = parsed ? taskFromParsed({ parsed, existing: draft.editing, id: "preview", today: store.today, now: nowStamp(), schedule: null, newId: identifier }) : null;

  return (
    <Overlay>
      <div className="scrim" onClick={close} />
      <div className={closing ? "composer closing" : "composer"} onTransitionEnd={(event) => closing && event.target === event.currentTarget && onClose()}>
        <div className="preview">
            {preview && parsed ? (
              <TaskRow
                task={preview}
                chips={[preview.parentId === null ? preview.group : "", parsed.restSeconds ? "rest " + formatDuration(parsed.restSeconds) : ""].filter(Boolean)}
                every={parsed.every}
                select={null}
                onHold={null}
                focused={null}
                saved={null}
                onTick={() => null}
                onTitle={() => null}
                onTitleSubtask={null}
                todaySwipe={null}
                onDelete={null}
                onDeleteSubtask={null}
                onAddComment={() => null}
                onDeleteComment={() => null}
                fixedOpen
                unfoldSubtasks={false}
              />
            ) : (
              <div className="dateline">type a task below to see it here</div>
            )}
          </div>
        <div className="composer-field">
          <div className="editor" ref={host} />
          <div className="actions">
            <div className="actions-left">
              {draft.editing && (
                <TextButton active={false} warn onSelect={onDelete}>
                  delete
                </TextButton>
              )}
            </div>
            <div className="actions-right">
              <TextButton active={false} onSelect={close}>
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
            { label: "discard", onChoose: close },
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
  const { route, go, close } = useRoute();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [helping, setHelping] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const lastFocused = useRef<string | null>(null);
  const savedTimer = useRef<number | null>(null);
  const pointerWas = useRef({ x: 0, y: 0 });
  if (focused) lastFocused.current = focused;
  const folds = useFolds();
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [list, setList] = useState<Container>("today");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [openedByDrag, setOpenedByDrag] = useState<Set<string>>(new Set());
  const [landed, setLanded] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const followPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    if (event.clientX === pointerWas.current.x && event.clientY === pointerWas.current.y) return;
    pointerWas.current = { x: event.clientX, y: event.clientY };
    const hovered = (event.target as HTMLElement).closest<HTMLElement>("[data-focus]");
    if (!hovered || hovered.closest(".roll:not(.open)")) return;
    const id = hovered.dataset.focus ?? null;
    if (id !== focused) setFocused(id);
  };

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

  const placing = { today: store.today, entries: store.journal };
  const onToday = store.tasks.filter((task) => isOnToday({ task, ...placing }));
  const backlog = store.tasks
    .filter((task) => isBacklog({ task, ...placing }))
    .sort((a, b) => (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) || (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || byPosition(a, b))
    .filter((task, index, all) => task.scheduleId === null || all.findIndex((each) => each.scheduleId === task.scheduleId) === index);

  const scheduleOf = (task: Task): Schedule | null => (task.scheduleId ? (store.schedules.find((each) => each.id === task.scheduleId) ?? null) : null);

  const edit = (task: Task) => {
    const schedule = scheduleOf(task);
    setDraft({ text: serializeTask({ task, every: schedule ? everyToken(schedule) : null, today: store.today }), editing: task });
  };

  const editSubtask = ({ host, index }: { host: Task; index: number }) => {
    const subtask = host.subtasks[index];
    if (!subtask) return;
    setDraft({ text: serializeTask({ task: subtask, every: null, today: store.today }), editing: subtask });
  };

  const hostOf = (subtask: Task): { host: Task; index: number } | null => {
    const host = subtask.parentId ? (store.tasks.find((each) => each.id === subtask.parentId) ?? null) : null;
    const index = host ? host.subtasks.findIndex((each) => each.id === subtask.id) : -1;
    return host && index !== -1 ? { host, index } : null;
  };

  const askDelete = (task: Task) => {
    const schedule = scheduleOf(task);
    const finish = () => {
      setAsking(null);
      setDraft(null);
    };
    if (schedule) {
      setAsking({
        question: `delete ${task.title}?`,
        choices: [
          { label: "today only", onChoose: () => { store.deleteTask(task.id); finish(); } },
          { label: "every day", onChoose: () => { store.deleteTask(task.id); store.deleteSchedule(schedule.id); finish(); } },
        ],
      });
    } else {
      setAsking({ question: `delete ${task.title}?`, choices: [{ label: "delete", onChoose: () => { store.deleteTask(task.id); finish(); } }] });
    }
  };

  const askDeleteDraft = (editing: Task) => {
    const parent = hostOf(editing);
    return parent ? askDeleteSubtask({ task: parent.host, index: parent.index }) : askDelete(editing);
  };

  const askDeleteComment = (comment: Comment) =>
    setAsking({ question: "delete this comment?", choices: [{ label: "delete", onChoose: () => { store.deleteComment(comment.id); setAsking(null); } }] });

  const askDeleteSubtask = ({ task, index }: { task: Task; index: number }) =>
    setAsking({ question: `delete ${task.subtasks[index]?.title ?? ""}?`, choices: [{ label: "delete", onChoose: () => { store.putTask(withoutSubtask({ host: task, index })); setAsking(null); setDraft(null); } }] });

  const sendToBacklog = (task: Task): Swipe => {
    if (task.scheduleId) return { word: isSkipped(task) ? "unskip" : "skip", onSwipe: () => store.putTask(skipToggled(task)) };
    return { word: "backlog", onSwipe: () => store.putTask({ ...task, dueDate: null }) };
  };

  const bringToToday = (task: Task): Swipe => ({ word: "today", onSwipe: () => store.putTask({ ...task, dueDate: store.today }) });

  const addComment = ({ task, body }: { task: Task; body: string }) =>
    store.putComment({ id: identifier(), taskId: task.id, body, author: "user", writtenAt: nowStamp(), seenAt: nowStamp(), createdAt: nowStamp() });

  const markSaved = (id: string) => {
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    setSaved(id);
    savedTimer.current = window.setTimeout(() => setSaved(null), savedDuration);
  };

  const reveal = (task: Task) => {
    const parent = hostOf(task);
    const saved = parent ? { ...task, group: parent.host.group } : task;
    const shown = parent ? { ...parent.host, subtasks: parent.host.subtasks.map((each) => (each.id === saved.id ? saved : each)) } : saved;
    store.putTask(shown);
    setList(shown.dueDate !== null && shown.dueDate <= store.today ? "today" : "backlog");
    folds.set({ key: "today:" + shown.group, open: true });
    folds.set({ key: subtasksKey(shown.id), open: true });
    setLanded(shown.id);
    markSaved(parent ? shown.id + ":" + parent.index : shown.id);
  };

  const todayGroups = grouped(onToday);
  const listOrder = [...todayGroups.flatMap((each) => each.tasks), ...backlog];

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
      return next;
    });

  const groupSelect = (tasks: Task[]) =>
    selection ? { on: tasks.length > 0 && tasks.every((task) => selection.has(task.id)), onToggle: () => toggleSelected(tasks.map((task) => task.id)) } : null;

  const play = () => {
    const chosen = listOrder.filter((task) => selection?.has(task.id) || task.subtasks.some((_, index) => selection?.has(task.id + ":" + index)));
    const first = chosen[0];
    if (!first) return;
    go({ tab: "tasks", id: first.id, run: chosen.map((task) => task.id) });
  };

  const currentRun = (): string[] | null => {
    if (route.id === null) return null;
    const run = route.run ?? [];
    const chosen = (run.includes(route.id) ? run : [route.id]).filter((id) => store.tasks.some((task) => task.id === id));
    return chosen.length === 0 ? null : chosen;
  };

  const running = currentRun();

  const rowsOf = ({ container, group }: { container: Container; group: string }): Task[] =>
    container === "backlog" ? backlog : (todayGroups.find((each) => each.group === group)?.tasks ?? []);

  const resolveTarget = ({ current, x, y }: { current: Drag; x: number; y: number }): { target: Target | null; line: Drag["line"]; hovered: string | null } => {
    const column = listRef.current?.getBoundingClientRect();
    if (!column) return { target: null, line: null, hovered: null };
    const element = document.elementFromPoint(Math.max(column.left + 8, Math.min(column.right - 8, x)), y);
    const taskElement = element?.closest<HTMLElement>("[data-task]");
    const subtaskElement =
      element?.closest<HTMLElement>("[data-subtask]") ??
      [...(taskElement?.querySelectorAll<HTMLElement>("[data-subtask]") ?? [])].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      }) ??
      null;
    const nesting = x - current.startX > nestDistance;
    const leaving = current.fromSubtask !== null && x - current.startX < -nestDistance;
    if (subtaskElement && taskElement && !leaving) {
      const [taskId = "", indexText = "0"] = (subtaskElement.dataset.subtask ?? "").split(":");
      const rect = subtaskElement.getBoundingClientRect();
      const after = y > rect.top + rect.height / 2;
      return {
        target: { kind: "subtask", taskId, index: Number(indexText) + (after ? 1 : 0) },
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
      return { target: { kind: "subtask", taskId, index: 0 }, line: { top: main.bottom + 4, left: indent, width: column.right - indent }, hovered: taskId };
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
    const source = current.fromSubtask ? (store.tasks.find((each) => each.id === current.fromSubtask?.taskId) ?? null) : null;
    const sourceSubtask = source && current.fromSubtask ? source.subtasks[current.fromSubtask.index] : undefined;
    const moving: Task[] = source && sourceSubtask && current.fromSubtask
      ? [subtaskAsTask({ subtask: sourceSubtask, host: source })]
      : listOrder.filter((task) => current.ids.includes(task.id));
    if (moving.length === 0) return;
    if (target.kind === "top") {
      const rows = rowsOf({ container: target.container, group: target.group });
      const after = placed({ rows, moving, target, today: store.today });
      for (const task of changedOnly({ before: rows, after })) store.putTask(task);
      if (target.container === "today") for (const schedule of regrouped({ moving, schedules: store.schedules, group: target.group })) store.putSchedule(schedule);
      if (source && current.fromSubtask) store.putTask(withoutSubtask({ host: source, index: current.fromSubtask.index }));
      return;
    }
    const host = store.tasks.find((each) => each.id === target.taskId);
    if (!host) return;
    const subtasks = moving.flatMap(taskAsSubtasks);
    if (source && current.fromSubtask && source.id === host.id) {
      const index = target.index > current.fromSubtask.index ? target.index - 1 : target.index;
      store.putTask(withSubtasksInserted({ host: withoutSubtask({ host, index: current.fromSubtask.index }), subtasks, index }));
      return;
    }
    store.putTask(withSubtasksInserted({ host, subtasks, index: target.index }));
    if (source && current.fromSubtask) store.putTask(withoutSubtask({ host: source, index: current.fromSubtask.index }));
    else for (const task of moving) if (task.subtasks.length) store.deleteTask(task.id);
  };

  const beginDrag = ({ event, ids, fromSubtask, title }: { event: ReactPointerEvent<HTMLButtonElement>; ids: string[]; fromSubtask: Drag["fromSubtask"]; title: string }) => {
    event.preventDefault();
    event.stopPropagation();
    const start: Drag = { ids, fromSubtask, title, startX: event.clientX, x: event.clientX, y: event.clientY, target: null, line: null, hover: null };
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
      if (current.fromSubtask && current.target) toggleSelected([current.fromSubtask.taskId + ":" + current.fromSubtask.index]);
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
            beginDrag({ event, ids: [], fromSubtask: { taskId: dragged.host.id, index: dragged.index }, title: dragged.host.subtasks[dragged.index]?.title ?? "" });
            return;
          }
          const bundle = listOrder.filter((each) => chosen.has(each.id)).map((each) => each.id);
          beginDrag({ event, ids: bundle, fromSubtask: null, title: bundle.length > 1 ? `${bundle.length} tasks` : dragged.host.title });
        },
      }
    : null;

  const holdToSelect = (id: string) => setSelection((current) => new Set(current).add(id));

  const row = ({ task, chips, todaySwipe, onTick }: { task: Task; chips: string[]; todaySwipe: Swipe | null; onTick: () => void }) => {
    const schedule = scheduleOf(task);
    return (
      <div key={task.id} className={drag?.ids.includes(task.id) ? "lifting" : undefined} data-task={task.id}>
        <TaskRow
          task={task}
          chips={chips}
          every={schedule ? everyToken(schedule) : null}
          select={select}
          onHold={holdToSelect}
          focused={focused}
          saved={saved}
          onTick={onTick}
          onTitle={() => edit(task)}
          onTitleSubtask={(index) => editSubtask({ host: task, index })}
          todaySwipe={todaySwipe}
          onDelete={() => (task.scheduleId ? askDelete(task) : store.deleteTask(task.id))}
          onDeleteSubtask={(index) => store.putTask(withoutSubtask({ host: task, index }))}
          onAddComment={(body) => addComment({ task, body })}
          onDeleteComment={askDeleteComment}
          fixedOpen={false}
          unfoldSubtasks={openedByDrag.has(task.id)}
        />
      </div>
    );
  };

  const tick = (task: Task) => store.putTask(toggled({ task, entries: store.journal, now: nowStamp() }));

  const groupPress = (tasks: Task[]) => longPress(() => setSelection((current) => new Set([...(current ?? []), ...tasks.map((task) => task.id)])));

  const focusOrder = (): string[] =>
    [...(listRef.current?.querySelectorAll<HTMLElement>("[data-focus]") ?? [])].filter((element) => !element.closest(".roll:not(.open)")).map((element) => element.dataset.focus ?? "");

  const moveFocus = (step: number) => {
    const order = focusOrder();
    const position = order.indexOf(focused ?? lastFocused.current ?? "");
    const next = order[Math.max(0, Math.min(order.length - 1, position + step))] ?? null;
    setFocused(next);
    listRef.current?.querySelector<HTMLElement>(`[data-focus="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const shortcut = (action: ShortcutAction) => {
    const target = focused && !focused.startsWith("group:") ? rowAt(focused) : null;
    if (action === "help") return setHelping(true);
    if (action === "switch") return setList(list === "today" ? "backlog" : "today");
    if (action === "add") return setDraft({ text: "", editing: null });
    if (action === "down") return moveFocus(1);
    if (action === "up") return moveFocus(-1);
    if (action === "close") {
      if (asking) return setAsking(null);
      if (helping) return setHelping(false);
      if (draft) return setDraft(null);
      if (running) return close();
      if (selection) return setSelection(null);
      if (target && showing({ folds, task: target.host }).open) return closeTask({ folds, task: target.host });
      setFocused(null);
      return (document.activeElement as HTMLElement | null)?.blur();
    }
    if (focused?.startsWith("group:")) {
      const key = focused.slice(6);
      if (action === "fold") folds.set({ key, open: !folds.isOpen({ key, fallback: true }) });
      if (action === "select") {
        const ids = (todayGroups.find((each) => "today:" + each.group === key)?.tasks ?? []).map((task) => task.id);
        selection ? toggleSelected(ids) : setSelection(new Set(ids));
      }
      return;
    }
    if (!target || !focused) return;
    const { host, index } = target;
    if (action === "fold") return toggleSubtasks({ folds, task: host });
    if (action === "select") return selection ? toggleSelected([focused]) : setSelection(new Set([focused]));
    if (action === "complete") return index === null ? tick(host) : store.putTask(subtaskToggled({ task: host, index, now: nowStamp() }));
    if (action === "edit") return index === null ? edit(host) : editSubtask({ host, index });
    if (action === "delete") return index === null ? askDelete(host) : askDeleteSubtask({ task: host, index });
    if (action === "today") {
      if (host.scheduleId) return store.putTask(skipToggled(host));
      return store.putTask({ ...host, dueDate: host.dueDate === null ? store.today : null });
    }
    if (action === "thread") toggleComments({ folds, task: host });
  };

  useShortcuts(shortcut);

  return (
    <>
      <div className="filters">
        <TextButton active={list === "today"} onSelect={() => setList("today")}>
          today ({onToday.length})
        </TextButton>
        <TextButton active={list === "backlog"} onSelect={() => setList("backlog")}>
          backlog ({backlog.length})
        </TextButton>
      </div>
      <div className="list" ref={listRef} onPointerOver={followPointer}>
        {list === "today" ? (
          todayGroups.map(({ group, tasks }) => (
            <div key={group} data-container="today" data-group={group}>
              <Group storageKey={"today:" + group} label={groupLabel(group)} count={tasks.length} defaultOpen select={groupSelect(tasks)} press={groupPress(tasks)} focused={focused === "group:today:" + group}>
                {tasks.map((task) => row({ task, chips: [], todaySwipe: sendToBacklog(task), onTick: () => tick(task) }))}
              </Group>
            </div>
          ))
        ) : (
          <div data-container="backlog" data-group="">
            {backlog.map((task) => row({ task, chips: task.group === "" ? [] : [task.group], todaySwipe: bringToToday(task), onTick: () => tick(task) }))}
          </div>
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
          <RoundButton label="add" onSelect={() => setDraft({ text: "", editing: null })}>
            <PlusGlyph />
          </RoundButton>
        </div>
      )}
      {running && (
        <Runner
          taskIds={running}
          onClose={() => {
            setSelection(null);
            close();
          }}
        />
      )}
      {draft && <Composer draft={draft} onChange={setDraft} onCommit={reveal} onClose={() => setDraft(null)} onDelete={() => draft.editing && askDeleteDraft(draft.editing)} />}
      {asking && <Confirm question={asking.question} choices={asking.choices} onCancel={() => setAsking(null)} />}
      {helping && <ShortcutsSheet onClose={() => setHelping(false)} />}
    </>
  );
}
