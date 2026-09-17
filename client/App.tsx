import { Entries } from "./components/Entries.tsx";
import { ErrorSprite } from "./components/ErrorSprite.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { useStore } from "./data/store.tsx";
import { useRoute } from "./interaction/route.ts";
import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  const store = useStore();
  const { route, go } = useRoute();
  return (
    <>
      <div className="page">
        <TopBar tab={route.tab} today={store.today} onTab={(tab) => go({ tab, id: null })} />
        {route.tab === "tasks" && <Tasks />}
        {route.tab === "journal" && <Entries key="journal" name="journal" />}
        {route.tab === "notebook" && <Entries key="notebook" name="notebook" />}
      </div>
      <ErrorSprite />
    </>
  );
}
