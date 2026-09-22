import { useIsPhone } from "@shared/hooks/useIsPhone.ts";
import { TopBar } from "@shared/components/TopBar.tsx";
import { longDate } from "@shared/format.ts";

import { Journals } from "./app/components/Journals.tsx";
import { ErrorSprite } from "./app/data/ErrorSprite.tsx";
import { useStore } from "./app/data/store.tsx";
import type { Tab } from "./app/route.ts";
import { useRoute } from "./app/route.ts";
import { Tasks } from "./app/screens/Tasks.tsx";

const sections: { name: Tab; label: string }[] = [
  { name: "tasks", label: "Tasks" },
  { name: "journal", label: "Journal" },
  { name: "notebook", label: "Notebook" },
];

export function App() {
  const store = useStore();
  const { route, go } = useRoute();
  const isPhone = useIsPhone();
  const editorScreen = route.tab === "tasks" && route.edit === true && isPhone;
  return (
    <>
      <div className="page mx-auto flex min-h-[100dvh] max-w-column flex-col px-gutter pb-32">
        {!editorScreen && <TopBar sections={sections} active={route.tab} dateline={longDate(store.today)} onSelect={(tab) => go({ tab, id: null })} />}
        {route.tab === "tasks" && <Tasks />}
        {route.tab === "journal" && <Journals key="journal" name="journal" />}
        {route.tab === "notebook" && <Journals key="notebook" name="notebook" />}
      </div>
      <ErrorSprite />
    </>
  );
}
