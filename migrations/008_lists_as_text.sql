drop index todo.tasks_list_idx;

alter table todo.tasks add column list text;
alter table todo.recurring_tasks add column list text;

update todo.tasks as task
set list = list_row.name
from todo.lists as list_row
where list_row.id = task.list_id;

update todo.recurring_tasks as recurring
set list = list_row.name
from todo.lists as list_row
where list_row.id = recurring.list_id;

update todo.tasks set list = 'Personal' where list is null;
update todo.recurring_tasks set list = 'Personal' where list is null;

alter table todo.tasks alter column list set not null;
alter table todo.recurring_tasks alter column list set not null;

alter table todo.tasks drop column list_id;
alter table todo.recurring_tasks drop column list_id;

drop table todo.lists;

create index tasks_list_idx on todo.tasks (list) where archived_at is null;
