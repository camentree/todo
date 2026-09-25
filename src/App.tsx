import { useIsPhone } from "@shared/hooks/useIsPhone.ts";
import { TopBar } from "@shared/components/TopBar.tsx";
import { longDate } from "@shared/format.ts";
import { FoldsProvider } from "@shared/ui/Foldable.tsx";

import { ErrorSprite } from "./app/data/ErrorSprite.tsx";
import { useStore } from "./app/data/store.tsx";
import type { Tab } from "./app/route.ts";
import { useRoute } from "./app/route.ts";
import { Journals } from "./app/screens/Journals.tsx";
import { Tasks } from "./app/screens/Tasks.tsx";

const sections: { name: Tab; label: string }[] = [
  { name: "tasks", label: "Tasks" },
  { name: "journal", label: "Journal" },
];

export function App() {
  const store = useStore();
  const { route, go } = useRoute();
  const isPhone = useIsPhone();
  const editorScreen = route.tab === "tasks" && route.edit === true && isPhone;
  return (
    <>
      <div className="page mx-auto flex min-h-[100dvh] max-w-column flex-col px-gutter pb-32">
        {!editorScreen && (
          <TopBar sections={sections} active={route.tab === "tasks" ? "tasks" : "journal"} dateline={longDate(store.today)} onSelect={(tab) => go({ tab, id: null })} />
        )}
        {route.tab === "tasks" ? (
          <FoldsProvider>
            <Tasks />
          </FoldsProvider>
        ) : (
          <Journals key={route.tab} />
        )}
      </div>
      <ErrorSprite />
    </>
  );
}
