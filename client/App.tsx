import { Navigate, Route, Routes } from "react-router-dom";

import { Failures } from "./components/Failures.tsx";
import { TaskLink } from "./screens/TaskLink.tsx";
import { Tasks } from "./screens/Tasks.tsx";

export function App() {
  return (
    <div className="app">
      <Failures />
      <Routes>
        <Route path="/" element={<Tasks />} />
        <Route path="/today" element={<Tasks />} />
        <Route
          path="/due_date/today"
          element={<Navigate to="/today" replace />}
        />
        <Route path="/today/:taskId" element={<Tasks />} />
        <Route path="/task/:taskId" element={<TaskLink />} />
        <Route path="/:taskId" element={<Tasks />} />
        <Route path="/:field/:value" element={<Tasks />} />
        <Route path="/:field/:value/:taskId" element={<Tasks />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
