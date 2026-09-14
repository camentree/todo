import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { StoreProvider } from "./data/store.tsx";
import { settings } from "./data/settings.ts";

if (settings.theme !== "system") document.documentElement.dataset.theme = settings.theme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
