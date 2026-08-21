import { Navigate, Route, Routes } from "react-router-dom";

import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Tasks />} />
        <Route path="/:field/:value" element={<Tasks />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
