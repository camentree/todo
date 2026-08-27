update todo.tasks set state = 'to_do', updated_at = now()
where state = 'hidden';

alter table todo.tasks drop constraint tasks_state_known;

alter table todo.tasks add constraint tasks_state_known check (
    state in (
        'to_do',
        'complete',
        'missed',
        'skipped',
        'archived'
    )
);
