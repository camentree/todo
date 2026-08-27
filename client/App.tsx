import { Navigate, Route, Routes } from "react-router-dom";

import { Failures } from "./components/Failures.tsx";
import { InfoScreen } from "./screens/InfoScreen.tsx";
import { TasksScreen } from "./screens/TasksScreen.tsx";
import { useEaseIntoView } from "./hooks/useEaseIntoView.ts";

export function App() {
  useEaseIntoView();

  return (
    <div className="app">
      <Failures />
      <Routes>
        <Route path="/" element={<TasksScreen />} />
        <Route path="/today" element={<TasksScreen />} />
        <Route path="/today/:taskId" element={<TasksScreen />} />
        <Route
          path="/due_date/today"
          element={<Navigate to="/today" replace />}
        />
        <Route path="/task/:taskId" element={<InfoScreen />} />
        <Route path="/:taskId" element={<TasksScreen />} />
        <Route path="/:field/:value" element={<TasksScreen />} />
        <Route path="/:field/:value/:taskId" element={<TasksScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
