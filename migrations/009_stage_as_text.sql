alter table todo.tasks add column stage text;
alter table todo.recurring_tasks add column stage text;

update todo.tasks
set stage = case state
    when 'in_progress' then 'In Progress'
    when 'in_review' then 'In Review'
    when 'needs_input' then 'Needs Input'
    when 'blocked' then 'Blocked'
end
where state in ('in_progress', 'in_review', 'needs_input', 'blocked');

update todo.tasks
set state = 'to_do'
where state in ('in_progress', 'in_review', 'needs_input', 'blocked');

alter table todo.tasks drop constraint tasks_state_known;

alter table todo.tasks add constraint tasks_state_known check (
    state in ('to_do', 'complete', 'missed', 'skipped', 'hidden')
);

alter table todo.comments add column seen_at timestamptz;

create index tasks_stage_idx on todo.tasks (stage) where archived_at is null;
