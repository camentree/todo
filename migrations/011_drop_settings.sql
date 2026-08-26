drop table if exists todo.settings;

alter table todo.recurring_tasks
    drop constraint if exists recurring_stage_known;

alter table todo.recurring_tasks drop column if exists stage;
