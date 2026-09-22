import { useEffect, useRef, useState } from "react";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, keymap, placeholder } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

import { editorTheme } from "@shared/ui/editorTheme.ts";

import { identifier, nowStamp, useStore } from "../data/store.tsx";
import { dueToday, everyToken, scheduleFromParsed } from "../models/schedule.ts";
import type { Task } from "../models/task.ts";
import { taskFromParsed } from "../models/task.ts";
import type { ParsedTask } from "../models/taskText.ts";
import { parseTask, serializeTask, tokenSpans } from "../models/taskText.ts";

export interface TaskEditing {
  task: Task | null;
  onCommit: (task: Task) => void;
  onClose: () => void;
  onDelete: () => void;
}

export interface TaskEditorState {
  task: Task | null;
  host: (element: HTMLDivElement | null) => void;
  parsed: ParsedTask | null;
  preview: Task | null;
  leaving: boolean;
  stayHere: () => void;
  commit: () => void;
  close: () => void;
  onDelete: () => void;
}

const composerTheme = EditorView.theme({
  ".cm-content": { padding: "0.8rem 0.25rem 0.4rem", minHeight: "3.1rem" },
  ".cm-scroller": { overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "none", height: "7.2rem" },
  ".cm-scroller::-webkit-scrollbar": { display: "none" },
  "@media (min-width: 700px)": { ".cm-scroller": { height: "12rem" } },
  ".cm-bullet": { color: "var(--faint)" },
  ".cm-attribute": { color: "var(--accent)" },
});

function grammarHighlighting({ today, subtasks }: { today: string; subtasks: boolean }): Extension {
  const marks = (view: EditorView): DecorationSet =>
    Decoration.set(
      tokenSpans({ text: view.state.doc.toString(), today, subtasks }).map((span) =>
        Decoration.mark({ class: span.kind === "bullet" ? "cm-bullet" : "cm-attribute" }).range(span.from, span.to),
      ),
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

export function useTaskEditor({ task, onCommit, onClose, onDelete }: TaskEditing): TaskEditorState {
  const store = useStore();
  const element = useRef<HTMLDivElement | null>(null);
  const schedule = task?.scheduleId ? (store.schedules.find((each) => each.id === task.scheduleId) ?? null) : null;
  const [text, setText] = useState(() => (task === null ? "" : serializeTask({ task, every: schedule ? everyToken(schedule) : null, today: store.today })));
  const opened = useRef(text);
  const [leaving, setLeaving] = useState(false);
  const subtasks = task === null || task.parentId === null;
  const parsed = parseTask({ text, today: store.today, subtasks });

  const commit = () => {
    if (!parsed) return;
    const now = nowStamp();
    if (parsed.every) {
      const nextSchedule = scheduleFromParsed({ parsed, existing: schedule, id: schedule?.id ?? identifier(), today: store.today, now });
      if (task) {
        onCommit(taskFromParsed({ parsed, existing: task, id: task.id, today: store.today, now, schedule: nextSchedule, newId: identifier }));
      } else if (dueToday({ schedule: nextSchedule, today: store.today })) {
        onCommit(taskFromParsed({ parsed, existing: null, id: identifier(), today: store.today, now, schedule: nextSchedule, newId: identifier }));
      }
      store.putSchedule(nextSchedule);
    } else {
      onCommit(taskFromParsed({ parsed, existing: task, id: task?.id ?? identifier(), today: store.today, now, schedule: null, newId: identifier }));
    }
    onClose();
  };

  const latest = useRef({ commit, setText });
  latest.current = { commit, setText };

  const host = (node: HTMLDivElement | null) => {
    element.current = node;
  };

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const view = new EditorView({
      parent: node,
      state: EditorState.create({
        doc: text,
        extensions: [
          keymap.of([...defaultKeymap, ...historyKeymap]),
          history(),
          editorTheme,
          composerTheme,
          drawSelection(),
          EditorView.lineWrapping,
          grammarHighlighting({ today: store.today, subtasks }),
          placeholder("Morning stretch /exercise #every mo,we,fr\n- neck rolls #timer 30s"),
          EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "sentences", enterkeyhint: "enter" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.setText(update.state.doc.toString());
          }),
        ],
      }),
    });
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
      else if (parsed && text !== opened.current) setLeaving(true);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [text, leaving]);

  return {
    task,
    host,
    parsed,
    preview: parsed ? taskFromParsed({ parsed, existing: task, id: "preview", today: store.today, now: nowStamp(), schedule: null, newId: identifier }) : null,
    leaving,
    stayHere: () => setLeaving(false),
    commit,
    close: onClose,
    onDelete,
  };
}
