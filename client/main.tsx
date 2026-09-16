import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { FoldsProvider } from "./components/Foldable.tsx";
import { StoreProvider } from "./data/store.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <FoldsProvider>
        <App />
      </FoldsProvider>
    </StoreProvider>
  </StrictMode>,
);
