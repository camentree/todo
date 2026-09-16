import { useState } from "react";

import { Entries } from "./components/Entries.tsx";
import { ErrorSprite } from "./components/ErrorSprite.tsx";
import { TopBar } from "./components/TopBar.tsx";
import type { Tab } from "./components/TopBar.tsx";
import { useStore } from "./data/store.tsx";
import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("tasks");
  return (
    <>
      <div className="page">
        <TopBar tab={tab} today={store.today} onTab={setTab} />
        {tab === "tasks" && <Tasks />}
        {tab === "journal" && <Entries key="journal" name="journal" />}
        {tab === "notebook" && <Entries key="notebook" name="notebook" />}
      </div>
      <ErrorSprite />
    </>
  );
}
