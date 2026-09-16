import { useState } from "react";

import { ErrorSprite } from "./components/ErrorSprite.tsx";
import { TopBar } from "./components/TopBar.tsx";
import type { Tab } from "./components/TopBar.tsx";
import { useStore } from "./data/store.tsx";
import { Today } from "./screens/Today.tsx";

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("today");
  return (
    <>
      <div className="page">
        <TopBar tab={tab} today={store.today} onTab={setTab} />
        {tab === "today" && <Today />}
      </div>
      <ErrorSprite />
    </>
  );
}
