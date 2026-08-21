import { Route, Routes } from "react-router-dom";

import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Tasks scope="today" />} />
        <Route path="/todo" element={<Tasks scope="todo" />} />
        <Route path="/list/:name" element={<Tasks scope="list" />} />
        <Route path="/done" element={<Tasks scope="done" />} />
        <Route path="/archive" element={<Tasks scope="archive" />} />
      </Routes>
    </div>
  );
}
