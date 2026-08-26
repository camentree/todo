alter table todo.tasks add column finished_at timestamptz;

update todo.tasks
set finished_at = greatest(resolved_at, archived_at);

alter table todo.tasks drop constraint tasks_state_known;

update todo.tasks
set state = 'archived'
where archived_at is not null;

alter table todo.tasks add constraint tasks_state_known check (
    state in (
        'to_do',
        'complete',
        'missed',
        'skipped',
        'hidden',
        'archived'
    )
);

drop index todo.tasks_stage_idx;
drop index todo.tasks_list_idx;
drop index todo.tasks_due_date_idx;

create index tasks_stage_idx on todo.tasks (stage)
where state <> 'archived';
create index tasks_list_idx on todo.tasks (list)
where state <> 'archived';
create index tasks_due_date_idx on todo.tasks (due_date)
where state <> 'archived';

alter table todo.tasks drop column resolved_at;
alter table todo.tasks drop column archived_at;
