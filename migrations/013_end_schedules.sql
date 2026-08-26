alter table todo.recurring_tasks add column ended_at timestamptz;

update todo.recurring_tasks set ended_at = now() where paused = true;

alter table todo.recurring_tasks drop column paused;
