import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { FoldsProvider } from "@shared/ui/Foldable.tsx";

import { App } from "./App.tsx";
import { StoreProvider } from "./app/data/store.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <FoldsProvider>
        <App />
      </FoldsProvider>
    </StoreProvider>
  </StrictMode>,
);
