alter table todo.events add column seen_at timestamptz;

update todo.events
set seen_at = now()
where created_at <= (select notifications_seen_at from todo.settings where id = 1);
