import { Navigate, Route, Routes } from "react-router-dom";

import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Tasks />} />
        <Route path="/today" element={<Tasks />} />
        <Route
          path="/due_date/today"
          element={<Navigate to="/today" replace />}
        />
        <Route path="/:field/:value" element={<Tasks />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
