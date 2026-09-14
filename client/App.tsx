import { useState } from "react";

import { serializeDefinition, serializeEntry } from "@shared/grammar.ts";
import { capitalise } from "@shared/format.ts";
import type { RunnerState } from "@shared/runner.ts";
import { startRunner } from "@shared/runner.ts";
import { childrenOf } from "@shared/tasks.ts";
import type { Definition, DerivedTask } from "@shared/types.ts";
import { defaultNotebook } from "@shared/types.ts";

import { TabBar } from "./components/TabBar.tsx";
import { useStore } from "./data/store.tsx";
import { Composer } from "./screens/Composer.tsx";
import type { ComposerState } from "./screens/Composer.tsx";
import { JournalScreen } from "./screens/JournalScreen.tsx";
import type { JournalDraft } from "./screens/JournalScreen.tsx";
import { RunnerScreen } from "./screens/RunnerScreen.tsx";
import { TodayScreen } from "./screens/TodayScreen.tsx";

type Screen = "today" | "journal" | "runner";

export function App() {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>("today");
  const [runner, setRunner] = useState<RunnerState | null>(null);
  const [returnRunner, setReturnRunner] = useState<RunnerState | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [journalDraft, setJournalDraft] = useState<JournalDraft | null>(null);
  const [notebook, setNotebook] = useState(defaultNotebook);

  const leaveRunner = () => {
    if (screen === "runner" && runner) setReturnRunner({ ...runner, running: false });
    setRunner(null);
  };

  const resumeRunner = () => {
    if (returnRunner) {
      const queue = returnRunner.queue.filter((id) => store.tasks.some((task) => task.id === id));
      if (queue.length) {
        setRunner({ ...returnRunner, queue, index: Math.min(returnRunner.index, queue.length - 1) });
        setScreen("runner");
      } else {
        setScreen("today");
      }
    } else {
      setScreen("today");
    }
    setReturnRunner(null);
  };

  const openRunner = (state: RunnerState | null) => {
    if (!state) return;
    setRunner(state);
    setScreen("runner");
  };

  const openTask = (task: DerivedTask) => {
    const root = task.parent ? (store.tasks.find((each) => each.id === task.parent) ?? task) : task;
    openRunner(startRunner({ tasks: store.tasks, tapped: task, scope: "task", groupTops: [], label: root.name }));
  };

  const runGroup = ({ group, tops }: { group: string; tops: DerivedTask[] }) => {
    const first = tops.find((task) => !task.done) ?? tops[0];
    if (!first) return;
    openRunner(startRunner({ tasks: store.tasks, tapped: first, scope: "group", groupTops: tops, label: capitalise(group) }));
  };

  const editTask = (id: string) => {
    const task = store.tasks.find((each) => each.id === id);
    if (!task) return;
    const root = task.parent ? (store.tasks.find((each) => each.id === task.parent) ?? task) : task;
    const definition = store.definitions.find((each) => each.id === root.definitionId);
    leaveRunner();
    setScreen("today");
    setComposer({
      text: serializeEntry({
        root,
        children: childrenOf({ tasks: store.tasks, id: root.id }).map((child) => ({ ...child, done: (child as DerivedTask).done })),
        group: root.group,
        every: definition?.every ?? null,
        rest: root.rest,
      }),
      editTaskId: root.id,
      editDefinitionId: definition?.id ?? null,
    });
  };

  const editDefinition = (definition: Definition) => {
    const todayTask = store.tasks.find((task) => task.definitionId === definition.id);
    setScreen("today");
    setComposer({ text: serializeDefinition(definition), editTaskId: todayTask?.id ?? null, editDefinitionId: definition.id });
  };

  const writeJournal = (taskId: string | null) => {
    leaveRunner();
    setScreen("journal");
    setJournalDraft({ text: "", notebook, editId: null, linkTaskId: taskId, promptDismissed: false });
  };

  const showTabs = screen !== "runner" && !(screen === "today" && composer) && !(screen === "journal" && journalDraft);

  return (
    <>
      <div className="stack">
        <TodayScreen onOpenTask={openTask} onEditTask={editTask} onRunGroup={runGroup} onEditDefinition={editDefinition} />
        {screen === "journal" && (
          <div className="overlay">
            <JournalScreen
              draft={journalDraft}
              onDraft={setJournalDraft}
              onNotebook={setNotebook}
              canReturn={returnRunner !== null}
              onReturn={resumeRunner}
              onClose={() => {
                setJournalDraft(null);
                if (returnRunner) resumeRunner();
              }}
            />
          </div>
        )}
      </div>
      {screen === "today" && composer && (
        <div className="overlay">
          <Composer
            state={composer}
            onChange={setComposer}
            onClose={() => {
              setComposer(null);
              resumeRunner();
            }}
          />
        </div>
      )}
      {screen === "runner" && runner && (
        <div className="overlay">
          <RunnerScreen
            state={runner}
            onChange={setRunner}
            onExit={() => {
              setRunner(null);
              setReturnRunner(null);
              setScreen("today");
            }}
            onEdit={editTask}
            onWrite={writeJournal}
          />
        </div>
      )}
      {showTabs && (
        <TabBar
          active={screen === "journal" ? "journal" : "today"}
          onToday={() => {
            setReturnRunner(null);
            setScreen("today");
          }}
          onJournal={() => {
            setReturnRunner(null);
            setScreen("journal");
          }}
          onAdd={() => {
            if (screen === "journal") writeJournal(null);
            else setComposer({ text: "", editTaskId: null, editDefinitionId: null });
          }}
        />
      )}
    </>
  );
}
