update todo.tasks set stage = case stage
    when 'In Progress' then 'in_progress'
    when 'In Review' then 'in_review'
    when 'Needs Input' then 'blocked'
    when 'Blocked' then 'blocked'
end
where stage is not null;

alter table todo.tasks add constraint tasks_stage_known check (
    stage is null
    or stage in ('to_do', 'in_progress', 'in_review', 'blocked', 'complete')
);

alter table todo.recurring_tasks add constraint recurring_stage_known check (
    stage is null
    or stage in ('to_do', 'in_progress', 'in_review', 'blocked', 'complete')
);
